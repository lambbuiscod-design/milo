import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expectedPreloadMethods } from "../../scripts/desktop-security-check.mjs";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, "..", "..");
const desktopRoot = path.join(repositoryRoot, "apps", "desktop");
const desktopRequire = createRequire(path.join(desktopRoot, "package.json"));
const electronExecutable = desktopRequire("electron");
const { _electron: electron } = await import("@playwright/test");

let electronApp;
const runtimeFailures = [];
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "milo-shell-e2e-"));

function observePage(page) {
  page.on("pageerror", (error) => runtimeFailures.push(`Renderer error: ${error.message}`));
  page.on("console", (message) => {
    if (/Electron Security Warning/i.test(message.text())) {
      runtimeFailures.push(`Electron security warning: ${message.text()}`);
    }
  });
}

try {
  electronApp = await electron.launch({
    executablePath: electronExecutable,
    args: [
      desktopRoot,
      "--milo-ci-shell-smoke",
      `--user-data-dir=${path.join(temporaryRoot, "user-data")}`,
    ],
    cwd: desktopRoot,
    env: {
      ...process.env,
      CI: "true",
      ELECTRON_ENABLE_SECURITY_WARNINGS: "true",
    },
    timeout: 45_000,
  });

  electronApp.on("window", observePage);
  const firstPage = await electronApp.firstWindow({ timeout: 30_000 });
  observePage(firstPage);
  const pageDeadline = Date.now() + 30_000;
  let page;
  while (!page && Date.now() < pageDeadline) {
    for (const candidate of electronApp.windows()) {
      await candidate.waitForLoadState("domcontentloaded").catch(() => undefined);
      if (candidate.url() === "milo://app/index.html") {
        page = candidate;
        break;
      }
    }
    if (!page) await new Promise((resolve) => setTimeout(resolve, 50));
  }
  if (!page) throw new Error("MILO_WORKSPACE_WINDOW_MISSING");
  observePage(page);
  await page.waitForLoadState("domcontentloaded");

  assert.equal(page.url(), "milo://app/index.html");

  const liveWindow = await electronApp.evaluate(async ({ BrowserWindow, session }) => {
    const window = BrowserWindow.getAllWindows().find((candidate) => candidate.webContents.getURL() === "milo://app/index.html");
    if (!window) throw new Error("MILO_WINDOW_MISSING");
    const preferences = window.webContents.getLastWebPreferences();
    window.webContents.openDevTools({ mode: "detach" });
    await new Promise((resolve) => setTimeout(resolve, 100));
    return {
      alwaysOnTop: window.isAlwaysOnTop(),
      contextIsolation: preferences.contextIsolation,
      devToolsBlocked: !window.webContents.isDevToolsOpened(),
      nodeIntegration: preferences.nodeIntegration,
      partitionMatches: window.webContents.session === session.fromPartition("milo:overlay"),
      persistentSession: window.webContents.session.isPersistent(),
      sandbox: preferences.sandbox,
      url: window.webContents.getURL(),
      webSecurity: preferences.webSecurity,
      webviewTag: preferences.webviewTag,
    };
  });

  assert.deepEqual(liveWindow, {
    alwaysOnTop: true,
    contextIsolation: true,
    devToolsBlocked: true,
    nodeIntegration: false,
    partitionMatches: true,
    persistentSession: false,
    sandbox: true,
    url: "milo://app/index.html",
    webSecurity: true,
    webviewTag: false,
  });

  const rendererBoundary = await page.evaluate(() => ({
    apiKeys: Object.keys(window.milo).sort(),
    csp: document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute("content"),
    hasNodeProcess: typeof globalThis.process !== "undefined",
    hasNodeRequire: typeof globalThis.require !== "undefined",
    text: document.body.innerText,
  }));
  assert.deepEqual(rendererBoundary.apiKeys, [...expectedPreloadMethods].sort());
  assert.equal(rendererBoundary.hasNodeProcess, false);
  assert.equal(rendererBoundary.hasNodeRequire, false);
  assert.match(rendererBoundary.csp ?? "", /default-src 'none'/);
  assert.match(rendererBoundary.csp ?? "", /connect-src 'none'/);
  assert.match(rendererBoundary.text, /Choose a chat|Paused/);

  const unlabeledButtonCount = await page.getByRole("button").evaluateAll((buttons) =>
    buttons.filter((button) => {
      const label = button.getAttribute("aria-label") ?? button.getAttribute("title") ?? button.textContent;
      return !label?.trim();
    }).length,
  );
  assert.equal(unlabeledButtonCount, 0, "Every shell button needs an accessible name");

  await page.getByRole("button", { name: "Open Milo panel" }).click();
  await page.getByRole("dialog", { name: "Milo companion" }).waitFor();
  await page.waitForFunction(
    () => document.activeElement?.getAttribute("aria-label") === "Collapse Milo panel",
  );
  await page.getByRole("button", { name: "Open Desktop Milo" }).click();

  await page.getByRole("button", { name: "Pause", exact: true }).first().click();
  await page.getByText("Milo paused", { exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Preview locally" }).isDisabled(), true);

  await page.getByRole("button", { name: "Resume", exact: true }).first().click();
  await page.getByRole("heading", { name: "Review local context" }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Sign in to suggest" }).first().isDisabled(), true);
  await page.getByText("Milo never sends messages for you.", { exact: true }).waitFor();

  await page.keyboard.press("Escape");
  await page.getByRole("dialog", { name: "Milo companion" }).waitFor({ state: "detached" });
  await page.keyboard.press("Tab");
  assert.equal(
    await page.evaluate(() => document.activeElement?.tagName),
    "BUTTON",
    "Collapsed shell must remain keyboard reachable",
  );

  await page.waitForTimeout(500);
  assert.deepEqual(runtimeFailures, [], runtimeFailures.join("\n"));
  console.log("Electron shell runtime smoke passed with synthetic data only.");
} finally {
  if (electronApp) await electronApp.close();
  const resolvedTemporaryRoot = path.resolve(temporaryRoot);
  const resolvedSystemTemp = path.resolve(os.tmpdir());
  if (!resolvedTemporaryRoot.startsWith(`${resolvedSystemTemp}${path.sep}`)) {
    throw new Error("Refusing to clean a shell fixture outside the system temporary directory");
  }
  await rm(resolvedTemporaryRoot, { recursive: true, force: true });
}
