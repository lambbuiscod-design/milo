import { describe, expect, it, vi, beforeEach } from "vitest";
import { createOverlayWindow } from "../src/main/window";
import {
  OverlayController,
  COLLAPSED_OVERLAY_SIZE,
  BUBBLE_OVERLAY_SIZE,
  PREFERRED_EXPANDED_SIZE,
} from "../src/main/overlay-controller";
import { registerDesktopIpc } from "../src/main/desktop-ipc";
import {
  DEFAULT_SUGGESTION_HOTKEY,
  registerSuggestionHotkey,
  type GlobalShortcutAdapter,
} from "../src/main/suggestion-hotkey";
import {
  anchorFromExpandedBounds,
  resolvePanelBounds,
  type Point,
  type Rectangle,
} from "../src/shared/position";
import type { DesktopCapturerApi } from "../src/main/window-capturer";
import { WindowCaptureService } from "../src/main/window-capturer";
import type { DesktopOcrEngineApi } from "../src/main/ocr-engine";
import { IPC_CHANNELS, type PanelPlacement } from "../src/shared/contracts";

const registeredIpcHandlers = new Map<string, (event: any, payload: unknown) => Promise<unknown>>();
const clipboardWritten: Array<{ text: string; type?: string }> = [];
let mockSources: Array<{ id: string; name: string; thumbnail: any }> = [];

vi.mock("electron", () => {
  class MockBrowserWindow {
    options: any;
    bounds: Rectangle = { x: 100, y: 100, width: 168, height: 174 };
    focusable: boolean;
    listeners: Record<string, Function[]> = {};

    constructor(options: any) {
      this.options = options;
      this.focusable = options.focusable ?? true;
    }

    isDestroyed = () => false;
    getBounds = () => ({ ...this.bounds });
    setBounds = (bounds: Rectangle) => {
      this.bounds = { ...bounds };
    };
    setFocusable = vi.fn((val: boolean) => {
      this.focusable = val;
    });
    isFocusable = () => this.focusable;
    setOpacity = vi.fn();
    setAlwaysOnTop = vi.fn();
    getMediaSourceId = () => "window:milo-self";
    webContents = {
      id: 1,
      isDestroyed: () => false,
      send: vi.fn(),
      mainFrame: { url: "milo://app/index.html", isDestroyed: () => false },
    };
    on = (event: string, cb: Function) => {
      this.listeners[event] = this.listeners[event] || [];
      this.listeners[event].push(cb);
    };
    removeListener = (event: string, cb: Function) => {
      if (!this.listeners[event]) return;
      this.listeners[event] = this.listeners[event].filter((f) => f !== cb);
    };
  }

  return {
    BrowserWindow: MockBrowserWindow,
    screen: {
      getPrimaryDisplay: () => ({
        id: "1",
        workArea: { x: 0, y: 0, width: 1920, height: 1040 },
      }),
      getDisplayNearestPoint: () => ({
        id: "1",
        workArea: { x: 0, y: 0, width: 1920, height: 1040 },
      }),
      on: vi.fn(),
      removeListener: vi.fn(),
    },
    ipcMain: {
      handle: vi.fn((channel: string, handler: (event: any, payload: unknown) => Promise<unknown>) => {
        registeredIpcHandlers.set(channel, handler);
      }),
      removeHandler: vi.fn((channel: string) => {
        registeredIpcHandlers.delete(channel);
      }),
    },
    clipboard: {
      writeText: vi.fn((text: string, type?: string) => {
        clipboardWritten.push({ text, type });
      }),
    },
    desktopCapturer: {
      getSources: vi.fn(async () => mockSources),
    },
    globalShortcut: {
      register: vi.fn(() => true),
      unregister: vi.fn(),
    },
    app: {
      quit: vi.fn(),
      isPackaged: false,
      getAppPath: vi.fn(() => "C:\\Milo\\apps\\desktop"),
    },
    Menu: {
      buildFromTemplate: vi.fn(() => ({
        popup: vi.fn(),
      })),
    },
  };
});

function createMockSettingsStore(initialPaused = false) {
  let paused = initialPaused;
  let savedPos: Point | null = null;
  return {
    getPaused: () => paused,
    setPaused: (val: boolean) => {
      paused = val;
    },
    getPublicSettings: () => ({
      theme: "system" as const,
      motion: "system" as const,
      showWatchingIndicator: true,
      soundEnabled: true,
      soundVolume: 0.7,
      noticeSoundEnabled: false,
      activeTone: "standard" as const,
      opacity: 1.0,
      isPinned: true,
      dockMode: "follow-window" as const,
    }),
    updatePublicSettings: vi.fn((patch: unknown) => patch),
    getOverlayPosition: () => savedPos,
    setOverlayPosition: (_id: string, pos: Point) => {
      savedPos = pos;
    },
  };
}

