import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import {
  DEFAULT_SUGGESTION_HOTKEY,
  registerSuggestionHotkey,
  type GlobalShortcutAdapter,
} from "../src/main/suggestion-hotkey";
import {
  COLLAPSED_OVERLAY_SIZE,
  BUBBLE_OVERLAY_SIZE,
  PREFERRED_EXPANDED_SIZE,
  OverlayController,
} from "../src/main/overlay-controller";
import {
  resolvePanelBounds,
  anchorFromExpandedBounds,
} from "../src/shared/position";
import { registerDesktopIpc } from "../src/main/desktop-ipc";
import { IPC_CHANNELS, type PanelPlacement, type SyntheticSuggestion } from "../src/shared/contracts";

const rendererModulePath = "../src/renderer/App";
const { PopoutBubbles } = await import(rendererModulePath);

// Mock Electron primitives
const registeredIpcHandlers = new Map<string, (event: unknown, payload: unknown) => Promise<unknown>>();
const clipboardWritten: Array<{ text: string; type?: string }> = [];
let mockSources: Array<{ id: string; name: string; thumbnail: Pick<Electron.NativeImage, "isEmpty" | "getSize" | "toPNG"> }> = [];

vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (event: unknown, payload: unknown) => Promise<unknown>) => {
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
  screen: {
    getPrimaryDisplay: vi.fn(() => ({
      id: 1,
      workArea: { x: 0, y: 0, width: 1920, height: 1080 },
    })),
    getDisplayNearestPoint: vi.fn(() => ({
      id: 1,
      workArea: { x: 0, y: 0, width: 1920, height: 1080 },
    })),
    on: vi.fn(),
    removeListener: vi.fn(),
  },
}));

function createMockBrowserWindow(initialBounds = { x: 100, y: 100, width: 168, height: 174 }) {
  let bounds = { ...initialBounds };
  let focusable = false;
  const sentMessages: Array<{ channel: string; payload: unknown }> = [];

  const mainFrame = {
    url: "milo://app/index.html",
    isDestroyed: () => false,
  };

  const webContents = {
    id: 99,
    isDestroyed: () => false,
    send: (channel: string, payload: unknown) => {
      sentMessages.push({ channel, payload });
    },
    mainFrame,
  };

  return {
    isDestroyed: () => false,
    webContents,
    getBounds: () => ({ ...bounds }),
    setBounds: vi.fn((newBounds: { x: number; y: number; width: number; height: number }) => {
      bounds = { ...newBounds };
    }),
    setOpacity: vi.fn(),
    setAlwaysOnTop: vi.fn(),
    setFocusable: vi.fn((val: boolean) => {
      focusable = val;
    }),
    isFocusable: () => focusable,
    getMediaSourceId: () => "window:milo-self",
    on: vi.fn(),
    removeListener: vi.fn(),
    sentMessages,
  } as unknown as Electron.BrowserWindow & {
    sentMessages: typeof sentMessages;
    isFocusable: () => boolean;
  };
}

function createMockSettingsStore(initialPosition: { x: number; y: number } | null = null) {
  let paused = false;
  let storedPosition = initialPosition;
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
    getOverlayPosition: () => storedPosition,
    setOverlayPosition: vi.fn((_id: string, pos: { x: number; y: number }) => {
      storedPosition = pos;
    }),
  };
}

