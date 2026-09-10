import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  calculateCenteredPosition,
  DEFAULT_COMPANION_SIZE,
} from "../src/shared/companion-bounds";
import type { Rectangle } from "../src/shared/position";
import {
  CompanionPositionManager,
  companionPositionSchema,
} from "../src/main/companion-position-manager";

interface MockDisplay {
  id: number | string;
  bounds: Rectangle;
  workArea: Rectangle;
}

let mockDisplays: MockDisplay[] = [];
let mockPrimaryDisplay: MockDisplay;
const screenListeners: Record<string, Array<(...args: unknown[]) => void>> = {};

vi.mock("electron", () => {
  class MockBrowserWindow {
    bounds: Rectangle = { x: 0, y: 0, width: 250, height: 300 };
    options: Electron.BrowserWindowConstructorOptions;
    listeners: Record<string, Array<(...args: unknown[]) => void>> = {};
    destroyed = false;

    constructor(options: Electron.BrowserWindowConstructorOptions) {
      this.options = options;
      if (options.width && options.height) {
        this.bounds = {
          x: options.x ?? 0,
          y: options.y ?? 0,
          width: options.width,
          height: options.height,
        };
      }
    }

    isDestroyed = () => this.destroyed;
    getBounds = () => ({ ...this.bounds });
    setBounds = (newBounds: Rectangle) => {
      this.bounds = { ...newBounds };
    };
    setAlwaysOnTop = vi.fn();
    showInactive = vi.fn();
    show = vi.fn();
    loadURL = vi.fn().mockResolvedValue(undefined);
    webContents = {
      id: 2,
      isDestroyed: () => this.destroyed,
      send: vi.fn(),
      mainFrame: { url: "milo://app/companion.html", isDestroyed: () => false },
      on: vi.fn(),
    };
    on = (event: string, cb: (...args: unknown[]) => void) => {
      this.listeners[event] = this.listeners[event] || [];
      this.listeners[event].push(cb);
    };
    removeListener = (event: string, cb: (...args: unknown[]) => void) => {
      if (!this.listeners[event]) return;
      this.listeners[event] = this.listeners[event].filter((f) => f !== cb);
    };
    emit = (event: string, ...args: unknown[]) => {
      for (const listener of this.listeners[event] || []) {
        listener(...args);
      }
    };
    destroy = () => {
      this.destroyed = true;
      this.emit("closed");
    };
  }

  return {
    BrowserWindow: MockBrowserWindow,
    screen: {
      getAllDisplays: () => mockDisplays,
      getPrimaryDisplay: () => mockPrimaryDisplay,
      getDisplayNearestPoint: (point: { x: number; y: number }) => {
        const found = mockDisplays.find((d) => {
          const { x, y, width, height } = d.workArea;
          return point.x >= x && point.x <= x + width && point.y >= y && point.y <= y + height;
        });
        return (found ?? mockPrimaryDisplay) as Electron.Display;
      },
      on: (event: string, cb: (...args: unknown[]) => void) => {
        screenListeners[event] = screenListeners[event] || [];
        screenListeners[event].push(cb);
      },
      removeListener: (event: string, cb: (...args: unknown[]) => void) => {
        if (!screenListeners[event]) return;
        screenListeners[event] = screenListeners[event].filter((f) => f !== cb);
      },
      emit: (event: string, ...args: unknown[]) => {
        for (const listener of screenListeners[event] || []) {
          listener(...args);
        }
      },
    },
    app: {
      getPath: () => tmpdir(),
      isPackaged: false,
      getVersion: () => "0.1.0",
      getAppPath: () => tmpdir(),
      quit: vi.fn(),
      exit: vi.fn(),
      enableSandbox: vi.fn(),
      requestSingleInstanceLock: () => true,
      on: vi.fn(),
      whenReady: () => Promise.resolve(),
      setAppUserModelId: vi.fn(),
    },
  };
});