describe("Adversarial Challenge: Focus-Stealing & Window Creation Invariants", () => {
  it("verifies createOverlayWindow specifies focusable: false (Win32 WS_EX_NOACTIVATE)", () => {
    const win = createOverlayWindow("fake/preload/path.js") as any;
    expect(win.options.focusable).toBe(false);
    expect(win.options.transparent).toBe(true);
    expect(win.options.frame).toBe(false);
    expect(win.options.alwaysOnTop).toBe(true);
    expect(win.options.width).toBe(COLLAPSED_OVERLAY_SIZE.width);
    expect(win.options.height).toBe(COLLAPSED_OVERLAY_SIZE.height);
  });

  it("verifies focusable transitions: false by default, true ONLY when panel is open, false when closed", () => {
    const win = createOverlayWindow("fake/preload/path.js") as any;
    const settings = createMockSettingsStore();
    const controller = new OverlayController(win, settings as any);
    controller.initialize();

    // Initial state: not focusable
    expect(win.isFocusable()).toBe(false);

    // Opening bubbles state must NOT enable focusable!
    controller.setBubblesOpen(true);
    expect(controller.isBubblesOpen()).toBe(true);
    expect(win.isFocusable()).toBe(false);

    // Closing bubbles state leaves focusable false
    controller.setBubblesOpen(false);
    expect(controller.isBubblesOpen()).toBe(false);
    expect(win.isFocusable()).toBe(false);

    // Opening settings panel MUST enable focusable (for typing into inputs)
    controller.setPanelOpen(true);
    expect(controller.isPanelOpen()).toBe(true);
    expect(win.setFocusable).toHaveBeenCalledWith(true);
    expect(win.isFocusable()).toBe(true);

    // Closing settings panel MUST restore focusable: false
    controller.setPanelOpen(false);
    expect(controller.isPanelOpen()).toBe(false);
    expect(win.setFocusable).toHaveBeenCalledWith(false);
    expect(win.isFocusable()).toBe(false);

    controller.dispose();
  });
});

describe("Adversarial Challenge: Geometry & Anchor Stability across Pop-Out Bubbles Lifecycle", () => {
  it("preserves exact anchor coordinate across Collapsed -> Bubbles -> Panel -> Collapsed transitions", () => {
    const win = createOverlayWindow("fake/preload/path.js") as any;
    const settings = createMockSettingsStore();
    const controller = new OverlayController(win, settings as any);
    controller.initialize();

    const initialBounds = win.getBounds();
    expect(initialBounds.width).toBe(COLLAPSED_OVERLAY_SIZE.width);
    expect(initialBounds.height).toBe(COLLAPSED_OVERLAY_SIZE.height);
    const originalAnchor = { x: initialBounds.x, y: initialBounds.y };

    // 1. Transition to Bubbles
    controller.setBubblesOpen(true);
    const bubbleBounds = win.getBounds();
    expect(bubbleBounds.width).toBe(BUBBLE_OVERLAY_SIZE.width);
    expect(bubbleBounds.height).toBe(BUBBLE_OVERLAY_SIZE.height);
    const anchorFromBubble = anchorFromExpandedBounds(
      bubbleBounds,
      COLLAPSED_OVERLAY_SIZE,
      controller.placement,
    );
    expect(anchorFromBubble).toEqual(originalAnchor);

    // 2. Transition from Bubbles directly to Expanded Settings Panel
    controller.setPanelOpen(true);
    const panelBounds = win.getBounds();
    expect(panelBounds.width).toBe(PREFERRED_EXPANDED_SIZE.width);
    expect(panelBounds.height).toBe(PREFERRED_EXPANDED_SIZE.height);
    const anchorFromPanel = anchorFromExpandedBounds(
      panelBounds,
      COLLAPSED_OVERLAY_SIZE,
      controller.placement,
    );
    expect(anchorFromPanel).toEqual(originalAnchor);

    // 3. Close panel while bubbles were originally open -> returns to bubbles if bubblesOpen was true
    // Or if setBubblesOpen(false) was called, returns to collapsed avatar
    controller.setBubblesOpen(false);
    controller.setPanelOpen(false);
    const returnedBounds = win.getBounds();
    expect(returnedBounds.width).toBe(COLLAPSED_OVERLAY_SIZE.width);
    expect(returnedBounds.height).toBe(COLLAPSED_OVERLAY_SIZE.height);
    expect({ x: returnedBounds.x, y: returnedBounds.y }).toEqual(originalAnchor);

    controller.dispose();
  });

  it("verifies anchor stability for all 4 monitor quadrants (right-down, right-up, left-down, left-up)", () => {
    const workArea = { x: 0, y: 0, width: 1920, height: 1040 };
    const testAnchors: Array<{ name: PanelPlacement; anchor: Rectangle }> = [
      { name: "right-down", anchor: { x: 100, y: 100, width: 168, height: 174 } },
      { name: "left-up", anchor: { x: 1700, y: 800, width: 168, height: 174 } },
      { name: "right-up", anchor: { x: 100, y: 800, width: 168, height: 174 } },
      { name: "left-down", anchor: { x: 1700, y: 100, width: 168, height: 174 } },
    ];

    for (const { name, anchor } of testAnchors) {
      // Test bubble overlay bounds
      const bubbleResolved = resolvePanelBounds(anchor, BUBBLE_OVERLAY_SIZE, workArea);
      expect(bubbleResolved.placement).toBe(name);
      const recoveredFromBubble = anchorFromExpandedBounds(
        bubbleResolved.bounds,
        COLLAPSED_OVERLAY_SIZE,
        bubbleResolved.placement,
      );
      expect(recoveredFromBubble).toEqual({ x: anchor.x, y: anchor.y });

      // Test expanded panel overlay bounds
      const panelResolved = resolvePanelBounds(anchor, PREFERRED_EXPANDED_SIZE, workArea);
      expect(panelResolved.placement).toBe(name);
      const recoveredFromPanel = anchorFromExpandedBounds(
        panelResolved.bounds,
        COLLAPSED_OVERLAY_SIZE,
        panelResolved.placement,
      );
      expect(recoveredFromPanel).toEqual({ x: anchor.x, y: anchor.y });
    }
  });
});

