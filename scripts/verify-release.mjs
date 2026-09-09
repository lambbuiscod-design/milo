import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const nodeVersion = readFileSync(new URL("../.node-version", import.meta.url), "utf8").trim();
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const pnpmVersion = packageJson.packageManager.slice("pnpm@".length);
if (process.versions.node !== nodeVersion) throw new Error(`Use Node ${nodeVersion}.`);
if (!process.env.npm_config_user_agent?.startsWith(`pnpm/${pnpmVersion} `) || !process.env.npm_execpath) {
  throw new Error(`Run pnpm release:verify with pnpm ${pnpmVersion}.`);
}
if (process.platform !== "win32") throw new Error("The complete desktop release verification requires Windows.");

const checks = [
  ["install", "--frozen-lockfile"],
  ["lint"], ["typecheck"], ["test"],
  ["test:desktop:contracts"], ["test:desktop:security"],
  ["test:release-check"], ["test:smoke:production-contract"],
  ["native:build"], ["native:publish"], ["test:native:protocol"], ["test:native:chat-fixture"],
  ["build"], ["test:e2e"], ["test:e2e:production"],
  ["exec", "node", "e2e/desktop/electron-shell.e2e.mjs"],
  ["desktop:make"],
  ["exec", "node", "scripts/desktop-artifact-scan.mjs", "apps/desktop/out"],
  ["exec", "node", "scripts/desktop-asar-tamper.mjs", "apps/desktop/out"],
  ["audit", "--prod", "--audit-level", "moderate"],
];
for (const args of checks) {
  console.log(`[release-verify] pnpm ${args.join(" ")}`);
  const result = spawnSync(process.execPath, [process.env.npm_execpath, ...args], {
    cwd: root, stdio: "inherit",
  });
  if (result.error || result.status !== 0) process.exit(result.status ?? 1);
}
console.log("[release-verify] Local verification passed. Artifacts are unsigned/internal only; production approval still requires docs/RELEASE.md.");
