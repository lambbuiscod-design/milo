import { randomBytes } from "node:crypto";
import { spawn, type ChildProcessWithoutNullStreams, type SpawnOptions } from "node:child_process";
import path from "node:path";

const HELPER_FILE_NAME = "Milo.Native.Windows.exe";
const HELPER_REQUEST_TIMEOUT_MS = 5_000;
const MAX_PROTOCOL_LINE_BYTES = 16 * 1024;
const MAX_STDERR_BYTES = 16 * 1024;
const MAX_WINDOW_TEXT_CHARS = 12_000;

const HELPER_BUILD_RELATIVE_PATH = [
  "native",
  "windows",
  "bin",
  "Release",
  "net10.0-windows10.0.19041.0",
  "win-x64",
  "publish",
  HELPER_FILE_NAME,
] as const;

export type NativeHelperPathContext = Readonly<{
  appPath: string;
  resourcesPath: string;
  isPackaged: boolean;
  platform?: NodeJS.Platform;
}>;

export function resolveNativeHelperPath(context: NativeHelperPathContext): string {
  if ((context.platform ?? process.platform) !== "win32") {
    throw new NativeHelperError("unsupported_platform", "Milo's Windows helper is unavailable on this platform.");
  }

  if (context.isPackaged) {
    return path.resolve(context.resourcesPath, "native-runtime", HELPER_FILE_NAME);
  }

  return path.resolve(context.appPath, "..", "..", ...HELPER_BUILD_RELATIVE_PATH);
}

export type NativeWindowIdentity = Readonly<{
  hwnd: number;
  pid: number;
  processCreationTime: string;
}>;

export type NativeTextSnapshot = Readonly<{
  text: string;
  truncated: boolean;
}>;

type NativeSpawn = (
  command: string,
  args: string[],
  options: SpawnOptions,
) => ChildProcessWithoutNullStreams;

export type NativeHelperClientOptions = Readonly<{
  pathContext: NativeHelperPathContext;
  spawnProcess?: NativeSpawn;
  timeoutMs?: number;
}>;

type PendingRequest = Readonly<{
  resolve: (response: NativeResponse) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}>;

type NativeResponse = Readonly<{
  id: string;
  data: unknown;
  errorCode: string | null;
  error: string | null;
}>;

export class NativeHelperError extends Error {
  constructor(
    readonly code: "unsupported_platform" | "startup" | "timeout" | "protocol" | "closed" | "native_error",
    message: string,
  ) {
    super(message);
    this.name = "NativeHelperError";
  }
}

/**
 * Main-process-only adapter for the fixed Milo.Native.Windows helper.
 * No renderer code should import or receive this client.
 */
export class NativeHelperClient {
  private readonly spawnProcess: NativeSpawn;
  private readonly timeoutMs: number;
  private child: ChildProcessWithoutNullStreams | null = null;
  private stdoutBuffer = Buffer.alloc(0);
  private stderrBytes = 0;
  private disposed = false;
  private readonly pending = new Map<string, PendingRequest>();

  constructor(private readonly options: NativeHelperClientOptions) {
    this.spawnProcess = options.spawnProcess ?? (spawn as NativeSpawn);
    this.timeoutMs = Math.max(100, Math.min(options.timeoutMs ?? HELPER_REQUEST_TIMEOUT_MS, HELPER_REQUEST_TIMEOUT_MS));
  }

  async listWindows(): Promise<readonly NativeWindowIdentity[]> {
    const response = await this.request({ type: "list_windows" });
    if (!Array.isArray(response.data)) throw new NativeHelperError("protocol", "Milo received an invalid window list.");

    return response.data.map((candidate) => {
      if (!isRecord(candidate) || !isSafeInteger(candidate.hwnd) || !isSafeInteger(candidate.pid) ||
          !isProcessCreationTime(candidate.processCreationTime)) {
        throw new NativeHelperError("protocol", "Milo received an invalid window identity.");
      }
      if (candidate.hwnd <= 0 || candidate.pid <= 0) {
        throw new NativeHelperError("protocol", "Milo received an invalid window identity.");
      }
      return {
        hwnd: candidate.hwnd,
        pid: candidate.pid,
        processCreationTime: candidate.processCreationTime,
      };
    });
  }

