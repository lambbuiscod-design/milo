import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const helper = fileURLToPath(new URL("../../native/windows/bin/Release/net10.0-windows10.0.19041.0/win-x64/publish/Milo.Native.Windows.exe", import.meta.url));
const id = "0123456789abcdef0123456789abcdef";
const requests = [
  "{not-json}",
  JSON.stringify({ id, type: "shell" }),
  JSON.stringify({ id, type: "list_windows", unexpected: true }),
  JSON.stringify({ id, type: "extract_text", hwnd: 1, pid: 1, processCreationTime: "1", maxChars: 6000 }),
  "x".repeat(16 * 1024 + 1),
  JSON.stringify({ id, type: "unknown" }),
];
const child = spawn(helper, [], { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
let output = "";
let stderrBytes = 0;
const timer = setTimeout(() => child.kill(), 15_000);
try {
  child.stdout.on("data", (chunk) => {
    output += chunk.toString("utf8");
    if (Buffer.byteLength(output) > 32 * 1024) child.kill();
  });
  child.stderr.on("data", (chunk) => { stderrBytes += chunk.length; });
  const completion = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) => code === 0 ? resolve() : reject(new Error("Native protocol process failed")));
  });
  child.stdin.on("error", () => { /* Process completion reports a failed pipe. */ });
  child.stdin.end(requests.join("\n") + "\n");
  await completion;
  const responses = output.trim().split(/\r?\n/).map((line) => JSON.parse(line));
  assert.equal(stderrBytes, 0, "The helper must not log diagnostics or request contents");
  assert.equal(responses.length, requests.length);
  for (const response of responses) {
    assert.equal(response.data, null);
    assert.equal(typeof response.errorCode, "string");
    assert.equal(typeof response.error, "string");
  }
  assert.equal(responses[0].errorCode, "invalid_request");
  assert.equal(responses[1].errorCode, "unsupported_request");
  assert.equal(responses[2].errorCode, "invalid_request");
  assert.equal(responses[3].errorCode, "stale_window");
  assert.equal(responses[4].errorCode, "invalid_request");
  assert.equal(responses[5].id, id, "Oversized input must not desynchronize later requests");
  assert.equal(responses[5].errorCode, "unsupported_request");
  console.log("[native-protocol] malformed, unknown, extra-field, unselected-window and oversized requests rejected; recovery passed");
} finally {
  clearTimeout(timer);
  child.kill();
}