describe("Challenger 2 Empirical Verification: Debounce Lifecycle & Concurrency", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), "milo-ch2-debounce-"));
    mockPrimaryDisplay = {
      id: 1,
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      workArea: { x: 0, y: 0, width: 1920, height: 1040 },
    };
    mockDisplays = [mockPrimaryDisplay];
  });

  it("stress-tests 1000 rapid window move events: coalesces into exactly 1 write after 300ms", async () => {
    vi.useFakeTimers();
    try {
      const manager = new CompanionPositionManager({
        userDataDirectory: tempDir,
        debounceMs: 300,
      });

      const { BrowserWindow } = await import("electron");
      const window = new BrowserWindow({ width: 250, height: 300 });
      manager.attachWindow(window);

      const filePath = path.join(tempDir, "milo-companion-position.json");

      // Fire 1000 rapid move events
      for (let i = 1; i <= 1000; i++) {
        window.setBounds({ x: i, y: i, width: 250, height: 300 });
        (window as unknown as { emit: (e: string) => void }).emit("move");
      }

      // Assert: absolutely 0 disk writes occurred during the 1000 events
      expect(existsSync(filePath)).toBe(false);

      // Advance time by 299ms (1ms short of debounce threshold)
      vi.advanceTimersByTime(299);
      expect(existsSync(filePath)).toBe(false);

      // Advance the remaining 1ms (total 300ms after the 1000th move)
      vi.advanceTimersByTime(1);

      // Exactly 1 atomic write took place, creating the file
      expect(existsSync(filePath)).toBe(true);

      // Verify the saved data matches the 1000th move coordinates
      const persisted = JSON.parse(readFileSync(filePath, "utf8"));
      expect(persisted).toEqual({
        x: 1000,
        y: 1000,
        monitorId: "1",
        version: 1,
      });

      // Advance another 1000ms: verify no further writes occur
      const birthTime = statSync(filePath).mtimeMs;
      vi.advanceTimersByTime(1000);
      expect(statSync(filePath).mtimeMs).toBe(birthTime);

      manager.dispose();
    } finally {
      vi.useRealTimers();
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("preempts debounce timer on 'moved' event: writes synchronously with zero data loss", async () => {
    vi.useFakeTimers();
    try {
      const manager = new CompanionPositionManager({
        userDataDirectory: tempDir,
        debounceMs: 300,
      });

      const { BrowserWindow } = await import("electron");
      const window = new BrowserWindow({ width: 250, height: 300 });
      manager.attachWindow(window);

      const filePath = path.join(tempDir, "milo-companion-position.json");

      // Fire 50 rapid moves
      for (let i = 1; i <= 50; i++) {
        window.setBounds({ x: 200 + i, y: 300 + i, width: 250, height: 300 });
        (window as unknown as { emit: (e: string) => void }).emit("move");
      }

      // Advance by 120ms (less than 300ms)
      vi.advanceTimersByTime(120);
      expect(existsSync(filePath)).toBe(false);

      // User releases mouse -> 'moved' event fires
      (window as unknown as { emit: (e: string) => void }).emit("moved");

      // Immediately written without waiting for 300ms
      expect(existsSync(filePath)).toBe(true);

      const persisted = JSON.parse(readFileSync(filePath, "utf8"));
      expect(persisted).toEqual({
        x: 250,
        y: 350,
        monitorId: "1",
        version: 1,
      });

      // Remove the file to verify that when 300ms elapses, no lingering timer recreates it
      unlinkSync(filePath);
      vi.advanceTimersByTime(300);
      expect(existsSync(filePath)).toBe(false);

      manager.dispose();
    } finally {
      vi.useRealTimers();
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("preempts debounce timer on 'close' and 'closed' events without duplicate write", async () => {
    vi.useFakeTimers();
    try {
      const manager = new CompanionPositionManager({
        userDataDirectory: tempDir,
        debounceMs: 300,
      });

      const { BrowserWindow } = await import("electron");
      const window = new BrowserWindow({ width: 250, height: 300 });
      manager.attachWindow(window);

      const filePath = path.join(tempDir, "milo-companion-position.json");

      window.setBounds({ x: 420, y: 530, width: 250, height: 300 });
      (window as unknown as { emit: (e: string) => void }).emit("move");

      vi.advanceTimersByTime(50);
      expect(existsSync(filePath)).toBe(false);

      // Window receives 'close' event
      (window as unknown as { emit: (e: string) => void }).emit("close");
      expect(existsSync(filePath)).toBe(true);

      const persisted = JSON.parse(readFileSync(filePath, "utf8"));
      expect(persisted.x).toBe(420);
      expect(persisted.y).toBe(530);

      // Unlink file and trigger 'closed'
      unlinkSync(filePath);
      (window as unknown as { emit: (e: string) => void }).emit("closed");

      // Since pending was already flushed, closed should not re-write stale/empty position
      expect(existsSync(filePath)).toBe(false);

      manager.dispose();
    } finally {
      vi.useRealTimers();
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("synchronously flushes pending coordinates upon dispose() and cleans up listeners", async () => {
    vi.useFakeTimers();
    try {
      const manager = new CompanionPositionManager({
        userDataDirectory: tempDir,
        debounceMs: 300,
      });

      const { BrowserWindow } = await import("electron");
      const window = new BrowserWindow({ width: 250, height: 300 });
      manager.attachWindow(window);

      const filePath = path.join(tempDir, "milo-companion-position.json");

      window.setBounds({ x: 600, y: 700, width: 250, height: 300 });
      (window as unknown as { emit: (e: string) => void }).emit("move");

      expect(existsSync(filePath)).toBe(false);

      // Dispose called while debounce timer is active
      manager.dispose();
      expect(existsSync(filePath)).toBe(true);

      const persisted = JSON.parse(readFileSync(filePath, "utf8"));
      expect(persisted.x).toBe(600);
      expect(persisted.y).toBe(700);

      // Verify that subsequent events do not trigger writes after dispose
      unlinkSync(filePath);
      window.setBounds({ x: 800, y: 900, width: 250, height: 300 });
      (window as unknown as { emit: (e: string) => void }).emit("move");
      vi.advanceTimersByTime(500);
      expect(existsSync(filePath)).toBe(false);
    } finally {
      vi.useRealTimers();
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("handles consecutive flush() calls idempotently", async () => {
    const manager = new CompanionPositionManager({
      userDataDirectory: tempDir,
      debounceMs: 300,
    });

    const { BrowserWindow } = await import("electron");
    const window = new BrowserWindow({ width: 250, height: 300 });
    manager.attachWindow(window);

    const filePath = path.join(tempDir, "milo-companion-position.json");

    // Flush when nothing has moved: file should not be created
    manager.flush();
    expect(existsSync(filePath)).toBe(false);

    window.setBounds({ x: 123, y: 456, width: 250, height: 300 });
    (window as unknown as { emit: (e: string) => void }).emit("move");

    // Multiple rapid flushes
    for (let i = 0; i < 10; i++) {
      manager.flush();
    }

    expect(existsSync(filePath)).toBe(true);
    const content = JSON.parse(readFileSync(filePath, "utf8"));
    expect(content).toEqual({
      x: 123,
      y: 456,
      monitorId: "1",
      version: 1,
    });

    // Unlink and flush again: pending position was cleared, so file is not recreated
    unlinkSync(filePath);
    manager.flush();
    expect(existsSync(filePath)).toBe(false);

    manager.dispose();
    rmSync(tempDir, { recursive: true, force: true });
  });
});

describe("Challenger 2 Empirical Verification: File Corruption & Atomic Write Resilience", () => {
  let tempDir: string;
  const expectedPrimaryCenter = { x: 835, y: 370, monitorId: "1", version: 1 };

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), "milo-ch2-corrupt-"));
    mockPrimaryDisplay = {
      id: 1,
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      workArea: { x: 0, y: 0, width: 1920, height: 1040 },
    };
    mockDisplays = [mockPrimaryDisplay];
  });

  it("recovers gracefully from truncated JSON (syntax error) and heals disk state", () => {
    const filePath = path.join(tempDir, "milo-companion-position.json");
    writeFileSync(filePath, '{"x": 100, "y": 200, "mon', "utf8");

    const manager = new CompanionPositionManager({ userDataDirectory: tempDir });
    const position = manager.loadInitialPosition();

    expect(position).toEqual(expectedPrimaryCenter);

    // Healed file check
    const healed = JSON.parse(readFileSync(filePath, "utf8"));
    expect(healed).toEqual(expectedPrimaryCenter);
    expect(companionPositionSchema.safeParse(healed).success).toBe(true);

    rmSync(tempDir, { recursive: true, force: true });
  });

  it("recovers gracefully from binary junk and null byte corruption", () => {
    const filePath = path.join(tempDir, "milo-companion-position.json");
    const garbage = Buffer.from([0x00, 0xff, 0xfe, 0xef, 0xba, 0xbe, 0xca, 0xfe]);
    writeFileSync(filePath, garbage);

    const manager = new CompanionPositionManager({ userDataDirectory: tempDir });
    const position = manager.loadInitialPosition();

    expect(position).toEqual(expectedPrimaryCenter);

    rmSync(tempDir, { recursive: true, force: true });
  });

  it("recovers gracefully from empty file (0 bytes)", () => {
    const filePath = path.join(tempDir, "milo-companion-position.json");
    writeFileSync(filePath, "", "utf8");

    const manager = new CompanionPositionManager({ userDataDirectory: tempDir });
    const position = manager.loadInitialPosition();

    expect(position).toEqual(expectedPrimaryCenter);

    rmSync(tempDir, { recursive: true, force: true });
  });

  it("rejects schema violations: missing required fields", () => {
    const filePath = path.join(tempDir, "milo-companion-position.json");

    // Missing monitorId
    writeFileSync(filePath, JSON.stringify({ x: 100, y: 200, version: 1 }), "utf8");
    let manager = new CompanionPositionManager({ userDataDirectory: tempDir });
    expect(manager.loadInitialPosition()).toEqual(expectedPrimaryCenter);

    // Missing y
    writeFileSync(filePath, JSON.stringify({ x: 100, monitorId: "1", version: 1 }), "utf8");
    manager = new CompanionPositionManager({ userDataDirectory: tempDir });
    expect(manager.loadInitialPosition()).toEqual(expectedPrimaryCenter);

    // Missing x
    writeFileSync(filePath, JSON.stringify({ y: 200, monitorId: "1", version: 1 }), "utf8");
    manager = new CompanionPositionManager({ userDataDirectory: tempDir });
    expect(manager.loadInitialPosition()).toEqual(expectedPrimaryCenter);

    rmSync(tempDir, { recursive: true, force: true });
  });

  it("rejects schema violations: extra unexpected keys (.strict() validation)", () => {
    const filePath = path.join(tempDir, "milo-companion-position.json");
    writeFileSync(
      filePath,
      JSON.stringify({
        x: 100,
        y: 200,
        monitorId: "1",
        version: 1,
        injectedKey: "unauthorized_payload",
        extraProp: 999,
      }),
      "utf8",
    );

    const manager = new CompanionPositionManager({ userDataDirectory: tempDir });
    const position = manager.loadInitialPosition();

    expect(position).toEqual(expectedPrimaryCenter);

    rmSync(tempDir, { recursive: true, force: true });
  });

  it("rejects out-of-bounds coordinates, non-integers, and invalid types", () => {
    const filePath = path.join(tempDir, "milo-companion-position.json");

    const testCases = [
      { x: 100_001, y: 100, monitorId: "1", version: 1 }, // x > 100,000
      { x: -100_001, y: 100, monitorId: "1", version: 1 }, // x < -100,000
      { x: 100, y: 100_001, monitorId: "1", version: 1 }, // y > 100,000
      { x: 100, y: -100_001, monitorId: "1", version: 1 }, // y < -100,000
      { x: 100.45, y: 200, monitorId: "1", version: 1 }, // floating point x
      { x: 100, y: 200.75, monitorId: "1", version: 1 }, // floating point y
      { x: 100, y: 200, monitorId: "", version: 1 }, // empty monitorId
      { x: 100, y: 200, monitorId: "A".repeat(65), version: 1 }, // monitorId > 64 chars
      { x: 100, y: 200, monitorId: 123, version: 1 }, // non-string monitorId
      { x: 100, y: 200, monitorId: "1", version: 2 }, // invalid version != 1
    ];

    for (const testCase of testCases) {
      writeFileSync(filePath, JSON.stringify(testCase), "utf8");
      const manager = new CompanionPositionManager({ userDataDirectory: tempDir });
      expect(manager.loadInitialPosition()).toEqual(expectedPrimaryCenter);
    }

    rmSync(tempDir, { recursive: true, force: true });
  });

  it("rejects oversized file (> 4KB) and accepts valid file at threshold", () => {
    const filePath = path.join(tempDir, "milo-companion-position.json");

    // Case 1: 4097 bytes (1 byte over 4KB limit)
    const validJson = JSON.stringify({ x: 100, y: 200, monitorId: "1", version: 1 });
    const padding4097 = " ".repeat(4097 - validJson.length);
    writeFileSync(filePath, validJson + padding4097, "utf8");
    expect(statSync(filePath).size).toBe(4097);

    let manager = new CompanionPositionManager({ userDataDirectory: tempDir });
    expect(manager.loadInitialPosition()).toEqual(expectedPrimaryCenter);

    // Case 2: 100KB large payload
    writeFileSync(filePath, " ".repeat(102400), "utf8");
    expect(statSync(filePath).size).toBe(102400);

    manager = new CompanionPositionManager({ userDataDirectory: tempDir });
    expect(manager.loadInitialPosition()).toEqual(expectedPrimaryCenter);

    // Case 3: exactly 4096 bytes (within limit)
    const padding4096 = " ".repeat(4096 - validJson.length);
    writeFileSync(filePath, validJson + padding4096, "utf8");
    expect(statSync(filePath).size).toBe(4096);

    manager = new CompanionPositionManager({ userDataDirectory: tempDir });
    const position4096 = manager.loadInitialPosition();
    expect(position4096).toEqual({ x: 100, y: 200, monitorId: "1", version: 1 });

    rmSync(tempDir, { recursive: true, force: true });
  });

  it("ensures atomic write safety: cleans up .tmp on write failure without crashing", () => {
    const filePath = path.join(tempDir, "milo-companion-position.json");
    const tmpPath = `${filePath}.tmp`;

    // Normal successful write
    const manager = new CompanionPositionManager({ userDataDirectory: tempDir });
    const pos = manager.loadInitialPosition();
    expect(pos).toEqual(expectedPrimaryCenter);

    // Verify .tmp is cleaned up after successful write
    expect(existsSync(tmpPath)).toBe(false);
    expect(existsSync(filePath)).toBe(true);

    // Failure injection: Replace filePath with a directory.
    // In Node on Windows/POSIX, renameSync(tmpPath, directoryPath) throws EISDIR/EPERM
    rmSync(filePath, { force: true });
    mkdirSync(filePath);

    // Now trigger a write via loadInitialPosition which calls write
    const fallback = manager.loadInitialPosition();
    expect(fallback).toEqual(expectedPrimaryCenter);

    // Verify that .tmp was cleaned up in the catch block and did not crash
    expect(existsSync(tmpPath)).toBe(false);

    // Cleanup injected directory
    rmSync(filePath, { recursive: true, force: true });
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("handles 100 rapid sequential flushes without race conditions or file leaks", async () => {
    const manager = new CompanionPositionManager({ userDataDirectory: tempDir });
    const filePath = path.join(tempDir, "milo-companion-position.json");

    const { BrowserWindow } = await import("electron");
    const window = new BrowserWindow({ width: 250, height: 300 });
    manager.attachWindow(window);

    // Load initial
    manager.loadInitialPosition();

    // 100 rapid moves with immediate flushes
    for (let i = 1; i <= 100; i++) {
      window.setBounds({ x: 100 + i, y: 200 + i, width: 250, height: 300 });
      (window as unknown as { emit: (e: string) => void }).emit("move");
      manager.flush();
    }

    // Verify directory contains only the single json file and zero .tmp files
    const dirFiles = readdirSync(tempDir);
    expect(dirFiles).toContain("milo-companion-position.json");
    expect(dirFiles.filter((f) => f.endsWith(".tmp"))).toHaveLength(0);

    // Check final position on disk
    const saved = JSON.parse(readFileSync(filePath, "utf8"));
    expect(saved).toEqual({
      x: 200,
      y: 300,
      monitorId: "1",
      version: 1,
    });

    manager.dispose();
    rmSync(tempDir, { recursive: true, force: true });
  });
});