describe("CHALLENGER STRESS SUITE 1: Global Hotkey Robustness & Re-entrancy", () => {
  it("verifies platform-specific hotkey accelerator", () => {
    const expected = process.platform === "darwin" ? "Command+S" : "Alt+S";
    expect(DEFAULT_SUGGESTION_HOTKEY).toBe(expected);
  });

  it("handles extreme burst firing (100 concurrent triggers) without overlapping requests", async () => {
    let activeExecutions = 0;
    let maxConcurrent = 0;
    let resolveCurrent: (() => void) | null = null;

    const mockRequest = vi.fn(async () => {
      activeExecutions++;
      maxConcurrent = Math.max(maxConcurrent, activeExecutions);
      await new Promise<void>((res) => {
        resolveCurrent = res;
      });
      activeExecutions--;
    });

    let registeredCb: (() => void) | null = null;
    const adapter: GlobalShortcutAdapter = {
      register: vi.fn((_, cb) => {
        registeredCb = cb;
        return true;
      }),
      unregister: vi.fn(),
    };

    const dispose = registerSuggestionHotkey(adapter, mockRequest);
    expect(registeredCb).not.toBeNull();

    // Fire 100 rapid bursts
    for (let i = 0; i < 100; i++) {
      registeredCb!();
    }

    // Must only have initiated 1 execution while in-flight
    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(maxConcurrent).toBe(1);

    // Complete the first execution and wait for microtask .finally to execute
    resolveCurrent!();
    await new Promise((r) => setTimeout(r, 20));

    // Now fire again, it should execute a second time
    registeredCb!();
    expect(mockRequest).toHaveBeenCalledTimes(2);
    expect(maxConcurrent).toBe(1);

    resolveCurrent!();
    await new Promise((r) => setTimeout(r, 20));

    dispose();
  });

  it("recovers gracefully if requestSuggestion throws or rejects", async () => {
    let registeredCb: (() => void) | null = null;
    const adapter: GlobalShortcutAdapter = {
      register: vi.fn((_, cb) => {
        registeredCb = cb;
        return true;
      }),
      unregister: vi.fn(),
    };

    let shouldFail = true;
    const mockRequest = vi.fn(async () => {
      if (shouldFail) {
        throw new Error("OCR failure or network timeout");
      }
      return;
    });

    const dispose = registerSuggestionHotkey(adapter, mockRequest);

    // 1. Trigger while failing
    registeredCb!();
    await new Promise((r) => setTimeout(r, 20));
    expect(mockRequest).toHaveBeenCalledTimes(1);

    // 2. Trigger again after failure - active flag should have reset
    shouldFail = false;
    registeredCb!();
    await new Promise((r) => setTimeout(r, 20));
    expect(mockRequest).toHaveBeenCalledTimes(2);

    dispose();
  });

  it("handles duplicate dispose() calls safely (idempotent)", () => {
    const adapter: GlobalShortcutAdapter = {
      register: vi.fn(() => true),
      unregister: vi.fn(),
    };
    const dispose = registerSuggestionHotkey(adapter, async () => undefined);
    dispose();
    dispose();
    dispose();
    expect(adapter.unregister).toHaveBeenCalledTimes(1);
  });
});

