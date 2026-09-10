import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_COMPANION_SIZE,
  MIN_COMPANION_PEEK_PX,
  calculateCenteredPosition,
  calculateCompanionBounds,
  clampWithEdgePeeking,
} from "../src/shared/companion-bounds";
import type { Rectangle, Size } from "../src/shared/position";
import {
  CompanionPositionManager,
  companionPositionSchema,
} from "../src/main/companion-position-manager";
import { createCompanionWindow } from "../src/main/window";
import { MILO_COMPANION_ENTRY, SECURE_WEB_PREFERENCES } from "../src/main/security-policy";

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
        return found ?? mockPrimaryDisplay;
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
    ipcMain: {
      handle: vi.fn(),
      removeHandler: vi.fn(),
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
    session: {
      fromPartition: () => ({
        setPermissionCheckHandler: vi.fn(),
        setPermissionRequestHandler: vi.fn(),
        setDisplayMediaRequestHandler: vi.fn(),
        on: vi.fn(),
        webRequest: { onBeforeRequest: vi.fn() },
        protocol: { handle: vi.fn() },
      }),
    },
    protocol: {
      registerSchemesAsPrivileged: vi.fn(),
    },
    Menu: {
      setApplicationMenu: vi.fn(),
      buildFromTemplate: () => ({ popup: vi.fn() }),
    },
    net: {
      fetch: vi.fn(),
    },
  };
});

describe("Companion Window Construction & Security (Milestone 3 R1)", () => {
  it("creates a frameless transparent window with exact companion dimensions", () => {
    const window = createCompanionWindow("path/to/preload.cjs");
    const options = (window as unknown as { options: Electron.BrowserWindowConstructorOptions }).options;

    expect(options.width).toBe(250);
    expect(options.height).toBe(300);
    expect(options.transparent).toBe(true);
    expect(options.frame).toBe(false);
    expect(options.alwaysOnTop).toBe(true);
    expect(options.skipTaskbar).toBe(true);
    expect(options.backgroundColor).toBe("#00000000");
    expect(options.hasShadow).toBe(false);
    expect(options.resizable).toBe(false);
    expect(options.autoHideMenuBar).toBe(true);
    expect(options.title).toBe("Milo Companion");

    // Secure web preferences
    expect(options.webPreferences?.nodeIntegration).toBe(false);
    expect(options.webPreferences?.contextIsolation).toBe(true);
    expect(options.webPreferences?.sandbox).toBe(true);
    expect(options.webPreferences?.partition).toBe(SECURE_WEB_PREFERENCES.partition);
    expect(options.webPreferences?.preload).toBe("path/to/preload.cjs");
  });

  it("exports exact MILO_COMPANION_ENTRY targeting companion.html", () => {
    expect(MILO_COMPANION_ENTRY).toBe("milo://app/companion.html");
  });
});