describe("Adversarial Challenge: Concurrency & Rapid Hotkey Triggers", () => {
  beforeEach(() => {
    registeredIpcHandlers.clear();
    clipboardWritten.length = 0;
    mockSources = [
      {
        id: "window:1234:0",
        name: "ActiveChat",
        thumbnail: {
          isEmpty: () => false,
          getSize: () => ({ width: 800, height: 600 }),
          toPNG: () => Buffer.from("fake-png-data"),
        },
      },
    ];
  });

  it("stress-tests 50 concurrent rapid hotkey triggers without unhandled rejections or corrupt state", async () => {
    let hotkeyCallback: (() => Promise<void> | void) | null = null;
    const shortcutAdapter: GlobalShortcutAdapter = {
      register: vi.fn((_acc, cb) => {
        hotkeyCallback = cb;
        return true;
      }),
      unregister: vi.fn(),
    };

    let inFlightSuggestions = 0;
    let maxConcurrent = 0;
    let totalSuggestionsCompleted = 0;

    const mockWindow = createOverlayWindow("fake/preload.js") as any;
    const mockSettings = createMockSettingsStore();
    const mockOverlay = new OverlayController(mockWindow, mockSettings as any);
    mockOverlay.initialize();

    const mockCapturer: DesktopCapturerApi = {
      getSources: vi.fn(async () => mockSources as any),
    };
    const captureService = new WindowCaptureService(mockCapturer);

    const mockOcrEngine: DesktopOcrEngineApi = {
      initialize: vi.fn(async () => undefined),
      extractFromBuffer: vi.fn(async () => {
        inFlightSuggestions++;
        maxConcurrent = Math.max(maxConcurrent, inFlightSuggestions);
        // Simulate async delay
        await new Promise((r) => setTimeout(r, 20));
        inFlightSuggestions--;
        return {
          rawText: "Conversation context text",
          normalizedText: "Conversation context text",
          confidence: 95,
          durationMs: 20,
        };
      }),
      terminate: vi.fn(async () => undefined),
    };

    const mockSuggestionClient = {
      suggest: vi.fn(async () => {
        totalSuggestionsCompleted++;
        return {
          replies: [
            { category: "safe" as const, text: "Safe reply", whyItWorks: "Friendly" },
            { category: "confident" as const, text: "Confident reply", whyItWorks: "Direct" },
            { category: "playful" as const, text: "Playful reply", whyItWorks: "Humorous" },
          ],
          warning: null,
        };
      }),
    };

    const mockAuthSession = {
      getAccessToken: vi.fn(async () => "test-token"),
      getSnapshot: vi.fn(() => ({
        status: "authenticated" as const,
        expiresAt: null,
        storageAvailable: true,
      })),
      signIn: vi.fn(),
      signOut: vi.fn(),
    };

    const mockNativeHelper = {
      listWindows: vi.fn(async () => []),
      suspend: vi.fn(),
      requestContext: vi.fn(),
      isAvailable: vi.fn(() => false),
    };

    const dispose = registerDesktopIpc({
      window: mockWindow,
      overlay: mockOverlay,
      settingsStore: mockSettings as any,
      nativeHelper: mockNativeHelper as any,
      authSession: mockAuthSession as any,
      suggestionClient: mockSuggestionClient as any,
      accountOpener: vi.fn(),
      windowCaptureService: captureService,
      ocrEngine: mockOcrEngine,
      shortcutApi: shortcutAdapter,
    });

    expect(hotkeyCallback).not.toBeNull();

    // Fire 50 rapid hotkey triggers simultaneously
    const triggers = Array.from({ length: 50 }, () => hotkeyCallback!());
    await Promise.all(triggers);

    // Wait for async execution
    await vi.waitFor(() => {
      expect(totalSuggestionsCompleted).toBeGreaterThanOrEqual(1);
    });

    // In-flight guard must ensure at most 1 suggestion runs concurrently
    expect(maxConcurrent).toBe(1);

    // Window bounds must be in bubbles state (520x480)
    const bounds = mockWindow.getBounds();
    expect(bounds.width).toBe(BUBBLE_OVERLAY_SIZE.width);
    expect(bounds.height).toBe(BUBBLE_OVERLAY_SIZE.height);

    // Overlay must NOT be in panel open state
    expect(mockOverlay.isPanelOpen()).toBe(false);
    expect(mockOverlay.isBubblesOpen()).toBe(true);

    dispose();
    mockOverlay.dispose();
  });

  it("handles hotkey when no candidate windows exist without throwing or crashing", async () => {
    mockSources = []; // No windows available
    let hotkeyCallback: (() => Promise<void> | void) | null = null;
    const shortcutAdapter: GlobalShortcutAdapter = {
      register: vi.fn((_acc, cb) => {
        hotkeyCallback = cb;
        return true;
      }),
      unregister: vi.fn(),
    };

    const mockWindow = createOverlayWindow("fake/preload.js") as any;
    const mockSettings = createMockSettingsStore();
    const mockOverlay = new OverlayController(mockWindow, mockSettings as any);
    mockOverlay.initialize();

    const mockCapturer: DesktopCapturerApi = {
      getSources: vi.fn(async () => []),
    };
    const captureService = new WindowCaptureService(mockCapturer);

    const dispose = registerDesktopIpc({
      window: mockWindow,
      overlay: mockOverlay,
      settingsStore: mockSettings as any,
      nativeHelper: { listWindows: vi.fn(async () => []), suspend: vi.fn() } as any,
      authSession: { getAccessToken: vi.fn(), getSnapshot: vi.fn() } as any,
      suggestionClient: { suggest: vi.fn() } as any,
      accountOpener: vi.fn(),
      windowCaptureService: captureService,
      ocrEngine: {
        initialize: () => Promise.resolve(),
        extractFromBuffer: () => Promise.resolve({ rawText: "", normalizedText: "", confidence: 0, durationMs: 0 }),
        terminate: () => Promise.resolve(),
      } as any,
      shortcutApi: shortcutAdapter,
    });

    // Trigger hotkey with no windows available — must not throw uncaught error
    expect(() => hotkeyCallback!()).not.toThrow();

    await new Promise((r) => setTimeout(r, 50));

    // Bounds remain collapsed
    expect(mockOverlay.isBubblesOpen()).toBe(false);
    expect(mockOverlay.isPanelOpen()).toBe(false);

    dispose();
    mockOverlay.dispose();
  });

  it("handles hotkey when Milo is paused by failing closed", async () => {
    let hotkeyCallback: (() => Promise<void> | void) | null = null;
    const shortcutAdapter: GlobalShortcutAdapter = {
      register: vi.fn((_acc, cb) => {
        hotkeyCallback = cb;
        return true;
      }),
      unregister: vi.fn(),
    };

    const mockWindow = createOverlayWindow("fake/preload.js") as any;
    const mockSettings = createMockSettingsStore(true); // Paused
    const mockOverlay = new OverlayController(mockWindow, mockSettings as any);
    mockOverlay.initialize();

    const mockCapturer: DesktopCapturerApi = {
      getSources: vi.fn(async () => mockSources as any),
    };

    const dispose = registerDesktopIpc({
      window: mockWindow,
      overlay: mockOverlay,
      settingsStore: mockSettings as any,
      nativeHelper: { listWindows: vi.fn(async () => []), suspend: vi.fn() } as any,
      authSession: { getAccessToken: vi.fn(), getSnapshot: vi.fn() } as any,
      suggestionClient: { suggest: vi.fn() } as any,
      accountOpener: vi.fn(),
      windowCaptureService: new WindowCaptureService(mockCapturer),
      ocrEngine: {
        initialize: () => Promise.resolve(),
        extractFromBuffer: () => Promise.resolve({ rawText: "", normalizedText: "", confidence: 0, durationMs: 0 }),
        terminate: () => Promise.resolve(),
      } as any,
      shortcutApi: shortcutAdapter,
    });

    expect(() => hotkeyCallback!()).not.toThrow();
    await new Promise((r) => setTimeout(r, 50));

    expect(mockOverlay.isBubblesOpen()).toBe(false);

    dispose();
    mockOverlay.dispose();
  });
});

