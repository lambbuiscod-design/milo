import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const webRoot = path.join(repositoryRoot, "apps", "web");

export default defineConfig({
  testDir: "./mocked",
  outputDir: path.join(repositoryRoot, "test-results", "e2e-web"),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 240_000,
  expect: { timeout: 30_000 },
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    navigationTimeout: 180_000,
    permissions: ["clipboard-read", "clipboard-write"],
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["iPhone 13"], browserName: "chromium", viewport: { width: 360, height: 780 } } },
  ],
  webServer: {
    command: "node ../../scripts/start-web-e2e.mjs",
    cwd: webRoot,
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 600_000,
    env: { MILO_E2E_MODE: "true", NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3100" },
  },
});
