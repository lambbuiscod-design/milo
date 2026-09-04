import { rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webRoot = path.join(repositoryRoot, "apps", "web");
const e2eBuildRoot = path.join(webRoot, ".next-e2e-dev");
const nextCli = path.join(repositoryRoot, "node_modules", "next", "dist", "bin", "next");
const relativeBuildRoot = path.relative(webRoot, e2eBuildRoot);

if (relativeBuildRoot.startsWith("..") || path.isAbsolute(relativeBuildRoot)) {
  throw new Error("Refusing to clean an E2E build directory outside apps/web.");
}

await rm(e2eBuildRoot, { force: true, recursive: true, maxRetries: 3, retryDelay: 100 });

const server = spawn(
  process.execPath,
  [nextCli, "dev", "--hostname", "127.0.0.1", "--port", "3100"],
  { cwd: webRoot, env: process.env, stdio: "inherit" },
);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    if (!server.killed) server.kill(signal);
  });
}

server.once("error", (error) => {
  console.error("[e2e/web-server] failed to start", { errorType: error.name });
  process.exitCode = 1;
});

server.once("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
