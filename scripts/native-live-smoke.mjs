import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configuration = path.join("bin", "Release", "net10.0-windows10.0.19041.0", "win-x64", "publish");
const helperPath = path.join(repositoryRoot, "native", "windows", configuration, "Milo.Native.Windows.exe");
const fixturePath = path.join(repositoryRoot, "native", "windows", "Milo.TestChat", configuration, "Milo.TestChat.exe");
const mode = process.argv[2] === "ocr" ? "ocr" : "uia";
const language = process.argv[3] === "it" ? "it" : "en";

if (process.platform !== "win32") throw new Error("The native live smoke requires Windows.");
if (!existsSync(helperPath) || !existsSync(fixturePath)) throw new Error("Publish the native helper and Milo.TestChat before this smoke test.");

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const fixture = spawn(fixturePath, [`--mode=${mode}`, `--language=${language}`], {
  cwd: repositoryRoot,
  stdio: "ignore",
  windowsHide: false,
});
const helper = spawn(helperPath, [], {
  cwd: repositoryRoot,
  stdio: ["pipe", "pipe", "pipe"],
  windowsHide: true,
});
const lines = createInterface({ input: helper.stdout, crlfDelay: Infinity });
const iterator = lines[Symbol.asyncIterator]();

async function request(payload) {
  helper.stdin.write(`${JSON.stringify({ id: randomBytes(16).toString("hex"), ...payload })}\n`);
  const response = await Promise.race([
    iterator.next(),
    delay(5_000).then(() => { throw new Error("Native helper response timed out."); }),
  ]);
  if (response.done || typeof response.value !== "string" || Buffer.byteLength(response.value, "utf8") > 16 * 1024) {
    throw new Error("Native helper returned an invalid response.");
  }
  const parsed = JSON.parse(response.value);
  if (parsed.errorCode !== null) throw new Error(`Native helper failed with ${String(parsed.errorCode)}: ${String(parsed.error)}.`);
  return parsed.data;
}

try {
  let selected = null;
  for (let attempt = 0; attempt < 12 && selected === null; attempt += 1) {
    await delay(250);
    const candidates = await request({ type: "list_windows" });
    selected = Array.isArray(candidates) ? candidates.find((candidate) => candidate?.pid === fixture.pid) ?? null : null;
  }
  if (selected === null) throw new Error("The synthetic fixture was not discoverable as an eligible selected window.");

  const operation = mode === "ocr"
    ? { type: "capture_text", ...selected, language, maxChars: 6_000 }
    : { type: "extract_text", ...selected, maxChars: 6_000 };
  const result = await request(operation);
  if (typeof result?.text !== "string" || result.text.trim().length < 20 || typeof result.truncated !== "boolean") {
    throw new Error(`The ${mode.toUpperCase()} fixture did not return useful bounded synthetic text.`);
  }
  console.log(`Native ${mode.toUpperCase()} live smoke passed (${language}, selected-window only; content not printed).`);
} finally {
  lines.close();
  helper.stdin.end();
  helper.kill();
  fixture.kill();
}
