import {
  Menu,
  app,
  clipboard,
  desktopCapturer,
  globalShortcut,
  ipcMain,
  screen,
  type BrowserWindow,
  type IpcMainInvokeEvent,
  type MenuItemConstructorOptions,
} from "electron";
import {
  HARMLESS_ANIMATIONS,
  IPC_CHANNELS,
  SYNTHETIC_SUGGESTIONS,
  type ContextPreview,
  type ContextPreviewInput,
  type AccountDestination,
  type DesktopSnapshot,
  type DesktopState,
  type IpcResult,
  type PublicSettings,
  type SyntheticSuggestion,
  type SuggestionResponse,
  type TriggerCharacterActionInput,
  type WindowCandidate,
  type WindowSelectionResult,
  type WatchingState,
} from "../shared/contracts";
import { transitionDesktopState } from "../shared/state-machine";
import {
  RequestValidationError,
  parseAccountDestination,
  parseAskMiloInput,
  parseBoolean,
  parseCopyReplyInput,
  parseContextPreviewInput,
  parseNoPayload,
  parseNudgePositionInput,
  parsePreviewAction,
  parseSelectWindowInput,
  parseSettingsPatch,
  parseTriggerCharacterActionInput,
} from "../shared/validation";
import { isTrustedSenderDescriptor } from "./security-policy";
import type { OverlayController } from "./overlay-controller";
import type { ContentFreeSettingsStore } from "./settings-store";
import type { NativeHelperClient } from "./native-helper-client";
import type { AuthSession } from "./auth-session";
import type { DesktopSuggestionClient } from "./desktop-suggestion-client";
import { normalizeRecentContext } from "./context-normalizer";
import { ContextChangeDetector } from "./context-change-detector";
import { extractLocalContext } from "./local-context-extractor";
import { registerSuggestionHotkey, type GlobalShortcutAdapter } from "./suggestion-hotkey";
import {
  bindNativeWindowIdentity,
  selectFreshWindow,
  toWindowCandidates,
  type InternalSelectedWindow,
} from "./window-selection";
import { WindowCaptureService } from "./window-capturer";
import { DesktopOcrEngine, type DesktopOcrEngineApi } from "./ocr-engine";
import { EventBus, MiloStateMachine, AnimationManager, STATE_PRIORITIES } from "./milo-core";
import { clampWithEdgePeeking, MIN_COMPANION_PEEK_PX } from "../shared/companion-bounds";

class UnavailableError extends Error {
  constructor() {
    super("UNAVAILABLE");
    this.name = "UnavailableError";
  }
}

type RegisterDesktopIpcOptions = Readonly<{
  window: BrowserWindow;
  companionWindow?: BrowserWindow | null;
  overlay: OverlayController;
  settingsStore: ContentFreeSettingsStore;
  nativeHelper: NativeHelperClient;
  authSession: AuthSession | null;
  suggestionClient: DesktopSuggestionClient | null;
  accountOpener: ((destination: AccountDestination) => Promise<void>) | null;
  windowCaptureService?: WindowCaptureService;
  ocrEngine?: DesktopOcrEngineApi;
  shortcutApi?: GlobalShortcutAdapter;
  characterStateMachine?: MiloStateMachine;
  animationManager?: AnimationManager;
}>;

export function createCompanionContextMenuTemplate(options: {
  window: BrowserWindow;
  companionWindow?: BrowserWindow | null;
  overlay: OverlayController;
  publish?: () => void;
}): MenuItemConstructorOptions[] {
  return [
    {
      label: "Open Milo",
      click: () => {
        options.overlay.setPanelOpen(true);
        if (!options.window.isDestroyed()) {
          options.window.showInactive();
        }
        options.publish?.();
      },
    },
    {
      label: "Milo Room",
      click: () => {
        options.overlay.setPanelOpen(true);
        if (!options.window.isDestroyed()) {
          options.window.showInactive();
        }
        options.publish?.();
      },
    },
    {
      label: "Customize",
      click: () => {
        options.overlay.setPanelOpen(true);
        if (!options.window.isDestroyed()) {
          options.window.showInactive();
        }
        options.publish?.();
      },
    },
    {
      label: "Settings",
      click: () => {
        options.overlay.setPanelOpen(true);
        if (!options.window.isDestroyed()) {
          options.window.showInactive();
        }
        options.publish?.();
      },
    },
    {
      label: "Hide Milo",
      click: () => {
        if (options.companionWindow && !options.companionWindow.isDestroyed()) {
          options.companionWindow.hide();
        }
      },
    },
  ];
}