describe("Adversarial Challenge: Copy-and-Close Behavior & Focus Preservation", () => {
  beforeEach(() => {
    registeredIpcHandlers.clear();
    clipboardWritten.length = 0;
  });

  it("verifies copyReply writes to system clipboard, collapses bubbles, and keeps window non-focusable", async () => {
    const mockWindow = createOverlayWindow("fake/preload.js") as any;
    const mockSettings = createMockSettingsStore();
    const mockOverlay = new OverlayController(mockWindow, mockSettings as any);
    mockOverlay.initialize();

    // Start with bubbles open
    mockOverlay.setBubblesOpen(true);
    expect(mockOverlay.isBubblesOpen()).toBe(true);
    expect(mockWindow.isFocusable()).toBe(false);

    const dispose = registerDesktopIpc({
      window: mockWindow,
      overlay: mockOverlay,
      settingsStore: mockSettings as any,
      nativeHelper: { listWindows: vi.fn(async () => []), suspend: vi.fn() } as any,
      authSession: {
        getAccessToken: vi.fn(async () => "token"),
        getSnapshot: vi.fn(() => ({ status: "authenticated", expiresAt: null, storageAvailable: true })),
      } as any,
      suggestionClient: null,
      accountOpener: vi.fn(),
      shortcutApi: { register: vi.fn(() => true), unregister: vi.fn() },
    });

    // Preview state with synthetic suggestions
    const previewHandler = registeredIpcHandlers.get(IPC_CHANNELS.previewState);
    expect(previewHandler).toBeDefined();

    const fakeSenderEvent = {
      sender: mockWindow.webContents,
      senderFrame: {
        url: "milo://app/index.html",
        isDestroyed: () => false,
      },
    };
    mockWindow.webContents.id = 1;
    (fakeSenderEvent.sender as any).id = 1;
    (fakeSenderEvent.sender as any).isDestroyed = () => false;
    (fakeSenderEvent.sender as any).mainFrame = fakeSenderEvent.senderFrame;

    await previewHandler!(fakeSenderEvent, "generate");

    // Bubbles should be open now
    expect(mockOverlay.isBubblesOpen()).toBe(true);

    // Call copyReply IPC
    const copyHandler = registeredIpcHandlers.get(IPC_CHANNELS.copyReply);
    expect(copyHandler).toBeDefined();

    const copyResult: any = await copyHandler!(fakeSenderEvent, { suggestionId: "safe" });
    expect(copyResult.ok).toBe(true);

    // Clipboard writeText was invoked
    expect(clipboardWritten.length).toBe(1);
    expect(clipboardWritten[0]?.type).toBe("clipboard");

    // Bubbles are collapsed!
    expect(mockOverlay.isBubblesOpen()).toBe(false);
    const bounds = mockWindow.getBounds();
    expect(bounds.width).toBe(COLLAPSED_OVERLAY_SIZE.width);
    expect(bounds.height).toBe(COLLAPSED_OVERLAY_SIZE.height);

    // Focusable is STILL false (never stole focus from target app!)
    expect(mockWindow.isFocusable()).toBe(false);

    dispose();
    mockOverlay.dispose();
  });
});
