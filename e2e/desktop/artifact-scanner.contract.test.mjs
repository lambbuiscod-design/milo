import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { scanDesktopArtifacts } from "../../scripts/desktop-artifact-scan.mjs";

const safeSyntheticPayload = [
  "\"milo://app\"",
  "contextIsolation",
  "nodeIntegration",
  "sandbox",
  "webSecurity",
  "webviewTag",
  "default-src 'none'",
].join("\n");

async function createSyntheticPackage() {
  const root = await mkdtemp(path.join(os.tmpdir(), "milo-desktop-contract-"));
  const resources = path.join(root, "Milo-win32-x64", "resources");
  await mkdir(resources, { recursive: true });
  const fuseWire = Buffer.from([0x30, 0x31, 0x30, 0x30, 0x31, 0x31, 0x30, 0x30, 0x30]);
  const syntheticExecutable = Buffer.concat([
    Buffer.from("synthetic executable marker"),
    Buffer.from("dL7pKGdnNz796PbbjQWNKmHXBZaB9tsX"),
    Buffer.from([1, fuseWire.length]),
    fuseWire,
  ]);
  await writeFile(path.join(root, "Milo-win32-x64", "Milo.exe"), syntheticExecutable);
  await writeFile(path.join(resources, "app.asar"), safeSyntheticPayload);
  const forgeConfigPath = path.join(root, "forge.config.ts");
  await writeFile(
    forgeConfigPath,
    [
      "strictlyRequireAllFuses: true,",
      "[FuseV1Options.RunAsNode]: false,",
      "[FuseV1Options.EnableCookieEncryption]: true,",
      "[FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,",
      "[FuseV1Options.EnableNodeCliInspectArguments]: false,",
      "[FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,",
      "[FuseV1Options.OnlyLoadAppFromAsar]: true,",
      "[FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: false,",
      "[FuseV1Options.GrantFileProtocolExtraPrivileges]: false,",
      "[FuseV1Options.WasmTrapHandlers]: false,",
    ].join("\n"),
  );
  return { root, forgeConfigPath };
}

async function removeSyntheticPackage(root) {
  const resolvedRoot = path.resolve(root);
  const temporaryRoot = path.resolve(os.tmpdir());
  assert.ok(
    resolvedRoot.startsWith(`${temporaryRoot}${path.sep}`) &&
      path.basename(resolvedRoot).startsWith("milo-desktop-contract-"),
    "Refusing to recursively remove anything outside this test's temporary package",
  );
  await rm(resolvedRoot, { recursive: true, force: true });
}

test("artifact scanner accepts a minimal synthetic secure package", async (context) => {
  const { root, forgeConfigPath } = await createSyntheticPackage();
  context.after(() => removeSyntheticPackage(root));
  const result = await scanDesktopArtifacts(root, { forgeConfigPath });
  assert.deepEqual(result.failures, [], result.failures.join("\n"));
});

test("artifact scanner fails closed when packaging output is absent", async () => {
  const result = await scanDesktopArtifacts(path.join(os.tmpdir(), "milo-desktop-output-does-not-exist"));
  assert.match(result.failures.join("\n"), /artifact directory is missing/i);
});

test("artifact scanner rejects server-only credentials in synthetic output", async (context) => {
  const { root, forgeConfigPath } = await createSyntheticPackage();
  context.after(() => removeSyntheticPackage(root));
  const secretName = ["OPENROUTER", "API", "KEY"].join("_");
  const appAsar = path.join(root, "Milo-win32-x64", "resources", "app.asar");
  await writeFile(appAsar, `${safeSyntheticPayload}\n${secretName}=synthetic-not-a-real-key`);
  const result = await scanDesktopArtifacts(root, { forgeConfigPath });
  assert.match(result.failures.join("\n"), /OpenRouter server key name/);
});
