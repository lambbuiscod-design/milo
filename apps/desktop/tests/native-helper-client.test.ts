import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import {
  NativeHelperClient,
  NativeHelperError,
  type NativeHelperClientOptions,
} from "../src/main/native-helper-client";

class FakeChild extends EventEmitter {
  readonly stdin = new PassThrough();
  readonly stdout = new PassThrough();
  readonly stderr = new PassThrough();
  killed = false;

  constructor(private readonly respond: (request: Record<string, unknown>, child: FakeChild) => void) {
    super();
    this.stdin.on("data", (chunk: Buffer) => {
      const line = chunk.toString("utf8").trim();
      if (line) this.respond(JSON.parse(line) as Record<string, unknown>, this);
    });
  }

  kill(): boolean {
    this.killed = true;
    this.emit("exit", null, "SIGTERM");
    return true;
  }
}

function options(respond: (request: Record<string, unknown>, child: FakeChild) => void): {
  config: NativeHelperClientOptions;
  getChild: () => FakeChild | undefined;
} {
  let lastChild: FakeChild | undefined;
  const config: NativeHelperClientOptions = {
    pathContext: {
      appPath: "C:\\Milo\\apps\\desktop",
      resourcesPath: "C:\\Milo\\resources",
      isPackaged: true,
      platform: "win32",
    },
    spawnProcess: (command, args, spawnOptions) => {
      expect(command).toMatch(/Milo\.Native\.Windows\.exe$/);
      expect(args).toEqual([]);
      expect(spawnOptions.shell).toBe(false);
      expect(spawnOptions.windowsHide).toBe(true);
      expect(spawnOptions.detached).toBe(false);
      lastChild = new FakeChild(respond);
      return lastChild as never;
    },
  };
  return { config, getChild: () => lastChild };
}

describe("NativeHelperClient", () => {
  it("uses the fixed helper path and correlates a window-list response", async () => {
    const { config } = options((request, child) => {
      child.stdout.write(JSON.stringify({
        id: request.id,
        data: [{ hwnd: 101, pid: 202, processCreationTime: "303" }],
        errorCode: null,
        error: null,
      }) + "\n");
    });
    const client = new NativeHelperClient(config);

    await expect(client.listWindows()).resolves.toEqual([{ hwnd: 101, pid: 202, processCreationTime: "303" }]);
    client.dispose();
  });

  it("sends only a bounded selected identity and validates extracted text", async () => {
    let received: Record<string, unknown> | undefined;
    const { config } = options((request, child) => {
      received = request;
      child.stdout.write(JSON.stringify({
        id: request.id,
        data: { text: "hello", truncated: false },
        errorCode: null,
        error: null,
      }) + "\n");
    });
    const client = new NativeHelperClient(config);

    await expect(client.extractText({ hwnd: 101, pid: 202, processCreationTime: "303" }, 6000)).resolves.toEqual({
      text: "hello",
      truncated: false,
    });
    expect(received).toMatchObject({ type: "extract_text", hwnd: 101, pid: 202, processCreationTime: "303", maxChars: 6000 });
    await expect(client.extractText({ hwnd: 101, pid: 202, processCreationTime: "303" }, 12_001)).rejects.toMatchObject({ code: "protocol" });
    client.dispose();
  });

  it("rejects process creation times that are not bounded decimal strings", async () => {
    const { config } = options(() => {
      throw new Error("helper must not be called for invalid identity");
    });
    const client = new NativeHelperClient(config);

    await expect(client.extractText({ hwnd: 101, pid: 202, processCreationTime: "not-a-filetime" })).rejects.toMatchObject({
      code: "protocol",
    });
    client.dispose();
  });

  it("supports explicitly requested local OCR capture in English or Italian", async () => {
    let received: Record<string, unknown> | undefined;
    const { config } = options((request, child) => {
      received = request;
      child.stdout.write(JSON.stringify({
        id: request.id,
        data: { text: "ciao", truncated: false },
        errorCode: null,
        error: null,
      }) + "\n");
    });
    const client = new NativeHelperClient(config);

    await expect(client.captureText({ hwnd: 101, pid: 202, processCreationTime: "303" }, "it")).resolves.toEqual({
      text: "ciao",
      truncated: false,
    });
    expect(received).toMatchObject({ type: "capture_text", language: "it", processCreationTime: "303" });
    await expect(client.captureText({ hwnd: 101, pid: 202, processCreationTime: "303" }, "en", 255)).rejects.toMatchObject({
      code: "protocol",
    });
    client.dispose();
  });

  it("times out and kills the helper, and dispose rejects pending work", async () => {
    const timeoutOptions = options(() => {}).config;
    const client = new NativeHelperClient({ ...timeoutOptions, timeoutMs: 100 });
    const pending = client.listWindows();
    await expect(pending).rejects.toBeInstanceOf(NativeHelperError);
    await expect(pending).rejects.toMatchObject({ code: "timeout" });

    const child = options(() => {}).config;
    const second = new NativeHelperClient(child);
    const secondPending = second.listWindows();
    second.dispose();
    await expect(secondPending).rejects.toMatchObject({ code: "closed" });
  });

  it("suspends the child while allowing a later clean restart", async () => {
    const { config, getChild } = options((request, child) => {
      child.stdout.write(JSON.stringify({
        id: request.id,
        data: [],
        errorCode: null,
        error: null,
      }) + "\n");
    });
    const client = new NativeHelperClient(config);
    await client.listWindows();
    const firstChild = getChild();
    client.suspend();
    expect(firstChild?.killed).toBe(true);
    await expect(client.listWindows()).resolves.toEqual([]);
    client.dispose();
  });

  it("fails closed on an uncorrelated response", async () => {
    const { config, getChild } = options((_request, child) => {
      child.stdout.write(JSON.stringify({
        id: "ffffffffffffffffffffffffffffffff",
        data: [],
        errorCode: null,
        error: null,
      }) + "\n");
    });
    const client = new NativeHelperClient(config);

    await expect(client.listWindows()).rejects.toMatchObject({ code: "protocol" });
    expect(getChild()?.killed).toBe(true);
  });

  it("fails closed without throwing when a correlated response has an invalid shape", async () => {
    const { config, getChild } = options((request, child) => {
      child.stdout.write(JSON.stringify({
        id: request.id,
        data: [],
        errorCode: null,
        error: null,
        unexpected: true,
      }) + "\n");
    });
    const client = new NativeHelperClient(config);

    await expect(client.listWindows()).rejects.toMatchObject({ code: "protocol" });
    expect(getChild()?.killed).toBe(true);
  });
});
