import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const webRoot = path.join(repositoryRoot, "apps", "web");
const nextCli = path.join(repositoryRoot, "node_modules", "next", "dist", "bin", "next");

export default defineConfig({
  testDir: "./production",
  outputDir: path.join(repositoryRoot, "test-results", "e2e-web-production"),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3200",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    navigationTimeout: 60_000,
  },
  projects: [
    { name: "production-chromium", use: { ...devices["Desktop Chrome"] } },
    {
      name: "production-mobile",
      use: {
        ...devices["iPhone 13"],
        browserName: "chromium",
        viewport: { width: 360, height: 780 },
      },
    },
  ],
  webServer: {
    command: `node "${nextCli}" start --hostname 127.0.0.1 --port 3200`,
    cwd: webRoot,
    url: "http://127.0.0.1:3200",
    reuseExistingServer: false,
    timeout: 120_000,
    env: { NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3200" },
  },
});
