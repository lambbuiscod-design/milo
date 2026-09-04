import { cp, mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(desktopRoot, "..", "..");
const publishRoot = path.join(
  repositoryRoot,
  "native",
  "windows",
  "bin",
  "Release",
  "net10.0-windows10.0.19041.0",
  "win-x64",
  "publish",
);
const helperPath = path.join(publishRoot, "Milo.Native.Windows.exe");
const stagingRoot = path.join(desktopRoot, "native-runtime");
if (path.dirname(stagingRoot) !== desktopRoot || path.basename(stagingRoot) !== "native-runtime") {
  throw new Error("Refusing to stage outside the Milo desktop workspace.");
}

try {
  const helper = await stat(helperPath);
  if (!helper.isFile() || helper.size < 1) throw new Error("INVALID_NATIVE_HELPER");
} catch {
  throw new Error(
    "Milo native helper is missing. Publish native/windows/Milo.Native.Windows.csproj for win-x64 Release before packaging.",
  );
}

await rm(stagingRoot, { recursive: true, force: true });
await mkdir(stagingRoot, { recursive: true });
await cp(publishRoot, stagingRoot, {
  recursive: true,
  force: true,
  errorOnExist: false,
  // Runtime symbols and generated XML documentation are useful while
  // debugging the helper, but must not ship in the consumer package.
  filter: (source) => !/\.(?:pdb|xml)$/i.test(source),
});