export function registerDesktopIpc({
  window,
  companionWindow,
  overlay,
  settingsStore,
  nativeHelper,
  authSession,
  suggestionClient,
  accountOpener,
  windowCaptureService: customWindowCaptureService,
  ocrEngine: customOcrEngine,
  shortcutApi,
  characterStateMachine: customStateMachine,
  animationManager: customAnimationManager,
}: RegisterDesktopIpcOptions): () => void {
  const windowCaptureService = customWindowCaptureService ?? new WindowCaptureService(desktopCapturer);
  const ocrEngine = customOcrEngine ?? new DesktopOcrEngine();
  const characterEventBus = new EventBus();
  const characterStateMachine =
    customStateMachine ??
    new MiloStateMachine({
      initialState: settingsStore.getPaused() ? "paused" : "idle",
      eventBus: characterEventBus,
    });
  const animationManager =
    customAnimationManager ??
    new AnimationManager(characterStateMachine, characterStateMachine.eventBus);

  const unsubscribeCharacterState = characterStateMachine.eventBus.subscribe("state:changed", () => {
    publish();
  });

  let state: DesktopState = settingsStore.getPaused() ? "paused" : "idle";
  let replies: SyntheticSuggestion[] = [];
  let lastAction: DesktopSnapshot["lastAction"] = "none";
  let generationEpoch = 0;
  let selectedWindow: InternalSelectedWindow | null = null;
  let contextPreview: ContextPreview | null = null;
  let contextPreviewOptions: ContextPreviewInput | null = null;
  let selectionCheckRunning = false;
  let lastContextCheckAt = 0;
  const contextChangeDetector = new ContextChangeDetector();

  const watching = (): WatchingState => ({
    paused: state === "paused",
    selectedWindow: selectedWindow?.publicSummary ?? null,
    capability: { available: true },
  });

  const clearContextPreview = (): void => {
    contextPreview = null;
    contextPreviewOptions = null;
  };

  const snapshot = (): DesktopSnapshot => ({
    state,
    panelOpen: overlay.panelOpen,
    panelPlacement: overlay.placement,
    watching: watching(),
    settings: settingsStore.getPublicSettings(),
    auth: authSession?.getSnapshot() ?? {
      status: "unavailable",
      expiresAt: null,
      storageAvailable: false,
    },
    replies,
    lastAction,
    character: animationManager.getCharacterSnapshot(),
  });

  const publish = (): DesktopSnapshot => {
    const value = snapshot();
    if (!window.isDestroyed()) window.webContents.send(IPC_CHANNELS.stateChanged, value);
    if (companionWindow && !companionWindow.isDestroyed()) {
      companionWindow.webContents.send(IPC_CHANNELS.stateChanged, value);
    }
    return value;
  };

  const setPaused = (paused: boolean): WatchingState => {
    generationEpoch += 1;
    settingsStore.setPaused(paused);
    state = transitionDesktopState(state, paused ? "pause" : "resume");
    if (paused) {
      characterStateMachine.transition("PAUSE_TOGGLE");
      replies = [];
      clearContextPreview();
      contextChangeDetector.clear();
      nativeHelper.suspend();
      if (typeof overlay.setBubblesOpen === "function") {
        overlay.setBubblesOpen(false);
      }
    } else {
      characterStateMachine.transition("RESUME_TOGGLE");
    }
    lastAction = "none";
    publish();
    return watching();
  };

  const enumerateWindowCandidates = async (): Promise<WindowCandidate[]> => {
    const sources = await desktopCapturer.getSources({
      types: ["window"],
      thumbnailSize: { width: 0, height: 0 },
      fetchWindowIcons: false,
    });
    return toWindowCandidates(sources, window.getMediaSourceId());
  };

  const verifySelectedWindow = async (): Promise<void> => {
    if (selectionCheckRunning || state === "paused" || selectedWindow === null) return;
    selectionCheckRunning = true;
    try {
      const candidates = await enumerateWindowCandidates();
      const freshSource = selectFreshWindow(selectedWindow.sourceId, candidates);
      if (freshSource === null) {
        nativeHelper.suspend();
        selectedWindow = null;
        clearContextPreview();
        contextChangeDetector.clear();
        generationEpoch += 1;
        replies = [];
        lastAction = "none";
        state = transitionDesktopState(state, "fail");
        publish();
      } else {
        const refreshed = bindNativeWindowIdentity(
          freshSource,
          await nativeHelper.listWindows().catch(() => []),
        ) ?? freshSource;
        const titleChanged = refreshed.publicSummary.title !== selectedWindow.publicSummary.title;
        selectedWindow = refreshed;
        if (titleChanged) {
          clearContextPreview();
          publish();
        }

        const now = Date.now();
        if (refreshed.nativeIdentity !== null && state !== "generating" && now - lastContextCheckAt >= 3_000) {
          lastContextCheckAt = now;
          try {
            const extracted = await extractLocalContext(nativeHelper, refreshed.nativeIdentity, 6_000);
            const normalized = normalizeRecentContext(extracted.text, {
              maxMessages: 8,
              removeParticipantNames: true,
            });
            const observation = contextChangeDetector.observe(normalized.text);
            if (observation.changed) {
              clearContextPreview();
              replies = [];
              lastAction = "none";
              state = transitionDesktopState(state, "notice");
              publish();
            }
          } catch {
            // Transient local extraction failure does not imply the selected
            // window identity is stale and must not trigger a cloud request.
          }
        }
      }
    } catch {
      nativeHelper.suspend();
      selectedWindow = null;
      clearContextPreview();
      contextChangeDetector.clear();
      generationEpoch += 1;
      replies = [];
      lastAction = "none";
      state = transitionDesktopState(state, "fail");
      publish();
    } finally {
      selectionCheckRunning = false;
    }
  };

  const selectionTimer = setInterval(() => {
    void verifySelectedWindow();
  }, 2_000);
  selectionTimer.unref();

  const runSyntheticPreview = async (): Promise<SuggestionResponse> => {
    if (state === "paused") throw new UnavailableError();
    const epoch = ++generationEpoch;
    state = transitionDesktopState(state, "generate");
    replies = [];
    lastAction = "none";
    publish();
    await new Promise((resolve) => setTimeout(resolve, 480));

    if (epoch === generationEpoch && state !== "paused") {
      state = transitionDesktopState(state, "ready");
      replies = [...SYNTHETIC_SUGGESTIONS];
      if (typeof overlay.setBubblesOpen === "function" && !overlay.isPanelOpen()) {
        overlay.setBubblesOpen(true);
      }
      publish();
    }

    return {
      mode: "synthetic_preview",
      warning: "Synthetic shell preview only. Milo did not read, capture, upload, or save a chat.",
      replies: epoch === generationEpoch ? replies : [],
    };
  };

  const readCapturedText = async (sourceId: string): Promise<string> => {
    const frame = await windowCaptureService.captureWindow(sourceId);
    try {
      return (await ocrEngine.extractFromBuffer(frame.imageBuffer)).rawText;
    } finally {
      frame.imageBuffer.fill(0);
    }
  };

  // Pause, logout and window changes can mutate this state while awaiting I/O.
  const generationIsActive = (epoch: number): boolean => epoch === generationEpoch && state !== "paused";

  const runLiveSuggestion = async (options?: { forceOcr?: boolean }): Promise<SuggestionResponse> => {
    if (state === "paused" || selectedWindow === null) {
      throw new UnavailableError();
    }
    const requestedContextOptions: ContextPreviewInput = contextPreviewOptions === null
      ? { removeParticipantNames: true, maxMessages: 8 }
      : { ...contextPreviewOptions };
    clearContextPreview();
    contextChangeDetector.acknowledge();
    const epoch = ++generationEpoch;
    state = transitionDesktopState(state, "generate");
    replies = [];
    lastAction = "none";
    publish();

    try {
      const candidates = await enumerateWindowCandidates();
      const freshSource = selectFreshWindow(selectedWindow.sourceId, candidates);
      if (freshSource === null) throw new UnavailableError();
      const currentWindow = bindNativeWindowIdentity(
        freshSource,
        await nativeHelper.listWindows().catch(() => []),
      ) ?? freshSource;
      selectedWindow = currentWindow;

      let rawText = "";
      if (options?.forceOcr) {
        rawText = await readCapturedText(currentWindow.sourceId);
      } else {
        if (currentWindow.nativeIdentity !== null) {
          try {
            const extracted = await extractLocalContext(nativeHelper, currentWindow.nativeIdentity, 6_000);
            rawText = extracted.text;
          } catch (localError) {
            try {
              rawText = await readCapturedText(currentWindow.sourceId);
            } catch {
              throw localError;
            }
          }
        } else {
          rawText = await readCapturedText(currentWindow.sourceId);
        }
      }

      const context = normalizeRecentContext(rawText, requestedContextOptions);
      if (context.messageCount === 0 || context.text.trim().length === 0) {
        throw new UnavailableError();
      }
      const currentTone = settingsStore.getPublicSettings().activeTone ?? "standard";
      if (!generationIsActive(epoch)) throw new UnavailableError();
      if (authSession === null || suggestionClient === null) throw new UnavailableError();
      const accessToken = await authSession.getAccessToken();
      if (!generationIsActive(epoch)) throw new UnavailableError();
      const generated = await suggestionClient.suggest({
        accessToken,
        messages: context.text.split("\n").map((text) => ({ role: "unknown" as const, text })),
        tone: currentTone,
        relationshipStage: "dating",
      });
      const generatedReplies: SyntheticSuggestion[] = generated.replies.map((reply) => ({
        id: reply.category,
        label: `${reply.category[0]?.toUpperCase() ?? ""}${reply.category.slice(1)} choice`,
        text: reply.text,
        explanation: reply.whyItWorks,
      }));

      if (!generationIsActive(epoch)) throw new UnavailableError();

      replies = generatedReplies;
      state = transitionDesktopState(state, "ready");
      if (typeof overlay.setBubblesOpen === "function" && !overlay.isPanelOpen()) {
        overlay.setBubblesOpen(true);
      }
      publish();
      return { mode: "live", warning: generated.warning, replies };
    } catch (error) {
      if (epoch === generationEpoch && state !== "paused") {
        replies = [];
        if (typeof overlay.setBubblesOpen === "function") {
          overlay.setBubblesOpen(false);
        }
        state = transitionDesktopState(state, "fail");
        publish();
      }
      throw error;
    }
  };

  const showContextMenu = (): void => {
    const template: MenuItemConstructorOptions[] = [
      {
        label: state === "paused" ? "Resume watching" : "Pause watching",
        click: () => setPaused(state !== "paused"),
      },
      {
        label: "Reset position",
        click: () => overlay.reset(),
      },
      { type: "separator" },
      {
        label: "Show noticed state",
        enabled: state !== "paused",
        click: () => {
          state = transitionDesktopState(state, "notice");
          replies = [];
          publish();
        },
      },
      {
        label: "Show error state",
        enabled: state !== "paused",
        click: () => {
          state = transitionDesktopState(state, "fail");
          replies = [];
          publish();
        },
      },
      { type: "separator" },
      {
        label: "Quit Milo",
        click: () => {
          generationEpoch += 1;
          replies = [];
          clearContextPreview();
          app.quit();
        },
      },
    ];
    Menu.buildFromTemplate(template).popup({ window });
  };

  const showCompanionContextMenu = (targetWindow: BrowserWindow): void => {
    const template = createCompanionContextMenuTemplate({
      window,
      companionWindow: targetWindow,
      overlay,
      publish,
    });
    Menu.buildFromTemplate(template).popup({ window: targetWindow });
  };

  const allowedWindows: readonly BrowserWindow[] = companionWindow ? [window, companionWindow] : [window];
  const handlers = new Map<string, (event: IpcMainInvokeEvent, payload: unknown) => Promise<unknown>>();
  const handle = <T>(
    channel: string,
    operation: (payload: unknown, event: IpcMainInvokeEvent) => T | Promise<T>,
  ): void => {
    const handler = async (event: IpcMainInvokeEvent, payload: unknown): Promise<IpcResult<T>> => {
      if (!isTrustedIpcSender(event, allowedWindows)) return invalidRequestResult();
      try {
        return { ok: true, value: await operation(payload, event) };
      } catch (error) {
        if (error instanceof RequestValidationError) return invalidRequestResult();
        if (error instanceof UnavailableError) {
          return {
            ok: false,
            error: {
              code: "UNAVAILABLE",
              message: "This action is unavailable while Milo is paused.",
            },
          };
        }
        return {
          ok: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Milo could not complete that action. Please try again.",
          },
        };
      }
    };
    ipcMain.handle(channel, handler);
    handlers.set(channel, handler);
  };

  handle(IPC_CHANNELS.getSnapshot, (payload) => {
    parseNoPayload(payload);
    return snapshot();
  });
  handle(IPC_CHANNELS.selectWindow, async (payload): Promise<WindowSelectionResult> => {
    const input = parseSelectWindowInput(payload);
    const candidates = await enumerateWindowCandidates();
    if (input.sourceId === undefined) return { mode: "candidates", candidates };
    const selected = selectFreshWindow(input.sourceId, candidates);
    if (selected === null) throw new RequestValidationError();
    const nativeSelected = bindNativeWindowIdentity(
      selected,
      await nativeHelper.listWindows().catch(() => []),
    );
    selectedWindow = nativeSelected ?? selected;
    clearContextPreview();
    contextChangeDetector.clear();
    lastContextCheckAt = 0;
    generationEpoch += 1;
    replies = [];
    lastAction = "none";
    if (state !== "paused") state = "idle";
    publish();
    return { mode: "selected", window: selected.publicSummary };
  });
  handle(IPC_CHANNELS.previewContext, async (payload): Promise<ContextPreview> => {
    const input = parseContextPreviewInput(payload);
    clearContextPreview();
    if (state === "paused" || selectedWindow === null) throw new UnavailableError();
    const candidates = await enumerateWindowCandidates();
    const freshSource = selectFreshWindow(selectedWindow.sourceId, candidates);
    if (freshSource === null) throw new UnavailableError();
    const currentWindow = bindNativeWindowIdentity(
      freshSource,
      await nativeHelper.listWindows().catch(() => []),
    ) ?? freshSource;
    selectedWindow = currentWindow;

    let extractedText = "";
    let extractedTruncated = false;
    if (currentWindow.nativeIdentity !== null) {
      try {
        const extracted = await extractLocalContext(nativeHelper, currentWindow.nativeIdentity, 6_000);
        extractedText = extracted.text;
        extractedTruncated = extracted.truncated;
      } catch {
        // Fall back to OCR below
      }
    }
    if (!extractedText.trim()) {
      try {
        const frame = await windowCaptureService.captureWindow(selectedWindow.sourceId);
        const ocr = await ocrEngine.extractFromBuffer(frame.imageBuffer);
        extractedText = ocr.rawText;
      } catch {
        throw new UnavailableError();
      }
    }

    const normalized = normalizeRecentContext(extractedText, {
      maxMessages: input.maxMessages,
      removeParticipantNames: input.removeParticipantNames,
    });
    if (normalized.messageCount === 0) throw new UnavailableError();
    contextPreview = {
      text: normalized.text,
      messageCount: normalized.messageCount,
      truncated: normalized.truncated || extractedTruncated,
      participantNamesRemoved: normalized.participantNamesRemoved,
      maxMessages: input.maxMessages,
    };
    contextPreviewOptions = { ...input };
    return contextPreview;
  });
  handle(IPC_CHANNELS.pauseWatching, (payload) => setPaused(parseBoolean(payload)));
  handle(IPC_CHANNELS.askMilo, async (payload) => {
    const input = parseAskMiloInput(payload);
    return runLiveSuggestion({ forceOcr: input.mode === "screen_capture" });
  });
  handle(IPC_CHANNELS.copyReply, (payload) => {
    const input = parseCopyReplyInput(payload);
    const reply = replies.find((candidate) => candidate.id === input.suggestionId);
    if (!reply) throw new UnavailableError();
    clipboard.writeText(reply.text, "clipboard");
    lastAction = "copied";
    if (typeof overlay.setBubblesOpen === "function") {
      overlay.setBubblesOpen(false);
    }
    publish();
  });
  handle(IPC_CHANNELS.getSettings, (payload): PublicSettings => {
    parseNoPayload(payload);
    return settingsStore.getPublicSettings();
  });
  handle(IPC_CHANNELS.updateSettings, (payload) => {
    const patch = parseSettingsPatch(payload);
    if (patch.opacity !== undefined && !window.isDestroyed()) {
      window.setOpacity(Math.max(0.75, Math.min(1.0, patch.opacity)));
    }
    if (patch.isPinned !== undefined && !window.isDestroyed()) {
      window.setAlwaysOnTop(patch.isPinned);
    }
    const updated = settingsStore.updatePublicSettings(patch);
    publish();
    return updated;
  });
  handle(IPC_CHANNELS.openAccount, async (payload) => {
    const destination = parseAccountDestination(payload);
    if (accountOpener === null) throw new UnavailableError();
    await accountOpener(destination);
  });
  handle(IPC_CHANNELS.signIn, async (payload) => {
    parseNoPayload(payload);
    if (authSession !== null) {
      const auth = await authSession.signIn();
      publish();
      return auth;
    }
    publish();
    return {
      status: "authenticated" as const,
      expiresAt: null,
      storageAvailable: true,
    };
  });
  handle(IPC_CHANNELS.signOut, async (payload) => {
    parseNoPayload(payload);
    generationEpoch += 1;
    replies = [];
    if (typeof overlay.setBubblesOpen === "function") {
      overlay.setBubblesOpen(false);
    }
    nativeHelper.suspend();
    selectedWindow = null;
    clearContextPreview();
    contextChangeDetector.clear();
    state = settingsStore.getPaused() ? "paused" : "idle";
    const auth = authSession === null
      ? { status: "unavailable" as const, expiresAt: null, storageAvailable: false }
      : await authSession.signOut();
    publish();
    return auth;
  });
  handle(IPC_CHANNELS.setPanelOpen, (payload) => {
    const open = parseBoolean(payload);
    if (!open) {
      clearContextPreview();
      if (typeof overlay.setBubblesOpen === "function") {
        overlay.setBubblesOpen(false);
      }
    }
    overlay.setPanelOpen(open);
    return publish();
  });
  handle(IPC_CHANNELS.previewState, async (payload) => {
    const action = parsePreviewAction(payload);
    if (action === "generate") {
      characterStateMachine.transition("ASK_MILO");
      await runSyntheticPreview();
      characterStateMachine.transition("SUGGESTIONS_READY");
    } else {
      generationEpoch += 1;
      state = transitionDesktopState(state, action === "reset" ? "reset" : action);
      if (action === "notice") {
        characterStateMachine.transition("MESSAGE_NOTICED");
      } else if (action === "fail") {
        characterStateMachine.transition("ERROR_OCCURRED");
      } else if (action === "reset") {
        characterStateMachine.transition("RESET");
      }
      replies = [];
      lastAction = "none";
      if (typeof overlay.setBubblesOpen === "function") {
        overlay.setBubblesOpen(false);
      }
      publish();
    }
    return snapshot();
  });
  handle(IPC_CHANNELS.nudgePosition, (payload) => {
    overlay.nudge(parseNudgePositionInput(payload));
  });
  handle(IPC_CHANNELS.resetPosition, (payload) => {
    parseNoPayload(payload);
    overlay.reset();
  });
  handle(IPC_CHANNELS.openContextMenu, (payload, event) => {
    parseNoPayload(payload);
    if (companionWindow && !companionWindow.isDestroyed() && event.sender === companionWindow.webContents) {
      showCompanionContextMenu(companionWindow);
    } else {
      showContextMenu();
    }
  });
  handle(IPC_CHANNELS.triggerCharacterAction, (payload) => {
    const input = parseTriggerCharacterActionInput(payload);
    switch (input.action) {
      case "drag_start": {
        characterStateMachine.transition("DRAG_START");
        break;
      }
      case "drag_move": {
        if (companionWindow && !companionWindow.isDestroyed()) {
          const bounds = companionWindow.getBounds();
          const rawX = bounds.x + input.deltaX;
          const rawY = bounds.y + input.deltaY;
          const center = {
            x: rawX + Math.round(bounds.width / 2),
            y: rawY + Math.round(bounds.height / 2),
          };
          const display = screen.getDisplayNearestPoint(center);
          const clamped = clampWithEdgePeeking(
            { x: rawX, y: rawY },
            { width: bounds.width, height: bounds.height },
            display.workArea,
            MIN_COMPANION_PEEK_PX,
          );
          companionWindow.setPosition(clamped.x, clamped.y, false);
        }
        break;
      }
      case "drag_end": {
        characterStateMachine.transition("DRAG_END");
        break;
      }
      case "look_around": {
        if (characterStateMachine.currentState === "idle") {
          characterStateMachine.transition("LOOK_AROUND");
        }
        break;
      }
      case "play_animation": {
        const animName = input.animationName ?? "wave";
        const config = HARMLESS_ANIMATIONS[animName] ?? HARMLESS_ANIMATIONS.wave;
        animationManager.requestAnimation({
          id: animName,
          state: config.state,
          durationMs: config.durationMs,
          priority: STATE_PRIORITIES[config.state],
          returnState: "idle",
        });
        break;
      }
    }
  });
  handle(IPC_CHANNELS.quit, (payload) => {
    parseNoPayload(payload);
    generationEpoch += 1;
    replies = [];
    setImmediate(() => app.quit());
  });

  const disposeSuggestionHotkey = registerSuggestionHotkey(shortcutApi ?? globalShortcut, async () => {
    if (state === "paused") throw new UnavailableError();
    if (selectedWindow === null) throw new UnavailableError();
    await runLiveSuggestion();
  });

  return () => {
    clearInterval(selectionTimer);
    disposeSuggestionHotkey();
    unsubscribeCharacterState();
    characterStateMachine.dispose();
    animationManager.dispose();
    generationEpoch += 1;
    replies = [];
    if (typeof overlay.setBubblesOpen === "function") {
      overlay.setBubblesOpen(false);
    }
    clearContextPreview();
    contextChangeDetector.clear();
    nativeHelper.suspend();
    selectedWindow = null;
    void ocrEngine.terminate().catch(() => undefined);
    for (const channel of handlers.keys()) ipcMain.removeHandler(channel);
  };
}

function isTrustedIpcSender(
  event: IpcMainInvokeEvent,
  windowOrWindows: BrowserWindow | readonly BrowserWindow[],
): boolean {
  const allowedWindows = Array.isArray(windowOrWindows) ? windowOrWindows : [windowOrWindows];
  const matchingWindow = allowedWindows.find(
    (w) => !w.isDestroyed() && w.webContents === event.sender,
  );
  if (!matchingWindow || event.sender.isDestroyed()) {
    return false;
  }
  const senderFrame = event.senderFrame;
  if (!senderFrame || senderFrame.isDestroyed() || senderFrame !== event.sender.mainFrame) {
    return false;
  }
  return isTrustedSenderDescriptor({
    senderId: event.sender.id,
    expectedSenderId: matchingWindow.webContents.id,
    isMainFrame: true,
    url: senderFrame.url,
  });
}

function invalidRequestResult<T>(): IpcResult<T> {
  return {
    ok: false,
    error: {
      code: "INVALID_REQUEST",
      message: "Milo rejected an invalid desktop request.",
    },
  };
}
