import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  calculateCenteredPosition,
  calculateCompanionBounds,
  clampWithEdgePeeking,
} from "../src/shared/companion-bounds";
import type { Rectangle, Size } from "../src/shared/position";
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
let mockPrimaryDisplay: MockDisplay | undefined;
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
      getPrimaryDisplay: () => mockPrimaryDisplay as Electron.Display,
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

describe("Adversarial Challenge 1: Extreme Values & Boundary Invariants", () => {
  const standardWorkArea: Rectangle = { x: 0, y: 0, width: 1920, height: 1080 };
  const companionSize: Size = { width: 250, height: 300 };

  it("stress-tests extreme negative values: x = -999999, y = -999999", () => {
    const clamped = clampWithEdgePeeking(
      { x: -999999, y: -999999 },
      companionSize,
      standardWorkArea,
      25,
    );

    // minX = 0 - 250 + 25 = -225
    // minY = 0 - 300 + 25 = -275
    expect(clamped.x).toBe(-225);
    expect(clamped.y).toBe(-275);

    // Empirical verification of edge peeking invariant: exactly 25px visible inside workArea
    const visibleWidth = clamped.x + companionSize.width - standardWorkArea.x;
    const visibleHeight = clamped.y + companionSize.height - standardWorkArea.y;
    expect(visibleWidth).toBe(25);
    expect(visibleHeight).toBe(25);
  });

  it("stress-tests extreme positive values: x = 999999, y = 999999", () => {
    const clamped = clampWithEdgePeeking(
      { x: 999999, y: 999999 },
      companionSize,
      standardWorkArea,
      25,
    );

    // maxX = 0 + 1920 - 25 = 1895
    // maxY = 0 + 1080 - 25 = 1055
    expect(clamped.x).toBe(1895);
    expect(clamped.y).toBe(1055);

    // Empirical verification of edge peeking invariant: exactly 25px visible inside workArea
    const visibleWidth = (standardWorkArea.x + standardWorkArea.width) - clamped.x;
    const visibleHeight = (standardWorkArea.y + standardWorkArea.height) - clamped.y;
    expect(visibleWidth).toBe(25);
    expect(visibleHeight).toBe(25);
  });

  it("verifies companionPositionSchema safety limits reject extreme coordinates (> 100,000)", () => {
    const extremePos = { x: 999999, y: 999999, monitorId: "1", version: 1 };
    const parseResult = companionPositionSchema.safeParse(extremePos);
    expect(parseResult.success).toBe(false);

    const extremeNeg = { x: -999999, y: -999999, monitorId: "1", version: 1 };
    const parseNegResult = companionPositionSchema.safeParse(extremeNeg);
    expect(parseNegResult.success).toBe(false);
  });
});

describe("Adversarial Challenge 2: Negative Coordinate Displays", () => {
  const companionSize: Size = { width: 250, height: 300 };

  it("handles secondary display placed left and above primary: x = -1920, y = -1080", () => {
    const negativeWorkArea: Rectangle = { x: -1920, y: -1080, width: 1920, height: 1080 };
    const bounds = calculateCompanionBounds(companionSize, negativeWorkArea, 25);

    // minX = -1920 - 250 + 25 = -2145
    // maxX = -1920 + 1920 - 25 = -25
    // minY = -1080 - 300 + 25 = -1355
    // maxY = -1080 + 1080 - 25 = -25
    expect(bounds).toEqual({
      minX: -2145,
      maxX: -25,
      minY: -1355,
      maxY: -25,
    });

    // Stress clamp at extreme left & top
    const farLeftTop = clampWithEdgePeeking({ x: -999999, y: -999999 }, companionSize, negativeWorkArea, 25);
    expect(farLeftTop.x).toBe(-2145);
    expect(farLeftTop.y).toBe(-1355);
    expect(farLeftTop.x + companionSize.width - negativeWorkArea.x).toBe(25);
    expect(farLeftTop.y + companionSize.height - negativeWorkArea.y).toBe(25);

    // Stress clamp at extreme right & bottom
    const farRightBottom = clampWithEdgePeeking({ x: 999999, y: 999999 }, companionSize, negativeWorkArea, 25);
    expect(farRightBottom.x).toBe(-25);
    expect(farRightBottom.y).toBe(-25);
    expect((negativeWorkArea.x + negativeWorkArea.width) - farRightBottom.x).toBe(25);
    expect((negativeWorkArea.y + negativeWorkArea.height) - farRightBottom.y).toBe(25);

    // Fallback centering on negative monitor
    const centered = calculateCenteredPosition(companionSize, negativeWorkArea);
    // targetX = -1920 + (1920 - 250)/2 = -1920 + 835 = -1085
    // targetY = -1080 + (1080 - 300)/2 = -1080 + 390 = -690
    expect(centered).toEqual({ x: -1085, y: -690 });
  });

  it("handles secondary display placed to the right with non-zero y offset", () => {
    const rightDisplay: Rectangle = { x: 1920, y: 200, width: 2560, height: 1440 };
    const bounds = calculateCompanionBounds(companionSize, rightDisplay, 25);

    // minX = 1920 - 250 + 25 = 1695
    // maxX = 1920 + 2560 - 25 = 4455
    // minY = 200 - 300 + 25 = -75
    // maxY = 200 + 1440 - 25 = 1615
    expect(bounds).toEqual({
      minX: 1695,
      maxX: 4455,
      minY: -75,
      maxY: 1615,
    });
  });
});

