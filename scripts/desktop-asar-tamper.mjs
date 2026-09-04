import { spawn } from "node:child_process";
import { cp, mkdtemp, open, readdir, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");

async function findPackagedApp(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (!entry.isDirectory()) continue;
    const executablePath = path.join(entryPath, "Milo.exe");
    const asarPath = path.join(entryPath, "resources", "app.asar");
    try {
      if ((await stat(executablePath)).isFile() && (await stat(asarPath)).isFile()) {
        return { packageDirectory: entryPath, executablePath, asarPath };
      }
    } catch {
      // This directory is not the packaged app; continue the bounded search.
    }
    const nested = await findPackagedApp(entryPath);
    if (nested) return nested;
  }
  return null;
}

async function corruptAsarHeader(asarPath) {
  const handle = await open(asarPath, "r+");
  try {
    const { size } = await handle.stat();
    if (size < 32) throw new Error("Packaged app.asar is unexpectedly small");
    const headerWindow = Buffer.alloc(Math.min(4096, size));
    const { bytesRead } = await handle.read(headerWindow, 0, headerWindow.length, 0);
    let index = Math.min(bytesRead - 1, 128);
    while (index > 16 && headerWindow[index] === 0) index -= 1;
    if (index <= 16) throw new Error("Could not locate a disposable ASAR header byte");
    const corrupted = Buffer.from([headerWindow[index] ^ 0x01]);
    await handle.write(corrupted, 0, 1, index);
  } finally {
    await handle.close();
  }
}

async function runProbe(executablePath) {
  return new Promise((resolve, reject) => {
    const child = spawn(executablePath, ["--milo-ci-asar-tamper-probe"], {
      env: { ...process.env, ELECTRON_ENABLE_SECURITY_WARNINGS: "true" },
      stdio: "ignore",
      windowsHide: true,
    });
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("Tampered package remained running instead of failing closed"));
    }, 15_000);

    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("exit", (code, signal) => {
      clearTimeout(timeout);
      if (code === 0 && signal === null) {
        reject(new Error("Tampered package exited successfully instead of failing closed"));
      } else {
        resolve({ code, signal });
      }
    });
  });
}

async function proveHealthyPackageStarts(executablePath, userDataDirectory) {
  return new Promise((resolve, reject) => {
    let requestedShutdown = false;
    let shutdownTimeout;
    const child = spawn(
      executablePath,
      ["--milo-ci-package-smoke", `--user-data-dir=${userDataDirectory}`],
      {
        env: { ...process.env, ELECTRON_ENABLE_SECURITY_WARNINGS: "true" },
        stdio: "ignore",
        windowsHide: true,
      },
    );
    const startupWindow = setTimeout(() => {
      requestedShutdown = true;
      child.kill();
      shutdownTimeout = setTimeout(() => {
        reject(new Error("Healthy packaged app did not stop after the bounded smoke probe"));
      }, 5_000);
    }, 3_000);

    child.once("error", (error) => {
      clearTimeout(startupWindow);
      clearTimeout(shutdownTimeout);
      reject(error);
    });
    child.once("exit", (code, signal) => {
      clearTimeout(startupWindow);
      clearTimeout(shutdownTimeout);
      if (!requestedShutdown) {
        reject(new Error(`Healthy packaged app exited during startup (code ${code}, signal ${signal})`));
      } else {
        resolve();
      }
    });
  });
}

async function main() {
  if (process.platform !== "win32") {
    throw new Error("ASAR tamper verification must run on the pinned Windows CI job");
  }

  const target = path.resolve(repositoryRoot, process.argv[2] ?? "apps/desktop/out");
  const packaged = await findPackagedApp(target);
  if (!packaged) throw new Error(`Could not find Milo.exe and resources/app.asar under ${target}`);

  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "milo-asar-tamper-"));
  const resolvedTemporaryRoot = path.resolve(temporaryRoot);
  const resolvedSystemTemp = path.resolve(os.tmpdir());
  if (!resolvedTemporaryRoot.startsWith(`${resolvedSystemTemp}${path.sep}`)) {
    throw new Error("Refusing to create or clean a tamper fixture outside the system temporary directory");
  }

  try {
    const disposablePackage = path.join(temporaryRoot, path.basename(packaged.packageDirectory));
    await cp(packaged.packageDirectory, disposablePackage, { recursive: true });
    const disposableAsar = path.join(disposablePackage, "resources", "app.asar");
    const disposableExecutable = path.join(disposablePackage, "Milo.exe");
    await proveHealthyPackageStarts(disposableExecutable, path.join(temporaryRoot, "user-data"));
    await corruptAsarHeader(disposableAsar);
    await runProbe(disposableExecutable);
    console.log("Healthy package started and a tampered ASAR failed closed in a disposable copy.");
  } finally {
    await rm(resolvedTemporaryRoot, { recursive: true, force: true });
  }
}

await main();
