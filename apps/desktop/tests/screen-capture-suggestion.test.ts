import assert from "node:assert/strict";
import type { DesktopSnapshot, ToneProfile, PublicSettingsPatch, IpcResult, SuggestionResponse, WindowSelectionResult } from "../src/shared/contracts";
type SuggestInput = Parameters<DesktopSuggestionClient["suggest"]>[0];
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BrowserWindow, IpcMainInvokeEvent } from "electron";
import { IPC_CHANNELS, type SyntheticSuggestion } from "../src/shared/contracts";
import { registerDesktopIpc } from "../src/main/desktop-ipc";
import { WindowCaptureError, WindowCaptureService } from "../src/main/window-capturer";
import type { DesktopOcrEngineApi, OcrExtractionResult } from "../src/main/ocr-engine";
import { DesktopSuggestionClient, DesktopSuggestionClientError } from "../src/main/desktop-suggestion-client";
import type { ContentFreeSettingsStore } from "../src/main/settings-store";
import type { NativeHelperClient } from "../src/main/native-helper-client";
import type { AuthSession } from "../src/main/auth-session";
import type { OverlayController } from "../src/main/overlay-controller";

// Mock Electron modules for Node/Vitest test environment
const registeredIpcHandlers = new Map<string, (event: IpcMainInvokeEvent, payload: unknown) => Promise<unknown>>();
const clipboardWritten: Array<{ text: string; type?: string }> = [];
let mockSources: Array<{ id: string; name: string; thumbnail: ReturnType<typeof createMockNativeImage> }> = [];

vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (event: IpcMainInvokeEvent, payload: unknown) => Promise<unknown>) => {
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

function createMockNativeImage(width = 1920, height = 1080) {
  return {
    isEmpty: () => width <= 0 || height <= 0,
    getSize: () => ({ width, height }),
    toPNG: () => Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01, 0x02, 0x03]),
  };
}

function createMockWindow() {
  const sentMessages: Array<{ channel: string; payload: DesktopSnapshot }> = [];
  const webContents = {
    id: 1,
    isDestroyed: () => false,
    mainFrame: {
      isDestroyed: () => false,
      url: "milo://app/index.html",
    },
    send: vi.fn((channel: string, payload: DesktopSnapshot) => {
      sentMessages.push({ channel, payload });
    }),
  };

  const window = {
    id: 1,
    isDestroyed: () => false,
    getMediaSourceId: () => "window:999:0",
    webContents,
    setOpacity: vi.fn(),
    setAlwaysOnTop: vi.fn(),
    sentMessages,
  } as unknown as BrowserWindow & { sentMessages: Array<{ channel: string; payload: DesktopSnapshot }> };

  return window;
}

function createMockEvent(window: BrowserWindow): IpcMainInvokeEvent {
  return {
    sender: window.webContents,
    senderFrame: window.webContents.mainFrame,
  } as unknown as IpcMainInvokeEvent;
}

function createMockOverlay(): OverlayController {
  return {
    panelOpen: false,
    placement: "right-down" as const,
    initialize: vi.fn(),
    reset: vi.fn(),
    nudge: vi.fn(),
    setPanelOpen: vi.fn(),
    dispose: vi.fn(),
  } as unknown as OverlayController;
}

function createMockSettingsStore(initialTone: ToneProfile = "standard"): ContentFreeSettingsStore {
  let paused = false;
  let activeTone = initialTone;

  return {
    getPaused: () => paused,
    setPaused: (p: boolean) => {
      paused = p;
    },
    getPublicSettings: () => ({
      theme: "system" as const,
      motion: "system" as const,
      showWatchingIndicator: true,
      soundEnabled: true,
      soundVolume: 0.7,
      noticeSoundEnabled: false,
      activeTone,
      opacity: 1.0,
      isPinned: true,
      dockMode: "follow-window" as const,
    }),
    updatePublicSettings: (patch: PublicSettingsPatch) => {
      if (patch.activeTone) activeTone = patch.activeTone;
      return {
        theme: "system" as const,
        motion: "system" as const,
        showWatchingIndicator: true,
        soundEnabled: true,
        soundVolume: 0.7,
        noticeSoundEnabled: false,
        activeTone,
        opacity: 1.0,
        isPinned: true,
        dockMode: "follow-window" as const,
      };
    },
    addXp: vi.fn(),
    getOverlayPosition: () => null,
    setOverlayPosition: () => {},
  } as unknown as ContentFreeSettingsStore;
}

function createMockNativeHelper(): NativeHelperClient {
  return {
    listWindows: vi.fn(async () => []),
    suspend: vi.fn(),
    dispose: vi.fn(),
  } as unknown as NativeHelperClient;
}