describe("Adversarial Challenge 3: Non-Standard Resolutions & Aspect Ratios", () => {
  const companionSize: Size = { width: 250, height: 300 };

  it("handles 8K UHD display (7680x4320)", () => {
    const display8k: Rectangle = { x: 0, y: 0, width: 7680, height: 4320 };
    const bounds = calculateCompanionBounds(companionSize, display8k, 25);
    expect(bounds).toEqual({
      minX: -225,
      maxX: 7655,
      minY: -275,
      maxY: 4295,
    });

    const centered = calculateCenteredPosition(companionSize, display8k);
    expect(centered).toEqual({
      x: Math.round((7680 - 250) / 2), // 3715
      y: Math.round((4320 - 300) / 2), // 2010
    });
  });

  it("handles 32:9 Super Ultrawide display (5120x1440)", () => {
    const ultrawide: Rectangle = { x: 0, y: 0, width: 5120, height: 1440 };
    const bounds = calculateCompanionBounds(companionSize, ultrawide, 25);
    expect(bounds).toEqual({
      minX: -225,
      maxX: 5095,
      minY: -275,
      maxY: 1415,
    });

    const centered = calculateCenteredPosition(companionSize, ultrawide);
    expect(centered).toEqual({
      x: 2435,
      y: 570,
    });
  });

  it("handles vertical 9:16 portrait display (1080x1920)", () => {
    const portrait: Rectangle = { x: 1920, y: 0, width: 1080, height: 1920 };
    const bounds = calculateCompanionBounds(companionSize, portrait, 25);
    expect(bounds).toEqual({
      minX: 1695,
      maxX: 2975,
      minY: -275,
      maxY: 1895,
    });

    const centered = calculateCenteredPosition(companionSize, portrait);
    expect(centered).toEqual({
      x: 1920 + Math.round((1080 - 250) / 2), // 2335
      y: Math.round((1920 - 300) / 2),        // 810
    });
  });

  it("stress-tests tiny virtual displays where display width < companion window width (e.g. 100x150)", () => {
    const tinyDisplay: Rectangle = { x: 0, y: 0, width: 100, height: 150 };
    const bounds = calculateCompanionBounds(companionSize, tinyDisplay, 25);

    // minX = 0 - 250 + 25 = -225
    // maxX = Math.max(-225, 0 + 100 - 25) = 75
    // minY = 0 - 300 + 25 = -275
    // maxY = Math.max(-275, 0 + 150 - 25) = 125
    expect(bounds.minX).toBe(-225);
    expect(bounds.maxX).toBe(75);
    expect(bounds.minY).toBe(-275);
    expect(bounds.maxY).toBe(125);
    expect(bounds.maxX).toBeGreaterThanOrEqual(bounds.minX);
    expect(bounds.maxY).toBeGreaterThanOrEqual(bounds.minY);

    const centered = calculateCenteredPosition(companionSize, tinyDisplay);
    // targetX = (100 - 250) / 2 = -75
    // targetY = (150 - 300) / 2 = -75
    expect(centered).toEqual({ x: -75, y: -75 });
    // Verify coordinates are safely finite and clamped
    expect(Number.isFinite(centered.x)).toBe(true);
    expect(Number.isFinite(centered.y)).toBe(true);
  });

  it("stress-tests micro displays where width < 25px (e.g. 10x10)", () => {
    const microDisplay: Rectangle = { x: 0, y: 0, width: 10, height: 10 };
    const bounds = calculateCompanionBounds(companionSize, microDisplay, 25);

    // peekX = 25
    // minX = 0 - 250 + 25 = -225
    // maxX = Math.max(-225, 0 + 10 - 25) = -15
    // minY = 0 - 300 + 25 = -275
    // maxY = Math.max(-275, 0 + 10 - 25) = -15
    expect(bounds.minX).toBe(-225);
    expect(bounds.maxX).toBe(-15);
    expect(bounds.maxX).toBeGreaterThanOrEqual(bounds.minX);
    expect(bounds.maxY).toBeGreaterThanOrEqual(bounds.minY);

    const clamped = clampWithEdgePeeking({ x: 0, y: 0 }, companionSize, microDisplay, 25);
    expect(clamped.x).toBe(-15);
    expect(clamped.y).toBe(-15);
  });
});

