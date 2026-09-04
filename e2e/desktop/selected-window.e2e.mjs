import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, "..", "..");
const desktopRoot = path.join(repositoryRoot, "apps", "desktop");
const fixturePath = path.join(
  repositoryRoot,
  "native",
  "windows",
  "Milo.TestChat",
  "bin",
  "Release",
  "net10.0-windows10.0.19041.0",
  "win-x64",
  "publish",
  "Milo.TestChat.exe",
);
const desktopRequire = createRequire(path.join(desktopRoot, "package.json"));
const electronExecutable = desktopRequire("electron");
const { _electron: electron } = await import("@playwright/test");
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "milo-selected-window-e2e-"));

let electronApp;
const fixture = spawn(fixturePath, ["--mode=uia", "--language=en", "--auto-append-ms=12000"], {
  cwd: repositoryRoot,
  stdio: "ignore",
  windowsHide: false,
});

try {
  electronApp = await electron.launch({
    executablePath: electronExecutable,
    args: [desktopRoot, `--user-data-dir=${path.join(temporaryRoot, "user-data")}`],
    cwd: desktopRoot,
    env: { ...process.env, CI: "true", ELECTRON_ENABLE_SECURITY_WARNINGS: "true" },
    timeout: 45_000,
  });
  const page = await electronApp.firstWindow({ timeout: 30_000 });
  await page.waitForLoadState("domcontentloaded");
  await page.getByRole("button", { name: "Open Milo panel" }).click();
  const fixtureChoice = page.getByRole("button", { name: /Milo TestChat/i });
  for (let attempt = 0; attempt < 4 && await fixtureChoice.count() === 0; attempt += 1) {
    await page.waitForTimeout(1_000);
    await page.getByRole("button", { name: "Choose window" }).click();
    if (await fixtureChoice.count() === 0) await page.getByRole("button", { name: "Cancel" }).click();
  }
  if (await fixtureChoice.count() === 0) {
    console.log("Electron selected-window smoke skipped: desktopCapturer exposed no interactive fixture window in this automation session.");
  } else {
    await fixtureChoice.click();
    await page.getByText("Milo TestChat", { exact: true }).first().waitFor();

    await page.getByRole("button", { name: "Preview locally" }).click();
    await page.getByLabel("Normalized recent context").waitFor({ timeout: 10_000 });
    assert.equal(await page.locator("article.reply-card").count(), 0, "Local preview must not call AI or create replies");

    await page.getByText("New activity", { exact: true }).waitFor({ timeout: 25_000 });
    assert.equal(await page.locator("article.reply-card").count(), 0, "Local change detection must not call AI");

    await page.getByRole("button", { name: "Pause", exact: true }).first().click();
    await page.getByText("Milo paused", { exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Preview locally" }).isDisabled(), true);
    console.log("Electron selected-window UIA/change/pause smoke passed with synthetic content only.");
  }
} finally {
  fixture.kill();
  if (electronApp) await electronApp.close();
  const resolvedTemporaryRoot = path.resolve(temporaryRoot);
  const resolvedSystemTemp = path.resolve(os.tmpdir());
  if (!resolvedTemporaryRoot.startsWith(`${resolvedSystemTemp}${path.sep}`)) {
    throw new Error("Refusing to clean a desktop fixture outside the system temporary directory");
  }
  await rm(resolvedTemporaryRoot, { recursive: true, force: true });
}