  async extractText(identity: NativeWindowIdentity, maxChars = 6_000): Promise<NativeTextSnapshot> {
    if (!isSafeInteger(identity.hwnd) || identity.hwnd <= 0 || !isSafeInteger(identity.pid) || identity.pid <= 0 ||
        !isProcessCreationTime(identity.processCreationTime)) {
      throw new NativeHelperError("protocol", "Milo rejected an invalid selected window.");
    }
    if (!Number.isInteger(maxChars) || maxChars < 256 || maxChars > MAX_WINDOW_TEXT_CHARS) {
      throw new NativeHelperError("protocol", "Milo rejected an invalid text limit.");
    }

    const response = await this.request({
      type: "extract_text",
      hwnd: identity.hwnd,
      pid: identity.pid,
      processCreationTime: identity.processCreationTime,
      maxChars,
    });
    if (!isRecord(response.data) || typeof response.data.text !== "string" || typeof response.data.truncated !== "boolean") {
      throw new NativeHelperError("protocol", "Milo received invalid extracted text.");
    }
    if (response.data.text.length > MAX_WINDOW_TEXT_CHARS) {
      throw new NativeHelperError("protocol", "Milo received oversized extracted text.");
    }
    return { text: response.data.text, truncated: response.data.truncated };
  }

  async captureText(
    identity: NativeWindowIdentity,
    language: "en" | "it" = "en",
    maxChars = 6_000,
  ): Promise<NativeTextSnapshot> {
    if (!isSafeInteger(identity.hwnd) || identity.hwnd <= 0 || !isSafeInteger(identity.pid) || identity.pid <= 0 ||
        !isProcessCreationTime(identity.processCreationTime)) {
      throw new NativeHelperError("protocol", "Milo rejected an invalid selected window.");
    }
    if (language !== "en" && language !== "it") {
      throw new NativeHelperError("protocol", "Milo rejected an invalid OCR language.");
    }
    if (!Number.isInteger(maxChars) || maxChars < 256 || maxChars > MAX_WINDOW_TEXT_CHARS) {
      throw new NativeHelperError("protocol", "Milo rejected an invalid text limit.");
    }

    const response = await this.request({
      type: "capture_text",
      hwnd: identity.hwnd,
      pid: identity.pid,
      processCreationTime: identity.processCreationTime,
      language,
      maxChars,
    });
    if (!isRecord(response.data) || typeof response.data.text !== "string" || typeof response.data.truncated !== "boolean" ||
        response.data.text.length > MAX_WINDOW_TEXT_CHARS) {
      throw new NativeHelperError("protocol", "Milo received invalid OCR text.");
    }
    return { text: response.data.text, truncated: response.data.truncated };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.failPending(new NativeHelperError("closed", "Milo stopped the Windows helper."));
    this.stopChild();
  }

  /** Clears the helper's in-memory window catalog without permanently closing the client. */
  suspend(): void {
    if (this.disposed) return;
    this.failPending(new NativeHelperError("closed", "Milo paused the Windows helper."));
    this.stopChild();
  }

  private request(payload: Readonly<Record<string, unknown>>): Promise<NativeResponse> {
    if (this.disposed) return Promise.reject(new NativeHelperError("closed", "Milo's Windows helper is closed."));

    const id = randomBytes(16).toString("hex");
    const body = JSON.stringify({ id, ...payload });
    if (Buffer.byteLength(body, "utf8") > MAX_PROTOCOL_LINE_BYTES) {
      return Promise.reject(new NativeHelperError("protocol", "Milo rejected an oversized helper request."));
    }

    return new Promise<NativeResponse>((resolve, reject) => {
      let child: ChildProcessWithoutNullStreams;
      try {
        child = this.ensureChild();
        const timer = setTimeout(() => {
          this.failPending(new NativeHelperError("timeout", "Milo's Windows helper timed out."));
          this.stopChild();
        }, this.timeoutMs);
        this.pending.set(id, { resolve, reject, timer });
        child.stdin.write(`${body}\n`, "utf8");
      } catch (error) {
        reject(
          error instanceof NativeHelperError
            ? error
            : new NativeHelperError("startup", "Milo could not start its Windows helper."),
        );
        this.stopChild();
      }
    });
  }

