import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { DEFAULT_SUGGESTION_HOTKEY, type GlobalShortcutAdapter } from "../src/main/suggestion-hotkey";

const rendererModulePath = "../src/renderer/App";
const { App, PopoutBubbles } = await import(rendererModulePath);
import { registerDesktopIpc } from "../src/main/desktop-ipc";
import { OverlayController } from "../src/main/overlay-controller";
import type { SyntheticSuggestion, PanelPlacement } from "../src/shared/contracts";
import type { DesktopCapturerApi } from "../src/main/window-capturer";
import { WindowCaptureService } from "../src/main/window-capturer";
import type { DesktopOcrEngineApi } from "../src/main/ocr-engine";

// Mock Electron modules for Node/Vitest test environment
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
}));

function createMockWindow() {
  const sentMessages: Array<{ channel: string; payload: unknown }> = [];
  let focusable = false;

  const window = {
    isDestroyed: () => false,
    webContents: {
      send: (channel: string, payload: unknown) => {
        sentMessages.push({ channel, payload });
      },
      mainFrame: {
        url: "milo://app/index.html",
        isDestroyed: () => false,
      },
      isDestroyed: () => false,
    },
    getBounds: () => ({ x: 100, y: 100, width: 168, height: 174 }),
    setBounds: vi.fn(),
    setOpacity: vi.fn(),
    setAlwaysOnTop: vi.fn(),
    setFocusable: vi.fn((value: boolean) => {
      focusable = value;
    }),
    isFocusable: () => focusable,
    getMediaSourceId: () => "window:milo-self",
    sentMessages,
  };

  return window as unknown as Electron.BrowserWindow & {
    sentMessages: typeof sentMessages;
    isFocusable: () => boolean;
  };
}

function createMockOverlay() {
  let bubblesOpen = false;
  let panelOpen = false;
  const placement: PanelPlacement = "right-down";

  return {
    get panelOpen() {
      return panelOpen;
    },
    get bubblesOpen() {
      return bubblesOpen;
    },
    isBubblesOpen: () => bubblesOpen,
    isPanelOpen: () => panelOpen,
    get placement() {
      return placement;
    },
    setBubblesOpen: vi.fn((open: boolean) => {
      bubblesOpen = open;
    }),
    setPanelOpen: vi.fn((open: boolean) => {
      panelOpen = open;
      return placement;
    }),
    nudge: vi.fn(),
    reset: vi.fn(),
    initialize: vi.fn(),
    dispose: vi.fn(),
  } as unknown as OverlayController & {
    setBubblesOpen: ReturnType<typeof vi.fn>;
    setPanelOpen: ReturnType<typeof vi.fn>;
  };
}

function createMockSettingsStore() {
  let paused = false;
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
    getOverlayPosition: () => null,
    setOverlayPosition: vi.fn(),
  };
}

const SAMPLE_REPLIES: readonly SyntheticSuggestion[] = [
  {
    id: "safe",
    label: "Safe choice",
    text: "Sounds good! Let's catch up later this week.",
    explanation: "Keeps the tone friendly and open without putting pressure on them.",
  },
  {
    id: "confident",
    label: "Confident choice",
    text: "I'd love to. How about coffee Thursday at 4?",
    explanation: "Clear, direct, and sets a specific time while showing genuine interest.",
  },
  {
    id: "playful",
    label: "Playful choice",
    text: "Only if you promise not to beat me at trivia again 😉",
    explanation: "Teasing callback that builds chemistry and sparks playful banter.",
  },
];