describe("Mathematical Clamping & 25px Edge Peeking (Milestone 3 R4)", () => {
  const workArea: Rectangle = { x: 0, y: 0, width: 1920, height: 1040 };
  const size: Size = { width: 250, height: 300 };

  it("calculates exact clamping bounds with 25px edge peeking", () => {
    const bounds = calculateCompanionBounds(size, workArea, 25);
    // minX = 0 - 250 + 25 = -225
    // maxX = 0 + 1920 - 25 = 1895
    // minY = 0 - 300 + 25 = -275
    // maxY = 0 + 1040 - 25 = 1015
    expect(bounds).toEqual({
      minX: -225,
      maxX: 1895,
      minY: -275,
      maxY: 1015,
    });
  });

  it("leaves exactly 25px visible when dragged beyond left edge", () => {
    const clamped = clampWithEdgePeeking({ x: -1000, y: 200 }, size, workArea, 25);
    expect(clamped.x).toBe(-225);
    expect(clamped.y).toBe(200);
    // Right edge of window is -225 + 250 = 25px into workArea (from x=0)
    expect(clamped.x + size.width).toBe(workArea.x + 25);
  });

  it("leaves exactly 25px visible when dragged beyond right edge", () => {
    const clamped = clampWithEdgePeeking({ x: 3000, y: 200 }, size, workArea, 25);
    expect(clamped.x).toBe(1895);
    expect(clamped.y).toBe(200);
    // Left edge of window is at 1895, exactly 25px before 1920
    expect(workArea.x + workArea.width - clamped.x).toBe(25);
  });

  it("leaves exactly 25px visible when dragged beyond top edge", () => {
    const clamped = clampWithEdgePeeking({ x: 500, y: -800 }, size, workArea, 25);
    expect(clamped.x).toBe(500);
    expect(clamped.y).toBe(-275);
    // Bottom edge of window is -275 + 300 = 25px into workArea (from y=0)
    expect(clamped.y + size.height).toBe(workArea.y + 25);
  });

  it("leaves exactly 25px visible when dragged beyond bottom edge", () => {
    const clamped = clampWithEdgePeeking({ x: 500, y: 2000 }, size, workArea, 25);
    expect(clamped.x).toBe(500);
    expect(clamped.y).toBe(1015);
    // Top edge of window is at 1015, exactly 25px before 1040
    expect(workArea.y + workArea.height - clamped.y).toBe(25);
  });

  it("correctly handles negative workArea coordinates on multi-monitor setups", () => {
    const leftMonitor: Rectangle = { x: -1920, y: 0, width: 1920, height: 1080 };
    // minX = -1920 - 250 + 25 = -2145
    // maxX = -1920 + 1920 - 25 = -25
    // minY = 0 - 300 + 25 = -275
    // maxY = 0 + 1080 - 25 = 1055

    const farLeft = clampWithEdgePeeking({ x: -4000, y: 500 }, size, leftMonitor, 25);
    expect(farLeft.x).toBe(-2145);
    expect(farLeft.y).toBe(500);

    const farRight = clampWithEdgePeeking({ x: 500, y: 500 }, size, leftMonitor, 25);
    expect(farRight.x).toBe(-25);
    expect(farRight.y).toBe(500);

    const farTop = clampWithEdgePeeking({ x: -1000, y: -2000 }, size, leftMonitor, 25);
    expect(farTop.x).toBe(-1000);
    expect(farTop.y).toBe(-275);

    const farBottom = clampWithEdgePeeking({ x: -1000, y: 3000 }, size, leftMonitor, 25);
    expect(farBottom.x).toBe(-1000);
    expect(farBottom.y).toBe(1055);
  });

  it("preserves coordinates safely within work area", () => {
    const clamped = clampWithEdgePeeking({ x: 400, y: 300 }, size, workArea, 25);
    expect(clamped).toEqual({ x: 400, y: 300 });
  });

  it("rounds floating-point coordinates and handles non-finite inputs", () => {
    const clamped = clampWithEdgePeeking({ x: 400.6, y: 300.2 }, size, workArea, 25);
    expect(clamped).toEqual({ x: 401, y: 300 });

    const nonFinite = clampWithEdgePeeking({ x: Number.NaN, y: Number.NaN }, size, workArea, 25);
    expect(nonFinite.x).toBe(0);
    expect(nonFinite.y).toBe(0);

    const extreme = clampWithEdgePeeking({ x: -100_000, y: 100_000 }, size, workArea, 25);
    expect(extreme.x).toBe(-225);
    expect(extreme.y).toBe(1015);
  });

  it("calculates centered position exactly on display workArea", () => {
    const centered = calculateCenteredPosition(size, workArea);
    // x = Math.round(0 + (1920 - 250) / 2) = 835
    // y = Math.round(0 + (1040 - 300) / 2) = 370
    expect(centered).toEqual({ x: 835, y: 370 });
  });
});