  private ensureChild(): ChildProcessWithoutNullStreams {
    if (this.child && !this.child.killed) return this.child;

    const executablePath = resolveNativeHelperPath(this.options.pathContext);
    const child = this.spawnProcess(executablePath, [], {
      shell: false,
      windowsHide: true,
      detached: false,
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.child = child;
    child.stdout.on("data", (chunk: Buffer | string) => this.handleStdout(chunk));
    child.stderr.on("data", (chunk: Buffer | string) => this.handleStderr(chunk));
    child.once("error", () => {
      this.failPending(new NativeHelperError("startup", "Milo's Windows helper stopped unexpectedly."));
      this.stopChild();
    });
    child.once("exit", () => {
      this.child = null;
      if (!this.disposed) this.failPending(new NativeHelperError("closed", "Milo's Windows helper exited."));
    });
    return child;
  }

  private handleStdout(chunk: Buffer | string): void {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, "utf8");
    this.stdoutBuffer = Buffer.concat([this.stdoutBuffer, bytes]);

    while (true) {
      const newline = this.stdoutBuffer.indexOf(0x0a);
      if (newline < 0) {
        if (this.stdoutBuffer.length > MAX_PROTOCOL_LINE_BYTES) {
          this.failPending(new NativeHelperError("protocol", "Milo received oversized helper output."));
          this.stopChild();
        }
        return;
      }
      const line = this.stdoutBuffer.subarray(0, newline);
      this.stdoutBuffer = this.stdoutBuffer.subarray(newline + 1);
      const withoutCarriageReturn = line[line.length - 1] === 0x0d ? line.subarray(0, line.length - 1) : line;
      if (withoutCarriageReturn.length > MAX_PROTOCOL_LINE_BYTES) {
        this.failPending(new NativeHelperError("protocol", "Milo received oversized helper output."));
        this.stopChild();
        return;
      }
      this.handleResponse(withoutCarriageReturn);
      if (this.child === null) return;
    }
  }

  private handleStderr(chunk: Buffer | string): void {
    this.stderrBytes += Buffer.byteLength(chunk.toString(), "utf8");
    if (this.stderrBytes > MAX_STDERR_BYTES) {
      this.failPending(new NativeHelperError("protocol", "Milo's Windows helper produced oversized diagnostics."));
      this.stopChild();
    }
  }

  private handleResponse(line: Buffer): void {
    let response: NativeResponse;
    try {
      response = parseResponse(JSON.parse(line.toString("utf8")));
    } catch {
      this.failPending(new NativeHelperError("protocol", "Milo received malformed helper output."));
      this.stopChild();
      return;
    }
    const request = this.pending.get(response.id);
    if (!request) {
      this.failPending(new NativeHelperError("protocol", "Milo received an uncorrelated helper response."));
      this.stopChild();
      return;
    }
    this.pending.delete(response.id);
    clearTimeout(request.timer);
    if (response.errorCode !== null) request.reject(new NativeHelperError("native_error", response.error ?? "Windows helper rejected the request."));
    else request.resolve(response);
  }

  private failPending(error: NativeHelperError): void {
    for (const request of this.pending.values()) {
      clearTimeout(request.timer);
      request.reject(error);
    }
    this.pending.clear();
  }

  private stopChild(): void {
    const child = this.child;
    this.child = null;
    this.stdoutBuffer = Buffer.alloc(0);
    this.stderrBytes = 0;
    if (child && !child.killed) child.kill();
  }
}

function parseResponse(value: unknown): NativeResponse {
  if (!isRecord(value) || Object.keys(value).some((key) => !["id", "data", "errorCode", "error"].includes(key)) ||
      !isRequestId(value.id) || !("data" in value) || !isNullableString(value.errorCode) || !isNullableString(value.error)) {
    throw new NativeHelperError("protocol", "Milo received an invalid helper response.");
  }
  return {
    id: value.id,
    data: value.data,
    errorCode: value.errorCode,
    error: value.error,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRequestId(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{32}$/.test(value);
}

function isNullableString(value: unknown): value is string | null {
  if (value === null) return true;
  return typeof value === "string" && value.length <= 120;
}

function isSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

function isProcessCreationTime(value: unknown): value is string {
  return typeof value === "string" && /^[1-9][0-9]{0,18}$/.test(value);
}
