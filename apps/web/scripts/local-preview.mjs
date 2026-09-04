import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const nextBinary = require.resolve("next/dist/bin/next");

const requestedPort = Number(process.env.MILO_PREVIEW_PORT ?? "3101");
if (!Number.isInteger(requestedPort) || requestedPort < 1024 || requestedPort > 65_535) {
  throw new Error("MILO_PREVIEW_PORT must be an integer between 1024 and 65535.");
}
if (process.env.NODE_ENV === "production") {
  throw new Error("Milo's local preview mode cannot run with NODE_ENV=production.");
}

const appUrl = `http://127.0.0.1:${requestedPort}`;
console.log(`[milo-preview] starting ${appUrl}`);
console.log("[milo-preview] local test identity, analysis and billing are enabled; never use this mode for a deployment.");

const child = spawn(
  process.execPath,
  [
    nextBinary,
    "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    String(requestedPort),
  ],
  {
    env: {
      ...process.env,
      MILO_E2E_MODE: "true",
      NEXT_PUBLIC_APP_URL: appUrl,
    },
    stdio: "inherit",
  },
);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("error", (error) => {
  console.error(`[milo-preview] failed to start: ${error.message}`);
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  if (signal) console.log(`[milo-preview] stopped by ${signal}`);
  process.exitCode = code ?? (signal ? 0 : 1);
});
