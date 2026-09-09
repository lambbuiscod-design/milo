import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const command = process.argv[2];
if (!["build", "publish"].includes(command)) throw new Error("Use native-build.mjs build|publish");
if (process.platform !== "win32") throw new Error("Native builds require Windows x64.");
const expected = JSON.parse(readFileSync(new URL("../global.json", import.meta.url), "utf8")).sdk.version;
const version = spawnSync("dotnet", ["--version"], { cwd: root, encoding: "utf8" });
if (version.status !== 0 || version.stdout.trim() !== expected) {
  throw new Error(`Install the repository-pinned .NET SDK ${expected} and put it on PATH.`);
}

const projects = command === "publish"
  ? ["native/windows/Milo.Native.Windows.csproj"]
  : ["native/windows/Milo.Native.Windows.csproj", "native/windows/Milo.TestChat/Milo.TestChat.csproj"];
for (const project of projects) {
  for (const args of [
    ["restore", project, "--locked-mode", "--runtime", "win-x64"],
    [command, project, "--configuration", "Release", "--runtime", "win-x64", "--self-contained", "true", "--no-restore"],
  ]) {
    const result = spawnSync("dotnet", args, { cwd: root, stdio: "inherit" });
    if (result.error || result.status !== 0) process.exit(result.status ?? 1);
  }
}
