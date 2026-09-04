import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    exclude: ["e2e/**", "e2e-production/**", "node_modules/**"],
    pool: "vmThreads",
    maxWorkers: 1,
    fileParallelism: false,
    coverage: { reporter: ["text", "html"] },
  },
});