describe("Companion Position Persistence & Debounce Lifecycle (Milestone 3 R2)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), "milo-companion-test-"));
    mockPrimaryDisplay = {
      id: 1,
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      workArea: { x: 0, y: 0, width: 1920, height: 1040 },
    };
    mockDisplays = [mockPrimaryDisplay];
  });

  it("coalesces rapid move events into a single atomic write after 300ms", async () => {
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

      // First move at t=0
      window.setBounds({ x: 100, y: 100, width: 250, height: 300 });
      (window as unknown as { emit: (e: string) => void }).emit("move");

      // Advance 100ms: file should not exist yet
      vi.advanceTimersByTime(100);
      expect(() => readFileSync(filePath, "utf8")).toThrow();

      // Second move at t=100
      window.setBounds({ x: 150, y: 150, width: 250, height: 300 });
      (window as unknown as { emit: (e: string) => void }).emit("move");

      // Advance 150ms: total 250ms from start, but only 150ms since second move
      vi.advanceTimersByTime(150);
      expect(() => readFileSync(filePath, "utf8")).toThrow();

      // Third move at t=250
      window.setBounds({ x: 200, y: 200, width: 250, height: 300 });
      (window as unknown as { emit: (e: string) => void }).emit("move");

      // Advance 300ms from third move
      vi.advanceTimersByTime(300);

      // Now file should exist with the final coordinates (200, 200)
      const content = JSON.parse(readFileSync(filePath, "utf8"));
      expect(content).toEqual({
        x: 200,
        y: 200,
        monitorId: "1",
        version: 1,
      });

      manager.dispose();
    } finally {
      vi.useRealTimers();
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("immediately flushes pending coordinates on 'moved' event without waiting for timer", async () => {
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

      window.setBounds({ x: 320, y: 410, width: 250, height: 300 });
      (window as unknown as { emit: (e: string) => void }).emit("move");

      // Emit 'moved' (user released drag) before 300ms timer
      (window as unknown as { emit: (e: string) => void }).emit("moved");

      // File should exist immediately
      const content = JSON.parse(readFileSync(filePath, "utf8"));
      expect(content).toEqual({
        x: 320,
        y: 410,
        monitorId: "1",
        version: 1,
      });

      manager.dispose();
    } finally {
      vi.useRealTimers();
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("immediately flushes pending coordinates on 'close' and 'closed' events", async () => {
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

      window.setBounds({ x: 450, y: 550, width: 250, height: 300 });
      (window as unknown as { emit: (e: string) => void }).emit("move");

      // Close event before timer
      (window as unknown as { emit: (e: string) => void }).emit("close");

      const content = JSON.parse(readFileSync(filePath, "utf8"));
      expect(content.x).toBe(450);
      expect(content.y).toBe(550);

      manager.dispose();
    } finally {
      vi.useRealTimers();
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("flushes pending coordinates on dispose()", async () => {
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

      window.setBounds({ x: 500, y: 600, width: 250, height: 300 });
      (window as unknown as { emit: (e: string) => void }).emit("move");

      manager.dispose();

      const content = JSON.parse(readFileSync(filePath, "utf8"));
      expect(content.x).toBe(500);
      expect(content.y).toBe(600);
    } finally {
      vi.useRealTimers();
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("persists roundtrip to disk and reloads accurately across manager instances", () => {
    try {
      const manager1 = new CompanionPositionManager({ userDataDirectory: tempDir });
      const initial = manager1.loadInitialPosition();
      expect(initial.x).toBe(835);
      expect(initial.y).toBe(370);
      expect(initial.monitorId).toBe("1");

      const manager2 = new CompanionPositionManager({ userDataDirectory: tempDir });
      const reloaded = manager2.loadInitialPosition();
      expect(reloaded).toEqual(initial);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe("Crash Recovery & Corrupted State Handling (Milestone 3 R2)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), "milo-corrupt-test-"));
    mockPrimaryDisplay = {
      id: 1,
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      workArea: { x: 0, y: 0, width: 1920, height: 1040 },
    };
    mockDisplays = [mockPrimaryDisplay];
  });

  it("safely falls back to primary display center when file is corrupted JSON", () => {
    try {
      const filePath = path.join(tempDir, "milo-companion-position.json");
      writeFileSync(filePath, "{ corrupt json <<< !@#", "utf8");

      const manager = new CompanionPositionManager({ userDataDirectory: tempDir });
      const position = manager.loadInitialPosition();

      expect(position).toEqual({
        x: 835,
        y: 370,
        monitorId: "1",
        version: 1,
      });

      // Verifies file was rewritten with valid state
      const reloaded = JSON.parse(readFileSync(filePath, "utf8"));
      expect(companionPositionSchema.safeParse(reloaded).success).toBe(true);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("safely falls back when file has invalid schema or missing fields", () => {
    try {
      const filePath = path.join(tempDir, "milo-companion-position.json");
      writeFileSync(filePath, JSON.stringify({ x: "invalid", y: null }), "utf8");

      const manager = new CompanionPositionManager({ userDataDirectory: tempDir });
      const position = manager.loadInitialPosition();

      expect(position).toEqual({
        x: 835,
        y: 370,
        monitorId: "1",
        version: 1,
      });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("safely falls back when coordinates exceed schema limits", () => {
    try {
      const filePath = path.join(tempDir, "milo-companion-position.json");
      writeFileSync(
        filePath,
        JSON.stringify({ x: 999_999, y: -999_999, monitorId: "1", version: 1 }),
        "utf8",
      );

      const manager = new CompanionPositionManager({ userDataDirectory: tempDir });
      const position = manager.loadInitialPosition();

      expect(position).toEqual({
        x: 835,
        y: 370,
        monitorId: "1",
        version: 1,
      });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("safely falls back when file exceeds MAX_POSITION_FILE_BYTES", () => {
    try {
      const filePath = path.join(tempDir, "milo-companion-position.json");
      const oversizedPayload = " ".repeat(5000);
      writeFileSync(filePath, oversizedPayload, "utf8");

      const manager = new CompanionPositionManager({ userDataDirectory: tempDir });
      const position = manager.loadInitialPosition();

      expect(position).toEqual({
        x: 835,
        y: 370,
        monitorId: "1",
        version: 1,
      });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe("Multi-Monitor Recovery (Milestone 3 R3)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), "milo-multimon-test-"));
    mockPrimaryDisplay = {
      id: 1,
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      workArea: { x: 0, y: 0, width: 1920, height: 1040 },
    };
    mockDisplays = [mockPrimaryDisplay];
  });

  it("falls back to primary monitor center when saved monitorId is disconnected", () => {
    try {
      const filePath = path.join(tempDir, "milo-companion-position.json");
      // Saved on monitor 2 (which was unplugged)
      writeFileSync(
        filePath,
        JSON.stringify({ x: 2500, y: 500, monitorId: "2", version: 1 }),
        "utf8",
      );

      const manager = new CompanionPositionManager({ userDataDirectory: tempDir });
      const position = manager.loadInitialPosition();

      // Monitor 2 missing -> fallback to primary display center
      expect(position).toEqual({
        x: 835,
        y: 370,
        monitorId: "1",
        version: 1,
      });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("restores and clamps position when saved monitor is connected", () => {
    try {
      const secondaryDisplay: MockDisplay = {
        id: 2,
        bounds: { x: 1920, y: 0, width: 1920, height: 1080 },
        workArea: { x: 1920, y: 0, width: 1920, height: 1040 },
      };
      mockDisplays = [mockPrimaryDisplay, secondaryDisplay];

      const filePath = path.join(tempDir, "milo-companion-position.json");
      writeFileSync(
        filePath,
        JSON.stringify({ x: 2100, y: 300, monitorId: "2", version: 1 }),
        "utf8",
      );

      const manager = new CompanionPositionManager({ userDataDirectory: tempDir });
      const position = manager.loadInitialPosition();

      expect(position).toEqual({
        x: 2100,
        y: 300,
        monitorId: "2",
        version: 1,
      });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("automatically relocates to primary display center when active monitor is unplugged at runtime (display-removed)", async () => {
    try {
      const secondaryDisplay: MockDisplay = {
        id: 2,
        bounds: { x: 1920, y: 0, width: 1920, height: 1080 },
        workArea: { x: 1920, y: 0, width: 1920, height: 1040 },
      };
      mockDisplays = [mockPrimaryDisplay, secondaryDisplay];

      const manager = new CompanionPositionManager({ userDataDirectory: tempDir });
      const { BrowserWindow, screen } = await import("electron");
      const window = new BrowserWindow({ width: 250, height: 300 });
      manager.attachWindow(window);

      // Window is positioned on secondary monitor
      window.setBounds({ x: 2100, y: 300, width: 250, height: 300 });
      (window as unknown as { emit: (e: string) => void }).emit("move");
      manager.flush();

      // Now monitor 2 is disconnected!
      mockDisplays = [mockPrimaryDisplay];
      (screen as unknown as { emit: (e: string, ...args: unknown[]) => void }).emit(
        "display-removed",
        {},
        secondaryDisplay,
      );

      // Window must have been relocated to primary center
      expect(window.getBounds()).toEqual({
        x: 835,
        y: 370,
        width: 250,
        height: 300,
      });

      // Persisted position should be updated to monitor 1
      const filePath = path.join(tempDir, "milo-companion-position.json");
      const saved = JSON.parse(readFileSync(filePath, "utf8"));
      expect(saved.monitorId).toBe("1");
      expect(saved.x).toBe(835);
      expect(saved.y).toBe(370);

      manager.dispose();
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("re-clamps window when display metrics change (e.g. taskbar expansion)", async () => {
    try {
      const manager = new CompanionPositionManager({ userDataDirectory: tempDir });
      const { BrowserWindow, screen } = await import("electron");
      const window = new BrowserWindow({ width: 250, height: 300 });
      manager.attachWindow(window);

      // Position window at bottom right edge
      window.setBounds({ x: 1895, y: 1015, width: 250, height: 300 });
      manager.flush();

      // Screen resolution or taskbar shrinks workArea height to 800
      mockPrimaryDisplay.workArea = { x: 0, y: 0, width: 1920, height: 800 };
      (screen as unknown as { emit: (e: string) => void }).emit("display-metrics-changed");

      // Window y must be clamped to 800 - 25 = 775
      expect(window.getBounds().y).toBe(775);

      manager.dispose();
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