function createMockAuthSession(token = "valid-test-token"): AuthSession {
  return {
    getAccessToken: vi.fn(async () => token),
    getSnapshot: vi.fn(() => ({
      status: "authenticated" as const,
      expiresAt: Date.now() + 3600_000,
      storageAvailable: true,
    })),
    signIn: vi.fn(),
    signOut: vi.fn(),
    dispose: vi.fn(),
  } as unknown as AuthSession;
}

function createMockWindowCaptureService(options?: {
  capturedBuffer?: Buffer;
  error?: Error;
}): WindowCaptureService {
  return {
    captureWindow: vi.fn(async (sourceId: string) => {
      if (options?.error) throw options.error;
      return {
        sourceId,
        title: "WhatsApp - Chat",
        appType: "whatsapp" as const,
        imageBuffer:
          options?.capturedBuffer ??
          Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01, 0x02, 0x03]),
        width: 1920,
        height: 1080,
        timestamp: Date.now(),
      };
    }),
  } as unknown as WindowCaptureService;
}

function createMockOcrEngine(options?: {
  rawText?: string;
  confidence?: number;
  durationMs?: number;
  error?: Error;
}): DesktopOcrEngineApi {
  return {
    initialize: vi.fn(async () => {}),
    extractFromBuffer: vi.fn(async (): Promise<OcrExtractionResult> => {
      if (options?.error) throw options.error;
      const rawText =
        options?.rawText !== undefined
          ? options.rawText
          : "Other: Are we having dinner tomorrow?\nSelf: Yes! 8pm works for me.";
      return {
        rawText,
        normalizedText: rawText,
        confidence: options?.confidence ?? 94.2,
        durationMs: options?.durationMs ?? 48,
      };
    }),
    terminate: vi.fn(async () => {}),
  };
}

function createMockSuggestionClient(options?: {
  replies?: Array<{ category: "safe" | "confident" | "playful"; text: string; whyItWorks: string }>;
  warning?: string | null;
  error?: Error;
  onSuggest?: (input: SuggestInput) => void;
}): DesktopSuggestionClient {
  const defaultReplies = [
    { category: "safe" as const, text: "Looking forward to it! See you at 8.", whyItWorks: "Warm confirmation." },
    { category: "confident" as const, text: "Table is booked for 8. Can't wait.", whyItWorks: "Decisive and clear." },
    { category: "playful" as const, text: "8pm it is! Don't be late 😉", whyItWorks: "Lighthearted banter." },
  ];

  return {
    suggest: vi.fn(async (input: SuggestInput) => {
      if (options?.onSuggest) options.onSuggest(input);
      if (options?.error) throw options.error;
      return {
        requestId: "00000000-0000-4000-8000-000000000111",
        conversationStatus: "clear" as const,
        detectedLanguage: "English",
        briefContext: "Dinner plan confirmation",
        warning: options?.warning ?? null,
        replies: options?.replies ?? defaultReplies,
        remaining: 25,
      };
    }),
  } as unknown as DesktopSuggestionClient;
}