describe("PopoutBubbles Component & View States", () => {
  it("renders pop-out speech bubbles correctly with Safe, Confident, Playful replies and DaisyUI badges", () => {
    const onCopy = vi.fn();
    const onClose = vi.fn();

    const html = renderToString(
      React.createElement(PopoutBubbles, {
        replies: SAMPLE_REPLIES,
        panelPlacement: "right-down",
        copiedSuggestion: null,
        onCopy,
        onClose,
      }),
    );

    // Verify container and region semantics
    expect(html).toContain("popout-bubbles");
    expect(html).toContain('role="region"');
    expect(html).toContain("Milo pop-out suggestions");

    // Verify directional tail pointing left toward avatar dock on right-down placement
    expect(html).toContain("popout-bubbles--tail-left");

    // Verify all three reply categories with their DaisyUI badges
    expect(html).toContain("speech-bubble--safe");
    expect(html).toContain("reply-card--safe");
    expect(html).toContain("badge-info");
    expect(html).toContain("Safe");
    expect(html).toContain("Sounds good!");

    expect(html).toContain("speech-bubble--confident");
    expect(html).toContain("reply-card--confident");
    expect(html).toContain("badge-primary");
    expect(html).toContain("Confident");
    expect(html).toContain("How about coffee Thursday at 4?");

    expect(html).toContain("speech-bubble--playful");
    expect(html).toContain("reply-card--playful");
    expect(html).toContain("badge-secondary");
    expect(html).toContain("Playful");
    expect(html).toContain("Only if you promise not to beat me at trivia again");

    // Verify copy button labels
    expect(html).toContain("Copy");
  });

  it("applies directional tail class pointing right when panel placement is on the left", () => {
    const html = renderToString(
      React.createElement(PopoutBubbles, {
        replies: SAMPLE_REPLIES,
        panelPlacement: "left-down",
        copiedSuggestion: null,
        onCopy: vi.fn(),
      }),
    );

    expect(html).toContain("popout-bubbles--tail-right");
    expect(html).not.toContain("popout-bubbles--tail-left");
  });

  it("displays Copied state when a suggestion was recently copied", () => {
    const html = renderToString(
      React.createElement(PopoutBubbles, {
        replies: SAMPLE_REPLIES,
        panelPlacement: "right-down",
        copiedSuggestion: "safe",
        onCopy: vi.fn(),
      }),
    );

    expect(html).toContain("copy-button--copied");
    expect(html).toContain("Copied!");
  });

  it("prevents layout overflow via structure and appropriate content wrapping", () => {
    const LONG_REPLIES: readonly SyntheticSuggestion[] = [
      {
        id: "safe",
        label: "Safe choice",
        text: "Supercalifragilisticexpialidocious".repeat(5),
        explanation: "RationaleWithNoSpaces".repeat(10),
      },
    ];

    const html = renderToString(
      React.createElement(PopoutBubbles, {
        replies: LONG_REPLIES,
        panelPlacement: "right-down",
        copiedSuggestion: null,
        onCopy: vi.fn(),
      }),
    );

    // Structure includes speech-bubble classes which enforce word-break and overflow-wrap
    expect(html).toContain("speech-bubble");
    expect(html).toContain("speech-bubble__body");
    expect(html).toContain("speech-bubble__rationale");
  });

  it("renders collapsed avatar minimal dock and suppresses panel and bubbles by default", () => {
    // Setup window mock for App component execution in SSR
    const mockMilo = {
      onStateChanged: vi.fn(() => () => undefined),
      getSnapshot: vi.fn(async () => ({
        state: "idle" as const,
        panelOpen: false,
        panelPlacement: "right-down" as const,
        watching: { paused: false, selectedWindow: null, capability: { available: true } },
        auth: { status: "signed_out" as const, expiresAt: null, storageAvailable: true },
        settings: {
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
        },
        replies: [],
        lastAction: "none" as const,
      })),
      setPanelOpen: vi.fn(),
      copyReply: vi.fn(),
      openContextMenu: vi.fn(),
      nudgePosition: vi.fn(),
    };

    vi.stubGlobal("window", {
      milo: mockMilo,
      matchMedia: vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    vi.stubGlobal("document", {
      documentElement: { dataset: {} },
    });

    const html = renderToString(React.createElement(App));
    vi.unstubAllGlobals();

    // Avatar dock is present
    expect(html).toContain("cat-dock");
    expect(html).toContain("cat-button");
    expect(html).toContain("Milo desktop companion");

    // Large settings panel is NOT present in collapsed mode
    expect(html).not.toContain('id="panel-title"');
    expect(html).not.toContain("Private companion");

    // Pop-out bubbles are NOT present when no replies exist
    expect(html).not.toContain("popout-bubbles");
  });

  it("renders expanded settings panel when panelOpen === true", () => {
    const html = renderToString(
      React.createElement(App, {
        initialSnapshot: {
          state: "idle",
          panelOpen: true,
          panelPlacement: "right-down",
          watching: { paused: false, selectedWindow: null, capability: { available: true } },
          auth: { status: "signed_out", expiresAt: null, storageAvailable: true },
          settings: {
            theme: "system",
            motion: "system",
            showWatchingIndicator: true,
            soundEnabled: true,
            soundVolume: 0.7,
            noticeSoundEnabled: false,
            activeTone: "standard",
            opacity: 1.0,
            isPinned: true,
            dockMode: "follow-window",
          },
          replies: [],
          lastAction: "none",
        },
      }),
    );

    // Large settings panel is present when panelOpen is true
    expect(html).toContain('id="panel-title"');
    expect(html).toContain("Private companion");
    expect(html).toContain("panel__header");
    expect(html).toContain("desktop-layout");
  });
});

describe("Global Hotkey (Alt+S) & Main IPC Wiring", () => {
  beforeEach(() => {
    registeredIpcHandlers.clear();
    clipboardWritten.length = 0;
    mockSources = [
      {
        id: "window:1234:0",
        name: "WhatsApp",
        thumbnail: {
          isEmpty: () => false,
          getSize: () => ({ width: 800, height: 600 }),
          toPNG: () => Buffer.from("fake-png-data"),
        },
      },
    ];
  });

  it("registers Alt+S global hotkey and triggers suggestion pipeline without opening the settings panel", async () => {
    const mockWindow = createMockWindow();
    const mockOverlay = createMockOverlay();
    const mockSettingsStore = createMockSettingsStore();

    let registeredHotkey: string | null = null;
    let hotkeyCallback: (() => Promise<void> | void) | null = null;

    const mockShortcut: GlobalShortcutAdapter = {
      register: vi.fn((accelerator, cb) => {
        registeredHotkey = accelerator;
        hotkeyCallback = cb;
        return true;
      }),
      unregister: vi.fn(),
    };

    const mockCapturer: DesktopCapturerApi = {
      getSources: vi.fn(async () => mockSources as unknown as Electron.DesktopCapturerSource[]),
    };
    const captureService = new WindowCaptureService(mockCapturer);

    const mockOcrEngine: DesktopOcrEngineApi = {
      initialize: vi.fn(async () => undefined),
      extractFromBuffer: vi.fn(async () => ({
        rawText: "Hey are you free this weekend?",
        normalizedText: "Hey are you free this weekend?",
        confidence: 90,
        durationMs: 12,
      })),
      terminate: vi.fn(async () => undefined),
    };

    const mockSuggestionClient = {
      suggest: vi.fn(async () => ({
        replies: [
          { category: "safe" as const, text: "Sounds good!", whyItWorks: "Friendly" },
          { category: "confident" as const, text: "Let's do it!", whyItWorks: "Direct" },
          { category: "playful" as const, text: "Maybe ;)", whyItWorks: "Teasing" },
        ],
        warning: null,
      })),
    };

    const mockAuthSession = {
      getAccessToken: vi.fn(async () => "mock-access-token"),
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
      settingsStore: mockSettingsStore as unknown as Parameters<typeof registerDesktopIpc>[0]["settingsStore"],
      nativeHelper: mockNativeHelper as unknown as Parameters<typeof registerDesktopIpc>[0]["nativeHelper"],
      authSession: mockAuthSession as unknown as Parameters<typeof registerDesktopIpc>[0]["authSession"],
      suggestionClient: mockSuggestionClient as unknown as Parameters<typeof registerDesktopIpc>[0]["suggestionClient"],
      accountOpener: vi.fn(),
      windowCaptureService: captureService,
      ocrEngine: mockOcrEngine,
      shortcutApi: mockShortcut,
    });

    // 1. Verify that DEFAULT_SUGGESTION_HOTKEY (Alt+S on Windows) was registered
    expect(mockShortcut.register).toHaveBeenCalledTimes(1);
    expect(registeredHotkey).toBe(DEFAULT_SUGGESTION_HOTKEY);

    await registeredIpcHandlers.get("milo:select-window")!({
      sender: mockWindow.webContents,
      senderFrame: mockWindow.webContents.mainFrame,
    }, { sourceId: "window:1234:0" });

    // 2. Invoke the global hotkey
    expect(hotkeyCallback).not.toBeNull();
    hotkeyCallback!();

    // 3. Verify that screen capture and suggestion pipeline were triggered and bubbles were opened
    await vi.waitFor(() => {
      expect(mockOcrEngine.extractFromBuffer).toHaveBeenCalled();
      expect(mockSuggestionClient.suggest).toHaveBeenCalled();
      expect(mockOverlay.setBubblesOpen).toHaveBeenCalledWith(true);
    });

    // 4. Verify that settings panel was NOT opened (keeps compact avatar mode)
    expect(mockOverlay.setPanelOpen).not.toHaveBeenCalledWith(true);

    dispose();
    expect(mockShortcut.unregister).toHaveBeenCalledWith(DEFAULT_SUGGESTION_HOTKEY);
  });
});