describe("Adversarial Challenge 4: NaN, Infinity, -Infinity & Corrupted Coordinate Inputs", () => {
  const standardWorkArea: Rectangle = { x: 50, y: 60, width: 1920, height: 1080 };
  const companionSize: Size = { width: 250, height: 300 };

  it("failsafe recovers to workArea origin when coordinate inputs are NaN", () => {
    const clamped = clampWithEdgePeeking(
      { x: Number.NaN, y: Number.NaN },
      companionSize,
      standardWorkArea,
      25,
    );

    // Raw points fallback to workArea.x = 50, workArea.y = 60, which are in bounds
    expect(clamped.x).toBe(50);
    expect(clamped.y).toBe(60);
  });

  it("failsafe recovers to workArea origin when coordinate inputs are Infinity or -Infinity", () => {
    const clampedInf = clampWithEdgePeeking(
      { x: Number.POSITIVE_INFINITY, y: Number.NEGATIVE_INFINITY },
      companionSize,
      standardWorkArea,
      25,
    );
    expect(clampedInf.x).toBe(50);
    expect(clampedInf.y).toBe(60);

    const clampedRev = clampWithEdgePeeking(
      { x: Number.NEGATIVE_INFINITY, y: Number.POSITIVE_INFINITY },
      companionSize,
      standardWorkArea,
      25,
    );
    expect(clampedRev.x).toBe(50);
    expect(clampedRev.y).toBe(60);
  });

  it("failsafe recovers when one coordinate is NaN and other is valid", () => {
    const mixed = clampWithEdgePeeking(
      { x: Number.NaN, y: 500 },
      companionSize,
      standardWorkArea,
      25,
    );
    expect(mixed.x).toBe(50);
    expect(mixed.y).toBe(500);
  });
});