describe("CHALLENGER STRESS SUITE 2: Pop-Out Bubbles Suggestion Counts & Keyboard Accessibility", () => {
  it("renders 0 suggestions without crashing or throwing", () => {
    const onCopy = vi.fn();
    const html = renderToString(
      React.createElement(PopoutBubbles, {
        replies: [],
        panelPlacement: "right-down",
        copiedSuggestion: null,
        onCopy,
      }),
    );

    expect(html).toContain("popout-bubbles");
    expect(html).toContain("Milo suggestions");
    expect(html).not.toContain("speech-bubble");
  });

  it("renders exactly 1 suggestion with correct DaisyUI badge", () => {
    const onCopy = vi.fn();
    const singleReply: SyntheticSuggestion = {
      id: "safe",
      label: "Safe choice",
      text: "Let me check my calendar.",
      explanation: "Low friction response.",
    };

    const html = renderToString(
      React.createElement(PopoutBubbles, {
        replies: [singleReply],
        panelPlacement: "right-down",
        copiedSuggestion: null,
        onCopy,
      }),
    );

    expect(html).toContain("speech-bubble--safe");
    expect(html).toContain("badge-info");
    expect(html).toContain("Safe");
    expect(html).toContain("Let me check my calendar.");
    expect(html).not.toContain("speech-bubble--confident");
    expect(html).not.toContain("speech-bubble--playful");
  });

  it("renders 2 suggestions correctly", () => {
    const onCopy = vi.fn();
    const twoReplies: SyntheticSuggestion[] = [
      { id: "safe", label: "Safe choice", text: "Text 1", explanation: "Exp 1" },
      { id: "confident", label: "Confident choice", text: "Text 2", explanation: "Exp 2" },
    ];

    const html = renderToString(
      React.createElement(PopoutBubbles, {
        replies: twoReplies,
        panelPlacement: "left-down",
        copiedSuggestion: null,
        onCopy,
      }),
    );

    expect(html).toContain("speech-bubble--safe");
    expect(html).toContain("badge-info");
    expect(html).toContain("speech-bubble--confident");
    expect(html).toContain("badge-primary");
    expect(html).not.toContain("speech-bubble--playful");
  });

  it("renders 4+ suggestions cleanly without breaking layout semantics", () => {
    const onCopy = vi.fn();
    const fourReplies: SyntheticSuggestion[] = [
      { id: "safe", label: "Safe 1", text: "T1", explanation: "E1" },
      { id: "confident", label: "Confident 2", text: "T2", explanation: "E2" },
      { id: "playful", label: "Playful 3", text: "T3", explanation: "E3" },
      { id: "safe", label: "Safe 4", text: "T4", explanation: "E4" },
    ];

    const html = renderToString(
      React.createElement(PopoutBubbles, {
        replies: fourReplies,
        panelPlacement: "right-up",
        copiedSuggestion: null,
        onCopy,
      }),
    );

    expect(html).toContain("popout-bubbles--up");
    expect(html).toContain("popout-bubbles--tail-left");
    expect(html).toContain("T1");
    expect(html).toContain("T4");
  });

  it("provides full ARIA semantics and interactive button contracts", () => {
    const onClose = vi.fn();
    const onCopy = vi.fn();
    const reply: SyntheticSuggestion = {
      id: "confident",
      label: "Confident choice",
      text: "I'm free at 7pm.",
      explanation: "Direct scheduling.",
    };

    const html = renderToString(
      React.createElement(PopoutBubbles, {
        replies: [reply],
        panelPlacement: "right-down",
        copiedSuggestion: null,
        onCopy,
        onClose,
      }),
    );

    // Region, feed, button semantics
    expect(html).toContain('role="region"');
    expect(html).toContain('aria-label="Milo pop-out suggestions"');
    expect(html).toContain('role="feed"');
    expect(html).toContain('aria-label="Suggested replies"');
    expect(html).toContain('role="button"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('aria-label="Copy Confident choice: I&#x27;m free at 7pm."');
    expect(html).toContain('aria-label="Dismiss suggestions"');
  });
});

describe("CHALLENGER STRESS SUITE 3: Long Text, Special Characters & XSS Neutralization", () => {
  it("safely escapes HTML injection attempts (XSS stress)", () => {
    const maliciousReply: SyntheticSuggestion = {
      id: "safe",
      label: "<script>alert('pwned')</script>",
      text: "<img src=x onerror=stealCookies() /> & <b onmouseover=evil()>Hover me</b>",
      explanation: "<b>Test</b> 'quotes' &amp; entities",
    };

    const html = renderToString(
      React.createElement(PopoutBubbles, {
        replies: [maliciousReply],
        panelPlacement: "right-down",
        copiedSuggestion: null,
        onCopy: vi.fn(),
      }),
    );

    // Must be escaped by React HTML entities, NOT injected as active DOM elements
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;alert(&#x27;pwned&#x27;)&lt;/script&gt;");
    expect(html).toContain("&lt;img src=x onerror=stealCookies() /&gt;");
    expect(html).not.toContain("<img src=x");
  });

  it("renders unicode, emoji, CJK and RTL content without corruption", () => {
    const internationalReply: SyntheticSuggestion = {
      id: "playful",
      label: "Playful 🐱",
      text: "مرحبا بك! 🚀 你好世界! 🌸 Bonne soirée ✨",
      explanation: "Multilingual chemistry 🐈‍⬛",
    };

    const html = renderToString(
      React.createElement(PopoutBubbles, {
        replies: [internationalReply],
        panelPlacement: "left-up",
        copiedSuggestion: null,
        onCopy: vi.fn(),
      }),
    );

    expect(html).toContain("مرحبا بك! 🚀 你好世界! 🌸 Bonne soirée ✨");
    expect(html).toContain("Multilingual chemistry 🐈‍⬛");
  });

  it("handles empty strings across all fields without crashing", () => {
    const emptyReply: SyntheticSuggestion = {
      id: "safe",
      label: "",
      text: "",
      explanation: "",
    };

    const html = renderToString(
      React.createElement(PopoutBubbles, {
        replies: [emptyReply],
        panelPlacement: "right-down",
        copiedSuggestion: null,
        onCopy: vi.fn(),
      }),
    );

    expect(html).toContain("speech-bubble");
    expect(html).toContain("speech-bubble__body");
  });
});

describe("CHALLENGER STRESS SUITE 4: Anchor Geometry Across All 4 Placements", () => {
  const workArea = { x: 0, y: 0, width: 1920, height: 1080 };

  it("verifies exact anchor invariance for right-down placement", () => {
    const collapsedAnchor = { x: 50, y: 50, width: 168, height: 174 };
    const resolved = resolvePanelBounds(collapsedAnchor, BUBBLE_OVERLAY_SIZE, workArea);

    expect(resolved.placement).toBe("right-down");
    expect(resolved.bounds).toEqual({ x: 50, y: 50, width: 520, height: 480 });

    const recovered = anchorFromExpandedBounds(resolved.bounds, COLLAPSED_OVERLAY_SIZE, resolved.placement);
    expect(recovered).toEqual({ x: 50, y: 50 });
  });

  it("verifies exact anchor invariance for left-down placement", () => {
    // Anchor positioned near right edge so 1700 + 520 > 1920
    const collapsedAnchor = { x: 1700, y: 50, width: 168, height: 174 };
    const resolved = resolvePanelBounds(collapsedAnchor, BUBBLE_OVERLAY_SIZE, workArea);

    expect(resolved.placement).toBe("left-down");
    // candidate.x = 1700 + 168 - 520 = 1348
    expect(resolved.bounds).toEqual({ x: 1348, y: 50, width: 520, height: 480 });

    const recovered = anchorFromExpandedBounds(resolved.bounds, COLLAPSED_OVERLAY_SIZE, resolved.placement);
    expect(recovered).toEqual({ x: 1700, y: 50 });
  });

  it("verifies exact anchor invariance for right-up placement", () => {
    // Anchor positioned at y=800 so 800 + 480 = 1280 > 1080, but within workArea (800 + 174 = 974 <= 1080)
    const collapsedAnchor = { x: 50, y: 800, width: 168, height: 174 };
    const resolved = resolvePanelBounds(collapsedAnchor, BUBBLE_OVERLAY_SIZE, workArea);

    expect(resolved.placement).toBe("right-up");
    // candidate.y = 800 + 174 - 480 = 494
    expect(resolved.bounds).toEqual({ x: 50, y: 494, width: 520, height: 480 });

    const recovered = anchorFromExpandedBounds(resolved.bounds, COLLAPSED_OVERLAY_SIZE, resolved.placement);
    expect(recovered).toEqual({ x: 50, y: 800 });
  });

  it("verifies exact anchor invariance for left-up placement", () => {
    // Anchor positioned near bottom-right corner within screen bounds
    const collapsedAnchor = { x: 1700, y: 800, width: 168, height: 174 };
    const resolved = resolvePanelBounds(collapsedAnchor, BUBBLE_OVERLAY_SIZE, workArea);

    expect(resolved.placement).toBe("left-up");
    // candidate.x = 1700 + 168 - 520 = 1348
    // candidate.y = 800 + 174 - 480 = 494
    expect(resolved.bounds).toEqual({ x: 1348, y: 494, width: 520, height: 480 });

    const recovered = anchorFromExpandedBounds(resolved.bounds, COLLAPSED_OVERLAY_SIZE, resolved.placement);
    expect(recovered).toEqual({ x: 1700, y: 800 });
  });

  it("stress-tests OverlayController full lifecycle transitions across all 4 placements", () => {
    const testPositions = [
      { pos: { x: 80, y: 80 }, expectedPlacement: "right-down" },
      { pos: { x: 1700, y: 80 }, expectedPlacement: "left-down" },
      { pos: { x: 80, y: 800 }, expectedPlacement: "right-up" },
      { pos: { x: 1700, y: 800 }, expectedPlacement: "left-up" },
    ];

    for (const { pos, expectedPlacement } of testPositions) {
      const mockWin = createMockBrowserWindow({ ...pos, ...COLLAPSED_OVERLAY_SIZE });
      const mockSettings = createMockSettingsStore(pos);
      const controller = new OverlayController(mockWin, mockSettings as unknown as Parameters<typeof registerDesktopIpc>[0]["settingsStore"]);
      controller.initialize();

      expect(controller.isBubblesOpen()).toBe(false);
      expect(controller.isPanelOpen()).toBe(false);

      // 1. Expand bubbles
      controller.setBubblesOpen(true);
      expect(controller.isBubblesOpen()).toBe(true);
      expect(controller.placement).toBe(expectedPlacement);
      expect(mockWin.getBounds().width).toBe(BUBBLE_OVERLAY_SIZE.width);
      expect(mockWin.getBounds().height).toBe(BUBBLE_OVERLAY_SIZE.height);

      // 2. Transition from bubbles directly into expanded settings panel
      controller.setPanelOpen(true);
      expect(controller.isPanelOpen()).toBe(true);
      expect(mockWin.getBounds().width).toBe(PREFERRED_EXPANDED_SIZE.width);
      expect(mockWin.getBounds().height).toBe(PREFERRED_EXPANDED_SIZE.height);
      expect(mockWin.isFocusable()).toBe(true);

      // 3. Close panel back to bubbles
      controller.setPanelOpen(false);
      expect(controller.isPanelOpen()).toBe(false);
      expect(controller.isBubblesOpen()).toBe(true);
      expect(mockWin.getBounds().width).toBe(BUBBLE_OVERLAY_SIZE.width);
      expect(mockWin.getBounds().height).toBe(BUBBLE_OVERLAY_SIZE.height);
      expect(mockWin.isFocusable()).toBe(false);

      // 4. Collapse bubbles back to avatar dock
      controller.setBubblesOpen(false);
      expect(controller.isBubblesOpen()).toBe(false);
      expect(mockWin.getBounds().width).toBe(COLLAPSED_OVERLAY_SIZE.width);
      expect(mockWin.getBounds().height).toBe(COLLAPSED_OVERLAY_SIZE.height);
      expect(mockWin.getBounds().x).toBe(pos.x);
      expect(mockWin.getBounds().y).toBe(pos.y);

      controller.dispose();
    }
  });
});

describe("CHALLENGER STRESS SUITE 5: Copy-and-Close IPC & Focus Preservation", () => {
  beforeEach(() => {
    registeredIpcHandlers.clear();
    clipboardWritten.length = 0;
    mockSources = [
      {
        id: "window:1234:0",
        name: "Discord",
        thumbnail: {
          isEmpty: () => false,
          getSize: () => ({ width: 800, height: 600 }),
          toPNG: () => Buffer.from("fake-png-data"),
        },
      },
    ];
  });

  it("handles copyReply IPC, writes to clipboard, sets lastAction to copied, and collapses bubbles", async () => {
    const mockWindow = createMockBrowserWindow();
    const mockSettings = createMockSettingsStore();
    const mockOverlay = {
      panelOpen: false,
      bubblesOpen: true,
      isBubblesOpen: () => true,
      isPanelOpen: () => false,
      placement: "right-down" as PanelPlacement,
      setBubblesOpen: vi.fn(),
      setPanelOpen: vi.fn(),
      nudge: vi.fn(),
      reset: vi.fn(),
    };

    const mockSuggestionClient = {
      suggest: vi.fn(async () => ({
        replies: [
          { category: "safe" as const, text: "Let's meet tomorrow!", whyItWorks: "Friendly" },
          { category: "confident" as const, text: "Tomorrow at noon.", whyItWorks: "Direct" },
          { category: "playful" as const, text: "Only if you buy lunch ;)", whyItWorks: "Fun" },
        ],
        warning: null,
      })),
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

    const mockOcrEngine = {
      initialize: vi.fn(async () => undefined),
      extractFromBuffer: vi.fn(async () => ({
        rawText: "When are you free to meet?",
        normalizedText: "When are you free to meet?",
        confidence: 95,
        durationMs: 10,
      })),
      terminate: vi.fn(async () => undefined),
    };

    let hotkeyCb: (() => Promise<void> | void) | null = null;
    const mockShortcut: GlobalShortcutAdapter = {
      register: vi.fn((_, cb) => {
        hotkeyCb = cb;
        return true;
      }),
      unregister: vi.fn(),
    };

    const dispose = registerDesktopIpc({
      window: mockWindow,
      overlay: mockOverlay as unknown as OverlayController,
      settingsStore: mockSettings as unknown as Parameters<typeof registerDesktopIpc>[0]["settingsStore"],
      nativeHelper: {
        listWindows: vi.fn(async () => []),
        suspend: vi.fn(),
        requestContext: vi.fn(),
        isAvailable: vi.fn(() => false),
      } as unknown as Parameters<typeof registerDesktopIpc>[0]["nativeHelper"],
      authSession: mockAuthSession as unknown as Parameters<typeof registerDesktopIpc>[0]["authSession"],
      suggestionClient: mockSuggestionClient as unknown as Parameters<typeof registerDesktopIpc>[0]["suggestionClient"],
      accountOpener: vi.fn(),
      windowCaptureService: {
        captureWindow: vi.fn(async () => ({
          imageBuffer: Buffer.from("png"),
          width: 800,
          height: 600,
          capturedAt: Date.now(),
        })),
      } as unknown as Parameters<typeof registerDesktopIpc>[0]["windowCaptureService"],
      ocrEngine: mockOcrEngine,
      shortcutApi: mockShortcut,
    });

    await registeredIpcHandlers.get("milo:select-window")!({
      sender: mockWindow.webContents,
      senderFrame: mockWindow.webContents.mainFrame,
    }, { sourceId: "window:1234:0" });

    // 1. Trigger hotkey to generate suggestions
    hotkeyCb!();
    await vi.waitFor(() => {
      expect(mockOverlay.setBubblesOpen).toHaveBeenCalledWith(true);
    });

    // 2. Invoke copyReply handler via IPC
    const copyHandler = registeredIpcHandlers.get(IPC_CHANNELS.copyReply);
    expect(copyHandler).toBeDefined();

    const mockEvent = {
      sender: mockWindow.webContents,
      senderFrame: mockWindow.webContents.mainFrame,
    };

    // Invoke copying "playful" reply
    const result = await copyHandler!(mockEvent, { suggestionId: "playful" }) as import("../src/shared/contracts").IpcResult<void>;
    expect(result.ok).toBe(true);

    // Verify clipboard write
    expect(clipboardWritten).toEqual([
      { text: "Only if you buy lunch ;)", type: "clipboard" },
    ]);

    // Verify overlay was closed
    expect(mockOverlay.setBubblesOpen).toHaveBeenCalledWith(false);

    // Verify snapshot was published with lastAction = "copied"
    const lastPublishedState = mockWindow.sentMessages.find(
      (m) => m.channel === IPC_CHANNELS.stateChanged && (m.payload as import("../src/shared/contracts").DesktopSnapshot).lastAction === "copied",
    );
    expect(lastPublishedState).toBeDefined();
    expect((lastPublishedState?.payload as import("../src/shared/contracts").DesktopSnapshot).lastAction).toBe("copied");

    // 3. Test copyReply with non-existent suggestionId
    const invalidResult = await copyHandler!(mockEvent, { suggestionId: "invalid_choice" }) as import("../src/shared/contracts").IpcResult<void>;
    expect(invalidResult.ok).toBe(false);
    if (invalidResult.ok) throw new Error("Expected invalid IPC request to fail");
    expect(invalidResult.error.code).toBe("INVALID_REQUEST");

    dispose();
  });
});
