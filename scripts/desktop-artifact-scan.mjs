import { createReadStream } from "node:fs";
import { open, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");

const requiredBundleMarkers = [
  ["milo://app origin", /milo:\/\/app(?:\/|["'])/],
  ["contextIsolation", /contextIsolation/],
  ["nodeIntegration", /nodeIntegration/],
  ["sandbox", /sandbox/],
  ["webSecurity", /webSecurity/],
  ["webviewTag", /webviewTag/],
  ["default-src 'none'", /default-src 'none'/],
];

const forbiddenPayloadPatterns = [
  ["OpenAI server key name", /OPENAI_API_KEY/],
  ["OpenRouter server key name", /OPENROUTER_API_KEY/],
  ["rate-limit HMAC secret name", /RATE_LIMIT_HASH_SECRET/],
  ["Stripe secret key name", /STRIPE_SECRET_KEY/],
  ["Stripe webhook secret name", /STRIPE_WEBHOOK_SECRET/],
  ["Supabase secret key name", /SUPABASE_SECRET_KEY/],
  ["Supabase service-role key name", /SUPABASE_SERVICE_ROLE_KEY/],
  ["OpenRouter credential value", /sk-or-v1-[A-Za-z0-9_-]{16,}/],
  ["Stripe credential value", /(?:sk_(?:live|test)|rk_(?:live|test)|whsec)_[A-Za-z0-9]{12,}/],
  ["Supabase secret value", /sb_secret_[A-Za-z0-9_-]{12,}/],
  ["private key material", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["desktop E2E bypass", /MILO_E2E_MODE/],
  ["disabled Electron warnings", /ELECTRON_DISABLE_SECURITY_WARNINGS/],
  ["disabled Chromium sandbox", /--no-sandbox/],
  ["disabled web security", /--disable-web-security/],
  ["disabled certificate checks", /ignore-certificate-errors/],
  ["provider SDK", /@openrouter\/sdk|(?:^|[\\/])node_modules[\\/](?:openai|stripe)(?:[\\/]|$)/],
  ["plaintext environment file", /(?:^|["/\\])\.env(?:\.[A-Za-z0-9_-]+)?(?:["/\\]|$)/],
  ["credential scratch file", /deepseekspro\.json/i],
];

const fuseNames = [
  "RunAsNode",
  "EnableCookieEncryption",
  "EnableNodeOptionsEnvironmentVariable",
  "EnableNodeCliInspectArguments",
  "EnableEmbeddedAsarIntegrityValidation",
  "OnlyLoadAppFromAsar",
  "LoadBrowserProcessSpecificV8Snapshot",
  "GrantFileProtocolExtraPrivileges",
  "WasmTrapHandlers",
];

const fuseSentinel = Buffer.from("dL7pKGdnNz796PbbjQWNKmHXBZaB9tsX");

async function collectFiles(directory) {
  const files = [];
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(entryPath)));
    } else {
      files.push(entryPath);
    }
  }
  return files;
}

function isAppPayload(relativePath) {
  return /(?:^|[\\/])app\.asar$/i.test(relativePath) ||
    /(?:^|[\\/])app\.asar\.unpacked[\\/]/i.test(relativePath) ||
    /\.(?:cjs|html|js|json|mjs)$/i.test(relativePath);
}

async function scanFile(filePath, visitor) {
  const stream = createReadStream(filePath, { highWaterMark: 64 * 1024 });
  let overlap = "";
  for await (const chunk of stream) {
    const text = overlap + chunk.toString("latin1");
    visitor(text);
    overlap = text.slice(-4096);
  }
}

async function readFuseWire(executablePath) {
  const handle = await open(executablePath, "r");
  try {
    const { size } = await handle.stat();
    const chunkSize = 4 * 1024 * 1024;
    let sentinelPosition = -1;
    for (let offset = 0; offset < size; offset += chunkSize) {
      const length = Math.min(chunkSize + fuseSentinel.length - 1, size - offset);
      const buffer = Buffer.allocUnsafe(length);
      const { bytesRead } = await handle.read(buffer, 0, length, offset);
      const localPosition = buffer.subarray(0, bytesRead).indexOf(fuseSentinel);
      if (localPosition >= 0) {
        sentinelPosition = offset + localPosition;
        break;
      }
    }

    if (sentinelPosition < 0) {
      throw new Error("Electron fuse sentinel was not found");
    }

    const header = Buffer.alloc(2);
    const headerPosition = sentinelPosition + fuseSentinel.length;
    const headerRead = await handle.read(header, 0, header.length, headerPosition);
    if (headerRead.bytesRead !== header.length) {
      throw new Error("Electron fuse header is truncated");
    }
    const [version, length] = header;
    if (version !== 1) {
      throw new Error(`Unsupported Electron fuse wire version: ${version}`);
    }
    if (length < fuseNames.length || length > 255) {
      throw new Error(`Unexpected Electron fuse wire length: ${length}`);
    }
    const wire = Buffer.alloc(length);
    const wireRead = await handle.read(wire, 0, wire.length, headerPosition + header.length);
    if (wireRead.bytesRead !== wire.length) {
      throw new Error("Electron fuse wire is truncated");
    }
    return wire;
  } finally {
    await handle.close();
  }
}

async function expectedFuseWire(forgeConfigPath) {
  const forgeSource = await readFile(forgeConfigPath, "utf8");
  if (!/strictlyRequireAllFuses\s*:\s*true\b/.test(forgeSource)) {
    throw new Error("Forge fuse config does not strictly require all fuses");
  }

  return fuseNames.map((fuseName) => {
    const match = forgeSource.match(new RegExp(`FuseV1Options\\.${fuseName}\\s*\\]\\s*:\\s*(true|false)\\b`));
    if (!match) {
      throw new Error(`Forge fuse config does not explicitly set ${fuseName}`);
    }
    return match[1] === "true" ? 0x31 : 0x30;
  });
}

export async function scanDesktopArtifacts(targetDirectory, options = {}) {
  const failures = [];
  let targetStats;
  try {
    targetStats = await stat(targetDirectory);
  } catch {
    return { failures: [`Desktop artifact directory is missing: ${targetDirectory}`], filesScanned: 0 };
  }
  if (!targetStats.isDirectory()) {
    return { failures: [`Desktop artifact target is not a directory: ${targetDirectory}`], filesScanned: 0 };
  }

  const files = await collectFiles(targetDirectory);
  if (files.length === 0) {
    return { failures: [`Desktop artifact directory is empty: ${targetDirectory}`], filesScanned: 0 };
  }

  const relativePaths = files.map((filePath) => path.relative(targetDirectory, filePath));
  if (!relativePaths.some((relativePath) => /(?:^|[\\/])app\.asar$/i.test(relativePath))) {
    failures.push("Packaged desktop output must contain resources/app.asar.");
  }
  if (!relativePaths.some((relativePath) => /\.exe$/i.test(relativePath))) {
    failures.push("Packaged Windows output must contain an executable.");
  }

  for (const relativePath of relativePaths) {
    const baseName = path.basename(relativePath);
    if (/^\.env(?:\.|$)/i.test(baseName) || /^deepseekspro\.json$/i.test(baseName)) {
      failures.push(`Credential/environment file was packaged: ${relativePath}`);
    }
  }

  for (const relativePath of relativePaths) {
    if (/(?:^|[\\/])(?:__tests__|coverage|e2e|fixtures?|test-results)(?:[\\/]|$)/i.test(relativePath)) {
      failures.push(`Test or fixture content was packaged: ${relativePath}`);
    }
    if (/\.(?:map|pdb)$/i.test(relativePath) || /\.(?:spec|test)\.[cm]?[jt]sx?$/i.test(relativePath)) {
      failures.push(`Debug/test artifact was packaged: ${relativePath}`);
    }
  }

  const observedMarkers = new Set();
  for (let index = 0; index < files.length; index += 1) {
    const filePath = files[index];
    const relativePath = relativePaths[index];
    if (!isAppPayload(relativePath)) {
      continue;
    }

    const matchesForFile = new Set();
    await scanFile(filePath, (text) => {
      for (const [label, expression] of requiredBundleMarkers) {
        if (expression.test(text)) {
          observedMarkers.add(label);
        }
      }
      for (const [label, expression] of forbiddenPayloadPatterns) {
        if (expression.test(text)) {
          matchesForFile.add(label);
        }
      }
      if (/"[^"\r\n]+\.js\.map"/.test(text)) {
        matchesForFile.add("embedded source map");
      }
      if (/"(?:e2e|fixtures?|__tests__)"\s*:/.test(text)) {
        matchesForFile.add("embedded test or fixture tree");
      }
    });

    for (const label of matchesForFile) {
      failures.push(`Forbidden ${label} found in packaged payload: ${relativePath}`);
    }
  }

  for (const [label] of requiredBundleMarkers) {
    if (!observedMarkers.has(label)) {
      failures.push(`Packaged app is missing security marker: ${label}`);
    }
  }

  const executableIndex = relativePaths.findIndex((relativePath) => /(?:^|[\\/])Milo\.exe$/i.test(relativePath));
  if (executableIndex < 0) {
    failures.push("Packaged output must contain the expected Milo.exe for fuse inspection.");
  } else {
    const forgeConfigPath = options.forgeConfigPath ?? path.join(repositoryRoot, "apps", "desktop", "forge.config.ts");
    try {
      const expected = await expectedFuseWire(forgeConfigPath);
      const actual = await readFuseWire(files[executableIndex]);
      for (let index = 0; index < expected.length; index += 1) {
        if (actual[index] !== expected[index]) {
          failures.push(
            `Packaged fuse ${fuseNames[index]} is ${String.fromCharCode(actual[index] ?? 0)}, expected ${String.fromCharCode(expected[index])}.`,
          );
        }
      }
    } catch (error) {
      failures.push(`Could not verify packaged Electron fuses: ${error.message}`);
    }
  }

  return { failures, filesScanned: files.length };
}

async function main() {
  const requestedTarget = process.argv[2];
  const targetDirectory = requestedTarget
    ? path.resolve(repositoryRoot, requestedTarget)
    : path.join(repositoryRoot, "apps", "desktop", "out");
  const result = await scanDesktopArtifacts(targetDirectory);

  if (result.failures.length > 0) {
    console.error("Desktop artifact scan failed:");
    for (const failure of result.failures) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Desktop artifact scan passed (${result.filesScanned} files inspected).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main();
}