describe("Adversarial Challenge 5: Multi-Monitor Recovery — String vs Number Display IDs", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), "milo-adversarial-multimon-"));
    mockPrimaryDisplay = {
      id: 1,
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      workArea: { x: 0, y: 0, width: 1920, height: 1040 },
    };
    mockDisplays = [mockPrimaryDisplay];
  });

  it("safely resolves numeric display ID (e.g. 2528732444) matching string in position file", () => {
    try {
      const secondary: MockDisplay = {
        id: 2528732444, // Numeric 32-bit/64-bit ID from Windows Display API
        bounds: { x: 1920, y: 0, width: 1920, height: 1080 },
        workArea: { x: 1920, y: 0, width: 1920, height: 1040 },
      };
      mockDisplays = [mockPrimaryDisplay!, secondary];

      const filePath = path.join(tempDir, "milo-companion-position.json");
      writeFileSync(
        filePath,
        JSON.stringify({ x: 2200, y: 400, monitorId: "2528732444", version: 1 }),
        "utf8",
      );

      const manager = new CompanionPositionManager({ userDataDirectory: tempDir });
      const pos = manager.loadInitialPosition();

      // Successfully recognizes numeric 2528732444 against string "2528732444"
      expect(pos.monitorId).toBe("2528732444");
      expect(pos.x).toBe(2200);
      expect(pos.y).toBe(400);

      manager.dispose();
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("safely recovers when saved monitorId is missing or null", () => {
    try {
      const filePath = path.join(tempDir, "milo-companion-position.json");
      writeFileSync(
        filePath,
        JSON.stringify({ x: 500, y: 500 }), // monitorId omitted
        "utf8",
      );

      const manager = new CompanionPositionManager({ userDataDirectory: tempDir });
      const pos = manager.loadInitialPosition();

      // Corrupt/missing monitorId triggers fallback to primary center
      expect(pos.monitorId).toBe("1");
      expect(pos.x).toBe(835);
      expect(pos.y).toBe(370);

      manager.dispose();
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("safely handles disconnected monitor when screen.getAllDisplays() has only primary", () => {
    try {
      const filePath = path.join(tempDir, "milo-companion-position.json");
      // Saved on monitor "98765" which is disconnected
      writeFileSync(
        filePath,
        JSON.stringify({ x: 3000, y: 800, monitorId: "98765", version: 1 }),
        "utf8",
      );

      const manager = new CompanionPositionManager({ userDataDirectory: tempDir });
      const pos = manager.loadInitialPosition();

      expect(pos.monitorId).toBe("1");
      expect(pos.x).toBe(835);
      expect(pos.y).toBe(370);

      manager.dispose();
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("handles dynamic display-removed when unplugging active secondary monitor", async () => {
    try {
      const secondary: MockDisplay = {
        id: 2,
        bounds: { x: 1920, y: 0, width: 1920, height: 1080 },
        workArea: { x: 1920, y: 0, width: 1920, height: 1040 },
      };
      mockDisplays = [mockPrimaryDisplay!, secondary];

      const { BrowserWindow, screen } = await import("electron");
      const window = new BrowserWindow({ width: 250, height: 300 });

      const manager = new CompanionPositionManager({ userDataDirectory: tempDir });
      manager.attachWindow(window);

      // Place window on monitor 2
      window.setBounds({ x: 2000, y: 400, width: 250, height: 300 });
      (window as unknown as { emit: (e: string) => void }).emit("move");
      manager.flush();

      // Unplug secondary monitor
      mockDisplays = [mockPrimaryDisplay!];
      (screen as unknown as { emit: (e: string, ...args: unknown[]) => void }).emit(
        "display-removed",
        {},
        secondary,
      );

      // Window must snap to primary display center
      expect(window.getBounds()).toEqual({
        x: 835,
        y: 370,
        width: 250,
        height: 300,
      });

      // Position file must be updated with primary monitor ID
      const saved = JSON.parse(
        readFileSync(path.join(tempDir, "milo-companion-position.json"), "utf8"),
      );
      expect(saved.monitorId).toBe("1");
      expect(saved.x).toBe(835);
      expect(saved.y).toBe(370);

      manager.dispose();
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("safely recovers when screen.getAllDisplays() is empty [] but primary display is defined", () => {
    try {
      mockDisplays = []; // empty getAllDisplays
      const filePath = path.join(tempDir, "milo-companion-position.json");
      writeFileSync(
        filePath,
        JSON.stringify({ x: 500, y: 500, monitorId: "1", version: 1 }),
        "utf8",
      );

      const manager = new CompanionPositionManager({ userDataDirectory: tempDir });
      const pos = manager.loadInitialPosition();

      // targetDisplay not found in empty getAllDisplays -> falls back to primary display center
      expect(pos.monitorId).toBe("1");
      expect(pos.x).toBe(835);
      expect(pos.y).toBe(370);

      manager.dispose();
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("fails explicitly when primary display is completely undefined in headless/mock environment", () => {
    try {
      mockDisplays = [];
      mockPrimaryDisplay = undefined;

      const manager = new CompanionPositionManager({ userDataDirectory: tempDir });
      // In Electron getPrimaryDisplay() returns Display; if absent, reading workArea throws TypeError
      expect(() => manager.loadInitialPosition()).toThrow(TypeError);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("handles display-removed when unplugging an INACTIVE monitor (window stays in place)", async () => {
    try {
      const secondary: MockDisplay = {
        id: 2,
        bounds: { x: 1920, y: 0, width: 1920, height: 1080 },
        workArea: { x: 1920, y: 0, width: 1920, height: 1040 },
      };
      mockDisplays = [mockPrimaryDisplay!, secondary];

      const { BrowserWindow, screen } = await import("electron");
      const window = new BrowserWindow({ width: 250, height: 300 });

      const manager = new CompanionPositionManager({ userDataDirectory: tempDir });
      manager.attachWindow(window);

      // Place window on primary monitor (monitor 1) at (500, 500)
      window.setBounds({ x: 500, y: 500, width: 250, height: 300 });
      (window as unknown as { emit: (e: string) => void }).emit("move");
      manager.flush();

      // Now secondary monitor (id 2) is unplugged
      mockDisplays = [mockPrimaryDisplay!];
      (screen as unknown as { emit: (e: string, ...args: unknown[]) => void }).emit(
        "display-removed",
        {},
        secondary,
      );

      // Window must NOT move — it was already on primary!
      expect(window.getBounds().x).toBe(500);
      expect(window.getBounds().y).toBe(500);

      manager.dispose();
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
