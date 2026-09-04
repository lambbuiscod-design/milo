import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, "..", "..");

test("desktop workflow is a pinned, secret-free Windows gate", async () => {
  const workflow = await readFile(path.join(repositoryRoot, ".github", "workflows", "desktop.yml"), "utf8");
  const packageJson = JSON.parse(await readFile(path.join(repositoryRoot, "package.json"), "utf8"));
  const pnpmVersion = packageJson.packageManager.replace(/^pnpm@/, "");

  assert.match(workflow, /runs-on:\s*windows-latest/);
  assert.match(workflow, /node-version-file:\s*\.node-version/);
  assert.match(workflow, /global-json-file:\s*global\.json/);
  assert.match(workflow, new RegExp(`version:\\s*["']?${pnpmVersion.replaceAll(".", "\\.")}["']?`));
  assert.match(workflow, /pnpm install --frozen-lockfile/);
  assert.match(workflow, /node scripts\/desktop-security-check\.mjs/);
  assert.match(workflow, /node --test --test-isolation=none/);
  assert.match(workflow, /e2e\/desktop\/source-security\.contract\.test\.mjs/);
  assert.match(workflow, /dotnet build native\/windows\/Milo\.TestChat\/Milo\.TestChat\.csproj --configuration Release/);
  assert.match(workflow, /node scripts\/test-chat-fixture\.mjs/);
  assert.match(workflow, /scripts\/native-live-smoke\.mjs/);
  assert.match(workflow, /scripts\/test-chat-fixture\.mjs/);
  assert.match(workflow, /pnpm --filter @milo\/desktop package/);
  assert.match(workflow, /node e2e\/desktop\/electron-shell\.e2e\.mjs/);
  assert.match(workflow, /node scripts\/desktop-artifact-scan\.mjs apps\/desktop\/out/);
  assert.match(workflow, /node scripts\/desktop-asar-tamper\.mjs apps\/desktop\/out/);
  assert.match(workflow, /ELECTRON_ENABLE_SECURITY_WARNINGS:\s*["']true["']/);
  assert.match(workflow, /permissions:\s*\r?\n\s+contents:\s*read/);

  assert.doesNotMatch(workflow, /pull_request_target/);
  assert.doesNotMatch(workflow, /\$\{\{\s*secrets\./);
  assert.doesNotMatch(workflow, /ELECTRON_DISABLE_SECURITY_WARNINGS/);
  assert.doesNotMatch(workflow, /permissions:[\s\S]*?\b(?:write-all|contents:\s*write|id-token:\s*write)\b/);
});