describe("Screen Capture + OCR -> DesktopSuggestionClient Integration", () => {
  beforeEach(() => {
    registeredIpcHandlers.clear();
    clipboardWritten.length = 0;
    mockSources = [
      {
        id: "window:101:0",
        name: "WhatsApp - Alex",
        thumbnail: createMockNativeImage(),
      },
      {
        id: "window:102:0",
        name: "Discord - #general",
        thumbnail: createMockNativeImage(),
      },
    ];
  });

  it("completes full capture -> OCR -> normalizer -> suggestionClient pipeline to ready state", async () => {
    const mockWindow = createMockWindow();
    const event = createMockEvent(mockWindow);
    const settingsStore = createMockSettingsStore("witty");
    const authSession = createMockAuthSession("auth-token-xyz");
    const suggestInputs: SuggestInput[] = [];

    const suggestionClient = createMockSuggestionClient({
      onSuggest: (input) => {
        suggestInputs.push(input);
      },
    });

    const windowCaptureService = createMockWindowCaptureService();
    const ocrEngine = createMockOcrEngine({
      rawText: "Alex: Hey, free for coffee this afternoon?\nSelf: Sounds great! What time?",
    });

    const dispose = registerDesktopIpc({
      window: mockWindow,
      overlay: createMockOverlay(),
      settingsStore,
      nativeHelper: createMockNativeHelper(),
      authSession,
      suggestionClient,
      accountOpener: null,
      windowCaptureService,
      ocrEngine,
    });

    try {
      // 1. Select the WhatsApp chat window
      const selectHandler = registeredIpcHandlers.get(IPC_CHANNELS.selectWindow)!;
      expect(selectHandler).toBeDefined();
      const selectResult = (await selectHandler(event, { sourceId: "window:101:0" })) as IpcResult<WindowSelectionResult>;
      expect(selectResult.ok).toBe(true);
      assert(selectResult.ok);
      expect(selectResult.value.mode).toBe("selected");
      assert(selectResult.value.mode === "selected");
      expect(selectResult.value.window.title).toBe("WhatsApp - Alex");

      // 2. Trigger suggestion via askMilo with screen_capture mode
      const askHandler = registeredIpcHandlers.get(IPC_CHANNELS.askMilo)!;
      expect(askHandler).toBeDefined();
      const askResult = (await askHandler(event, { mode: "screen_capture" })) as IpcResult<SuggestionResponse>;

      // 3. Verify capture and OCR were called
      expect(windowCaptureService.captureWindow).toHaveBeenCalledWith("window:101:0");
      expect(ocrEngine.extractFromBuffer).toHaveBeenCalledTimes(1);

      // 4. Verify suggestionClient received properly normalized messages and tone
      const suggestInputCaptured = suggestInputs[0]!;
      expect(suggestInputCaptured).toBeDefined();
      expect(suggestInputCaptured.accessToken).toBe("auth-token-xyz");
      expect(suggestInputCaptured.tone).toBe("witty");
      expect(suggestInputCaptured.relationshipStage).toBe("dating");
      expect(suggestInputCaptured.messages.length).toBeGreaterThanOrEqual(1);
      expect(suggestInputCaptured.messages.every((m) => m.role === "unknown")).toBe(true);

      // 5. Verify askMilo return value contains 3 categorized suggestions
      expect(askResult.ok).toBe(true);
      assert(askResult.ok);
      expect(askResult.value.mode).toBe("live");
      expect(askResult.value.replies).toHaveLength(3);
      expect(askResult.value.replies.map((r: SyntheticSuggestion) => r.id)).toEqual([
        "safe",
        "confident",
        "playful",
      ]);

      // 6. Verify state transitions: idle -> generate -> ready
      const stateChanges = mockWindow.sentMessages
        .filter((m) => m.channel === IPC_CHANNELS.stateChanged)
        .map((m) => m.payload.state);

      expect(stateChanges).toContain("generating");
      expect(stateChanges).toContain("ready");
      expect(stateChanges[stateChanges.length - 1]).toBe("ready");

      // 7. Verify the final published snapshot contains the 3 reply cards
      const lastSnapshot = mockWindow.sentMessages[mockWindow.sentMessages.length - 1]!.payload;
      expect(lastSnapshot.state).toBe("ready");
      expect(lastSnapshot.replies).toHaveLength(3);
      expect(lastSnapshot.replies[0].label).toBe("Safe choice");
      expect(lastSnapshot.replies[1].label).toBe("Confident choice");
      expect(lastSnapshot.replies[2].label).toBe("Playful choice");
    } finally {
      dispose();
    }
  });

  it("handles selected_window mode seamlessly with screen capture pipeline", async () => {
    const mockWindow = createMockWindow();
    const event = createMockEvent(mockWindow);
    const windowCaptureService = createMockWindowCaptureService();
    const ocrEngine = createMockOcrEngine();
    const suggestionClient = createMockSuggestionClient();

    const dispose = registerDesktopIpc({
      window: mockWindow,
      overlay: createMockOverlay(),
      settingsStore: createMockSettingsStore(),
      nativeHelper: createMockNativeHelper(),
      authSession: createMockAuthSession(),
      suggestionClient,
      accountOpener: null,
      windowCaptureService,
      ocrEngine,
    });

    try {
      const selectHandler = registeredIpcHandlers.get(IPC_CHANNELS.selectWindow)!;
      await selectHandler(event, { sourceId: "window:101:0" });

      const askHandler = registeredIpcHandlers.get(IPC_CHANNELS.askMilo)!;
      const askResult = (await askHandler(event, { mode: "selected_window" })) as IpcResult<SuggestionResponse>;

      expect(askResult.ok).toBe(true);
      assert(askResult.ok);
      expect(askResult.value.mode).toBe("live");
      expect(askResult.value.replies).toHaveLength(3);
      expect(windowCaptureService.captureWindow).toHaveBeenCalledWith("window:101:0");
    } finally {
      dispose();
    }
  });

  it("gracefully handles WINDOW_MINIMIZED error without crashing", async () => {
    const mockWindow = createMockWindow();
    const event = createMockEvent(mockWindow);
    const windowCaptureService = createMockWindowCaptureService({
      error: new WindowCaptureError("WINDOW_MINIMIZED", "Window is minimized"),
    });
    const ocrEngine = createMockOcrEngine();
    const suggestionClient = createMockSuggestionClient();

    const dispose = registerDesktopIpc({
      window: mockWindow,
      overlay: createMockOverlay(),
      settingsStore: createMockSettingsStore(),
      nativeHelper: createMockNativeHelper(),
      authSession: createMockAuthSession(),
      suggestionClient,
      accountOpener: null,
      windowCaptureService,
      ocrEngine,
    });

    try {
      const selectHandler = registeredIpcHandlers.get(IPC_CHANNELS.selectWindow)!;
      await selectHandler(event, { sourceId: "window:101:0" });

      const askHandler = registeredIpcHandlers.get(IPC_CHANNELS.askMilo)!;
      const askResult = (await askHandler(event, { mode: "screen_capture" })) as IpcResult<SuggestionResponse>;

      // Fail-safe handling: does not throw unhandled rejection, returns failure result
      expect(askResult.ok).toBe(false);
      assert(!askResult.ok);
      expect(askResult.error.code).toBe("INTERNAL_ERROR");

      // State transitions to fail
      const stateChanges = mockWindow.sentMessages
        .filter((m) => m.channel === IPC_CHANNELS.stateChanged)
        .map((m) => m.payload.state);
      expect(stateChanges[stateChanges.length - 1]).toBe("error");

      // Replies are cleared to empty array
      const lastSnapshot = mockWindow.sentMessages[mockWindow.sentMessages.length - 1]!.payload;
      expect(lastSnapshot.replies).toEqual([]);
    } finally {
      dispose();
    }
  });

  it("gracefully handles empty OCR transcript without crashing", async () => {
    const mockWindow = createMockWindow();
    const event = createMockEvent(mockWindow);
    const windowCaptureService = createMockWindowCaptureService();
    // Empty text / whitespace only
    const ocrEngine = createMockOcrEngine({ rawText: "   \n\n  \t  " });
    const suggestionClient = createMockSuggestionClient();

    const dispose = registerDesktopIpc({
      window: mockWindow,
      overlay: createMockOverlay(),
      settingsStore: createMockSettingsStore(),
      nativeHelper: createMockNativeHelper(),
      authSession: createMockAuthSession(),
      suggestionClient,
      accountOpener: null,
      windowCaptureService,
      ocrEngine,
    });

    try {
      const selectHandler = registeredIpcHandlers.get(IPC_CHANNELS.selectWindow)!;
      await selectHandler(event, { sourceId: "window:101:0" });

      const askHandler = registeredIpcHandlers.get(IPC_CHANNELS.askMilo)!;
      const askResult = (await askHandler(event, { mode: "screen_capture" })) as IpcResult<SuggestionResponse>;

      expect(askResult.ok).toBe(false);
      assert(!askResult.ok);
      expect(askResult.error.code).toBe("UNAVAILABLE");

      // Suggestion client must not be called when context is empty
      expect(suggestionClient.suggest).not.toHaveBeenCalled();

      // State transitions to fail
      const stateChanges = mockWindow.sentMessages
        .filter((m) => m.channel === IPC_CHANNELS.stateChanged)
        .map((m) => m.payload.state);
      expect(stateChanges[stateChanges.length - 1]).toBe("error");
    } finally {
      dispose();
    }
  });

  it("gracefully recovers when OCR engine throws decoding error", async () => {
    const mockWindow = createMockWindow();
    const event = createMockEvent(mockWindow);
    const windowCaptureService = createMockWindowCaptureService();
    const ocrEngine = createMockOcrEngine({
      error: new Error("OCR_DECODING_ERROR: Corrupted or unsupported image buffer format"),
    });
    const suggestionClient = createMockSuggestionClient();

    const dispose = registerDesktopIpc({
      window: mockWindow,
      overlay: createMockOverlay(),
      settingsStore: createMockSettingsStore(),
      nativeHelper: createMockNativeHelper(),
      authSession: createMockAuthSession(),
      suggestionClient,
      accountOpener: null,
      windowCaptureService,
      ocrEngine,
    });

    try {
      const selectHandler = registeredIpcHandlers.get(IPC_CHANNELS.selectWindow)!;
      await selectHandler(event, { sourceId: "window:101:0" });

      const askHandler = registeredIpcHandlers.get(IPC_CHANNELS.askMilo)!;
      const askResult = (await askHandler(event, { mode: "screen_capture" })) as IpcResult<SuggestionResponse>;

      expect(askResult.ok).toBe(false);
      assert(!askResult.ok);
      expect(suggestionClient.suggest).not.toHaveBeenCalled();

      const lastSnapshot = mockWindow.sentMessages[mockWindow.sentMessages.length - 1]!.payload;
      expect(lastSnapshot.state).toBe("error");
      expect(lastSnapshot.replies).toEqual([]);
    } finally {
      dispose();
    }
  });

  it("gracefully recovers when suggestion client network fails", async () => {
    const mockWindow = createMockWindow();
    const event = createMockEvent(mockWindow);
    const windowCaptureService = createMockWindowCaptureService();
    const ocrEngine = createMockOcrEngine();
    const suggestionClient = createMockSuggestionClient({
      error: new Error("Network request failed: fetch error"),
    });

    const dispose = registerDesktopIpc({
      window: mockWindow,
      overlay: createMockOverlay(),
      settingsStore: createMockSettingsStore(),
      nativeHelper: createMockNativeHelper(),
      authSession: createMockAuthSession(),
      suggestionClient,
      accountOpener: null,
      windowCaptureService,
      ocrEngine,
    });

    try {
      const selectHandler = registeredIpcHandlers.get(IPC_CHANNELS.selectWindow)!;
      await selectHandler(event, { sourceId: "window:101:0" });

      const askHandler = registeredIpcHandlers.get(IPC_CHANNELS.askMilo)!;
      const askResult = (await askHandler(event, { mode: "screen_capture" })) as IpcResult<SuggestionResponse>;

      expect(askResult.ok).toBe(false);
      assert(!askResult.ok);
      const lastSnapshot = mockWindow.sentMessages[mockWindow.sentMessages.length - 1]!.payload;
      expect(lastSnapshot.state).toBe("error");
      expect(lastSnapshot.replies).toEqual([]);
    } finally {
      dispose();
    }
  });

  it("copies selected reply to clipboard and updates lastAction to copied", async () => {
    const mockWindow = createMockWindow();
    const event = createMockEvent(mockWindow);
    const windowCaptureService = createMockWindowCaptureService();
    const ocrEngine = createMockOcrEngine();
    const suggestionClient = createMockSuggestionClient();

    const dispose = registerDesktopIpc({
      window: mockWindow,
      overlay: createMockOverlay(),
      settingsStore: createMockSettingsStore(),
      nativeHelper: createMockNativeHelper(),
      authSession: createMockAuthSession(),
      suggestionClient,
      accountOpener: null,
      windowCaptureService,
      ocrEngine,
    });

    try {
      // Setup ready state with suggestions
      const selectHandler = registeredIpcHandlers.get(IPC_CHANNELS.selectWindow)!;
      await selectHandler(event, { sourceId: "window:101:0" });

      const askHandler = registeredIpcHandlers.get(IPC_CHANNELS.askMilo)!;
      await askHandler(event, { mode: "screen_capture" });

      // Copy the confident reply
      const copyHandler = registeredIpcHandlers.get(IPC_CHANNELS.copyReply)!;
      const copyResult = (await copyHandler(event, { suggestionId: "confident" })) as IpcResult<void>;
      expect(copyResult.ok).toBe(true);
      assert(copyResult.ok);

      // Verify clipboard written
      expect(clipboardWritten.length).toBeGreaterThan(0);
      expect(clipboardWritten[clipboardWritten.length - 1]?.text).toBe(
        "Table is booked for 8. Can't wait.",
      );

      // Verify lastAction updated to "copied"
      const lastSnapshot = mockWindow.sentMessages[mockWindow.sentMessages.length - 1]!.payload;
      expect(lastSnapshot.lastAction).toBe("copied");
    } finally {
      dispose();
    }
  });

  it("terminates OCR engine when desktop IPC lifecycle is disposed", async () => {
    const mockWindow = createMockWindow();
    const windowCaptureService = createMockWindowCaptureService();
    const ocrEngine = createMockOcrEngine();

    const dispose = registerDesktopIpc({
      window: mockWindow,
      overlay: createMockOverlay(),
      settingsStore: createMockSettingsStore(),
      nativeHelper: createMockNativeHelper(),
      authSession: createMockAuthSession(),
      suggestionClient: createMockSuggestionClient(),
      accountOpener: null,
      windowCaptureService,
      ocrEngine,
    });

    expect(ocrEngine.terminate).not.toHaveBeenCalled();
    dispose();
    expect(ocrEngine.terminate).toHaveBeenCalledTimes(1);
  });

  it("handles rapid consecutive askMilo triggers (debounce / epoch increments) without race condition corruption", async () => {
    const mockWindow = createMockWindow();
    const event = createMockEvent(mockWindow);
    const windowCaptureService = createMockWindowCaptureService();
    const ocrEngine = createMockOcrEngine();

    let callCount = 0;
    const suggestionClient = {
      suggest: vi.fn(async () => {
        callCount++;
        const currentCall = callCount;
        if (currentCall === 1) {
          // First call is slower (simulating network latency)
          await new Promise((resolve) => setTimeout(resolve, 50));
          return {
            requestId: "00000000-0000-4000-8000-000000000001",
            conversationStatus: "clear" as const,
            detectedLanguage: "English",
            briefContext: "Call 1 context",
            warning: null,
            replies: [
              { category: "safe" as const, text: "Call 1 Safe", whyItWorks: "First call safe." },
              { category: "confident" as const, text: "Call 1 Confident", whyItWorks: "First call confident." },
              { category: "playful" as const, text: "Call 1 Playful", whyItWorks: "First call playful." },
            ],
            remaining: 20,
          };
        } else {
          // Second call is fast
          await new Promise((resolve) => setTimeout(resolve, 10));
          return {
            requestId: "00000000-0000-4000-8000-000000000002",
            conversationStatus: "clear" as const,
            detectedLanguage: "English",
            briefContext: "Call 2 context",
            warning: null,
            replies: [
              { category: "safe" as const, text: "Call 2 Safe", whyItWorks: "Second call safe." },
              { category: "confident" as const, text: "Call 2 Confident", whyItWorks: "Second call confident." },
              { category: "playful" as const, text: "Call 2 Playful", whyItWorks: "Second call playful." },
            ],
            remaining: 19,
          };
        }
      }),
    } as unknown as DesktopSuggestionClient;

    const dispose = registerDesktopIpc({
      window: mockWindow,
      overlay: createMockOverlay(),
      settingsStore: createMockSettingsStore(),
      nativeHelper: createMockNativeHelper(),
      authSession: createMockAuthSession(),
      suggestionClient,
      accountOpener: null,
      windowCaptureService,
      ocrEngine,
    });

    try {
      const selectHandler = registeredIpcHandlers.get(IPC_CHANNELS.selectWindow)!;
      await selectHandler(event, { sourceId: "window:101:0" });

      const askHandler = registeredIpcHandlers.get(IPC_CHANNELS.askMilo)!;

      // Start call 1 — it will begin executing and eventually await captureWindow/OCR/getAccessToken.
      // Call 2 must start while call 1 is still in-flight so that call 2's epoch increment
      // supersedes call 1's epoch. A small real delay gives the JS engine time to schedule
      // call 1's async steps before we fire call 2.
      const p1 = askHandler(event, { mode: "screen_capture" });

      // Flush pending microtasks so call 1 has started its async chain
      await new Promise<void>((resolve) => setTimeout(resolve, 5));

      // Call 2 starts now — this increments generationEpoch, superseding call 1
      const p2 = askHandler(event, { mode: "screen_capture" });

      const [res1, res2] = (await Promise.all([p1, p2])) as [
        IpcResult<SuggestionResponse>,
        IpcResult<SuggestionResponse>,
      ];

      // Call 1 was superseded because generationEpoch incremented when call 2 started
      expect(res1.ok).toBe(false);
      assert(!res1.ok);
      expect(res1.error.code).toBe("UNAVAILABLE");

      // Call 2 succeeded with the latest epoch
      expect(res2.ok).toBe(true);
      assert(res2.ok);
      expect(res2.value.replies[0].text).toBe("Call 2 Safe");

      // Verify the final published snapshot contains Call 2's replies, not superseded Call 1
      const lastSnapshot = mockWindow.sentMessages[mockWindow.sentMessages.length - 1]!.payload;
      expect(lastSnapshot.state).toBe("ready");
      expect(lastSnapshot.replies[0].text).toBe("Call 2 Safe");
    } finally {
      dispose();
    }
  });

  it("gracefully recovers from capture failure WINDOW_NOT_FOUND without crashing", async () => {
    const mockWindow = createMockWindow();
    const event = createMockEvent(mockWindow);
    const windowCaptureService = createMockWindowCaptureService({
      error: new WindowCaptureError("WINDOW_NOT_FOUND", "Window was closed or does not exist"),
    });
    const ocrEngine = createMockOcrEngine();
    const suggestionClient = createMockSuggestionClient();

    const dispose = registerDesktopIpc({
      window: mockWindow,
      overlay: createMockOverlay(),
      settingsStore: createMockSettingsStore(),
      nativeHelper: createMockNativeHelper(),
      authSession: createMockAuthSession(),
      suggestionClient,
      accountOpener: null,
      windowCaptureService,
      ocrEngine,
    });

    try {
      const selectHandler = registeredIpcHandlers.get(IPC_CHANNELS.selectWindow)!;
      await selectHandler(event, { sourceId: "window:101:0" });

      const askHandler = registeredIpcHandlers.get(IPC_CHANNELS.askMilo)!;
      const askResult = (await askHandler(event, { mode: "screen_capture" })) as IpcResult<SuggestionResponse>;

      expect(askResult.ok).toBe(false);
      assert(!askResult.ok);
      expect(askResult.error.code).toBe("INTERNAL_ERROR");

      const lastSnapshot = mockWindow.sentMessages[mockWindow.sentMessages.length - 1]!.payload;
      expect(lastSnapshot.state).toBe("error");
      expect(lastSnapshot.replies).toEqual([]);
      expect(suggestionClient.suggest).not.toHaveBeenCalled();
    } finally {
      dispose();
    }
  });

  it("gracefully handles completely empty OCR transcript string without calling suggestion API", async () => {
    const mockWindow = createMockWindow();
    const event = createMockEvent(mockWindow);
    const windowCaptureService = createMockWindowCaptureService();
    const ocrEngine = createMockOcrEngine({ rawText: "" });
    const suggestionClient = createMockSuggestionClient();

    const dispose = registerDesktopIpc({
      window: mockWindow,
      overlay: createMockOverlay(),
      settingsStore: createMockSettingsStore(),
      nativeHelper: createMockNativeHelper(),
      authSession: createMockAuthSession(),
      suggestionClient,
      accountOpener: null,
      windowCaptureService,
      ocrEngine,
    });

    try {
      const selectHandler = registeredIpcHandlers.get(IPC_CHANNELS.selectWindow)!;
      await selectHandler(event, { sourceId: "window:101:0" });

      const askHandler = registeredIpcHandlers.get(IPC_CHANNELS.askMilo)!;
      const askResult = (await askHandler(event, { mode: "screen_capture" })) as IpcResult<SuggestionResponse>;

      expect(askResult.ok).toBe(false);
      assert(!askResult.ok);
      expect(askResult.error.code).toBe("UNAVAILABLE");
      expect(suggestionClient.suggest).not.toHaveBeenCalled();

      const lastSnapshot = mockWindow.sentMessages[mockWindow.sentMessages.length - 1]!.payload;
      expect(lastSnapshot.state).toBe("error");
      expect(lastSnapshot.replies).toEqual([]);
    } finally {
      dispose();
    }
  });

  describe("suggestion client error mapping in suggestion pipeline", () => {
    const errorCases: Array<{
      code: "unauthorized" | "paywall" | "rate_limit" | "unavailable";
      message: string;
    }> = [
      { code: "unauthorized", message: "Sign in again to use Milo suggestions." },
      { code: "paywall", message: "Your current Milo allowance is exhausted." },
      { code: "rate_limit", message: "Milo needs a short pause before another suggestion." },
      { code: "unavailable", message: "Milo's reply service is temporarily unavailable." },
    ];

    for (const { code, message } of errorCases) {
      it(`gracefully handles suggestion client '${code}' error`, async () => {
        const mockWindow = createMockWindow();
        const event = createMockEvent(mockWindow);
        const windowCaptureService = createMockWindowCaptureService();
        const ocrEngine = createMockOcrEngine();
        const suggestionClient = createMockSuggestionClient({
          error: new DesktopSuggestionClientError(code, message),
        });

        const dispose = registerDesktopIpc({
          window: mockWindow,
          overlay: createMockOverlay(),
          settingsStore: createMockSettingsStore(),
          nativeHelper: createMockNativeHelper(),
          authSession: createMockAuthSession(),
          suggestionClient,
          accountOpener: null,
          windowCaptureService,
          ocrEngine,
        });

        try {
          const selectHandler = registeredIpcHandlers.get(IPC_CHANNELS.selectWindow)!;
          await selectHandler(event, { sourceId: "window:101:0" });

          const askHandler = registeredIpcHandlers.get(IPC_CHANNELS.askMilo)!;
          const askResult = (await askHandler(event, { mode: "screen_capture" })) as IpcResult<SuggestionResponse>;

          // Expect fail-safe IPC result (INTERNAL_ERROR per contract)
          expect(askResult.ok).toBe(false);
      assert(!askResult.ok);
          expect(askResult.error.code).toBe("INTERNAL_ERROR");

          // Snapshot transitioned to fail and replies cleared
          const lastSnapshot = mockWindow.sentMessages[mockWindow.sentMessages.length - 1]!.payload;
          expect(lastSnapshot.state).toBe("error");
          expect(lastSnapshot.replies).toEqual([]);
        } finally {
          dispose();
        }
      });
    }
  });

  it("does not select or read a window implicitly when the hotkey is pressed", async () => {
    const capture = createMockWindowCaptureService();
    const ocr = createMockOcrEngine();
    const client = createMockSuggestionClient();
    let trigger: () => void = () => { throw new Error("Hotkey was not registered"); };
    const dispose = registerDesktopIpc({
      window: createMockWindow(), overlay: createMockOverlay(), settingsStore: createMockSettingsStore(),
      nativeHelper: createMockNativeHelper(), authSession: createMockAuthSession(),
      suggestionClient: client, accountOpener: null, windowCaptureService: capture, ocrEngine: ocr,
      shortcutApi: { register: (_key, callback) => { trigger = callback; return true; }, unregister: vi.fn() },
    });
    try {
      trigger();
      await Promise.resolve();
      expect(capture.captureWindow).not.toHaveBeenCalled();
      expect(ocr.extractFromBuffer).not.toHaveBeenCalled();
      expect(client.suggest).not.toHaveBeenCalled();
    } finally { dispose(); }
  });

  it("clears captured pixels and does not send context when paused during OCR", async () => {
    const mockWindow = createMockWindow();
    const event = createMockEvent(mockWindow);
    const pixels = Buffer.from("synthetic capture bytes");
    const ocr = createMockOcrEngine();
    const client = createMockSuggestionClient();
    let finishOcr!: (value: OcrExtractionResult) => void;
    vi.mocked(ocr.extractFromBuffer).mockImplementation(() => new Promise((resolve) => { finishOcr = resolve; }));
    const dispose = registerDesktopIpc({
      window: mockWindow, overlay: createMockOverlay(), settingsStore: createMockSettingsStore(),
      nativeHelper: createMockNativeHelper(), authSession: createMockAuthSession(),
      suggestionClient: client, accountOpener: null,
      windowCaptureService: createMockWindowCaptureService({ capturedBuffer: pixels }), ocrEngine: ocr,
    });
    try {
      await registeredIpcHandlers.get(IPC_CHANNELS.selectWindow)!(event, { sourceId: "window:101:0" });
      const pending = registeredIpcHandlers.get(IPC_CHANNELS.askMilo)!(event, { mode: "screen_capture" });
      await vi.waitFor(() => expect(ocr.extractFromBuffer).toHaveBeenCalled());
      await registeredIpcHandlers.get(IPC_CHANNELS.pauseWatching)!(event, true);
      finishOcr({ rawText: "Other: Dinner tomorrow?", normalizedText: "Dinner tomorrow?", confidence: 90, durationMs: 1 });
      expect(await pending).toMatchObject({ ok: false, error: { code: "UNAVAILABLE" } });
      expect(client.suggest).not.toHaveBeenCalled();
      expect(pixels.every((byte) => byte === 0)).toBe(true);
      expect(mockWindow.sentMessages.at(-1)?.payload.state).toBe("paused");
    } finally { dispose(); }
  });

  it("fails closed without an AI client and preserves provider safety warnings", async () => {
    for (const configured of [false, true]) {
      const mockWindow = createMockWindow();
      const event = createMockEvent(mockWindow);
      const dispose = registerDesktopIpc({
        window: mockWindow, overlay: createMockOverlay(), settingsStore: createMockSettingsStore(),
        nativeHelper: createMockNativeHelper(), authSession: createMockAuthSession(),
        suggestionClient: configured ? createMockSuggestionClient({ warning: "Please add the missing context." }) : null,
        accountOpener: null, windowCaptureService: createMockWindowCaptureService(), ocrEngine: createMockOcrEngine(),
      });
      try {
        await registeredIpcHandlers.get(IPC_CHANNELS.selectWindow)!(event, { sourceId: "window:101:0" });
        const result = await registeredIpcHandlers.get(IPC_CHANNELS.askMilo)!(event, { mode: "screen_capture" });
        expect(result).toMatchObject(configured
          ? { ok: true, value: { warning: "Please add the missing context." } }
          : { ok: false, error: { code: "UNAVAILABLE" } });
        if (!configured) expect(mockWindow.sentMessages.at(-1)?.payload.replies).toEqual([]);
      } finally { dispose(); }
    }
  });

  describe("reply copy to clipboard edge cases", () => {
    it("rejects copying when suggestion ID does not exist in current replies", async () => {
      const mockWindow = createMockWindow();
      const event = createMockEvent(mockWindow);
      const windowCaptureService = createMockWindowCaptureService();
      const ocrEngine = createMockOcrEngine();
      const suggestionClient = createMockSuggestionClient();

      const dispose = registerDesktopIpc({
        window: mockWindow,
        overlay: createMockOverlay(),
        settingsStore: createMockSettingsStore(),
        nativeHelper: createMockNativeHelper(),
        authSession: createMockAuthSession(),
        suggestionClient,
        accountOpener: null,
        windowCaptureService,
        ocrEngine,
      });

      try {
        const copyHandler = registeredIpcHandlers.get(IPC_CHANNELS.copyReply)!;
        // No suggestions have been generated yet
        const copyResult = (await copyHandler(event, { suggestionId: "safe" })) as IpcResult<void>;
        expect(copyResult.ok).toBe(false);
      assert(!copyResult.ok);
        expect(copyResult.error.code).toBe("UNAVAILABLE");
        expect(clipboardWritten).toHaveLength(0);
      } finally {
        dispose();
      }
    });

    it("rejects copying with invalid suggestion ID payload structure", async () => {
      const mockWindow = createMockWindow();
      const event = createMockEvent(mockWindow);

      const dispose = registerDesktopIpc({
        window: mockWindow,
        overlay: createMockOverlay(),
        settingsStore: createMockSettingsStore(),
        nativeHelper: createMockNativeHelper(),
        authSession: createMockAuthSession(),
        suggestionClient: createMockSuggestionClient(),
        accountOpener: null,
        windowCaptureService: createMockWindowCaptureService(),
        ocrEngine: createMockOcrEngine(),
      });

      try {
        const copyHandler = registeredIpcHandlers.get(IPC_CHANNELS.copyReply)!;
        // Invalid ID not in "safe" | "confident" | "playful"
        const copyResult = (await copyHandler(event, { suggestionId: "invalid_id" })) as IpcResult<void>;
        expect(copyResult.ok).toBe(false);
      assert(!copyResult.ok);
        expect(copyResult.error.code).toBe("INVALID_REQUEST");
        expect(clipboardWritten).toHaveLength(0);
      } finally {
        dispose();
      }
    });
  });
});
