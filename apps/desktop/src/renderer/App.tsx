import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CAT_APPEARANCES,
  CONTEXT_PREVIEW_MESSAGE_LIMITS,
  TONE_PROFILE_METADATA,
  type CatAppearance,
  type AppView,
  type ContextPreview,
  type ContextPreviewInput,
  type DesktopSnapshot,
  type DesktopState,
  type DockMode,
  type MiloAppearance,
  type MotionPreference,
  type PanelPlacement,
  type PositionDirection,
  type PublicSettingsPatch,
  type SyntheticSuggestion,
  type ThemePreference,
  type ToneProfile,
  type WindowCandidate,
} from "../shared/contracts";
import { shouldReduceMotion } from "../shared/motion";
import {
  AlertIcon,
  CheckIcon,
  CloseIcon,
  CopyIcon,
  EyeOffIcon,
  MessageIcon,
  MoreIcon,
  PauseIcon,
  PlayIcon,
  SettingsIcon,
  ShieldIcon,
  SparkIcon,
  WindowIcon,
} from "./icons";
import { MiloCat } from "./MiloCat";
import { sound } from "./audio";
import {
  ProgressBar,
  SegmentedControl,
  Select,
  SidebarItem,
  Slider,
  Toggle,
} from "./components/primitives";

export const CAT_APPEARANCE_PRESETS: Record<
  CatAppearance,
  { label: string; cat: string; ear: string; nose: string; badge: string }
> = {
  charcoal: { label: "Charcoal", cat: "#2b3044", ear: "#d97757", nose: "#c86d51", badge: "#d97757" },
  slate: { label: "Slate", cat: "#4a5568", ear: "#7b8fab", nose: "#6b7fa0", badge: "#7b8fab" },
  mauve: { label: "Mauve", cat: "#7c6b7e", ear: "#b8939b", nose: "#a8838b", badge: "#b8939b" },
  caramel: { label: "Caramel", cat: "#8b6a3e", ear: "#c49a6c", nose: "#b58a5c", badge: "#c49a6c" },
};

const DEFAULT_APPEARANCE: MiloAppearance = {
  fur: "charcoal",
  eyes: "classic",
  accessories: {},
  animationPersonality: "calm",
};

function xpTargetForLevel(level: number): number {
  if (level <= 1) return 100;
  if (level === 2) return 250;
  if (level === 3) return 500;
  return 1_000 * (level - 3);
}

const INITIAL_SNAPSHOT: DesktopSnapshot = {
  state: "idle",
  panelOpen: false,
  panelPlacement: "right-down",
  watching: {
    paused: false,
    selectedWindow: null,
    capability: { available: true },
  },
  auth: {
    status: "signed_out",
    expiresAt: null,
    storageAvailable: true,
  },
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
    dockMode: "free",
    catAppearance: "charcoal",
    launchAtLogin: false,
    startMinimized: true,
    closeBehavior: "hide",
    language: "system",
    appearance: DEFAULT_APPEARANCE,
    progress: {
      xp: 0,
      level: 1,
      firstMetAt: "2026-01-01T00:00:00.000Z",
      currentStreak: 0,
    },
    room: { background: "default", items: [] },
  },
  replies: [],
  lastAction: "none",
};

const STATE_COPY: Record<DesktopState, { label: string; detail: string }> = {
  idle: { label: "Ready when you are", detail: "Choose a chat window to begin." },
  noticed: { label: "New activity", detail: "Milo noticed a local change." },
  generating: { label: "Thinking", detail: "Preparing private suggestions." },
  ready: { label: "Suggestions ready", detail: "Review and edit before copying." },
  paused: { label: "Milo paused", detail: "Milo is not reading the selected window." },
  error: { label: "Milo needs attention", detail: "Check your connection or try again." },
};

const DEFAULT_CONTEXT_PREVIEW_INPUT: ContextPreviewInput = {
  removeParticipantNames: true,
  maxMessages: 8,
};

export type PopoutBubblesProps = {
  replies: readonly SyntheticSuggestion[];
  panelPlacement: PanelPlacement;
  copiedSuggestion: "safe" | "confident" | "playful" | null;
  onCopy: (suggestionId: "safe" | "confident" | "playful") => void;
  onClose?: () => void;
};

export function PopoutBubbles({
  replies,
  panelPlacement,
  copiedSuggestion,
  onCopy,
  onClose,
}: PopoutBubblesProps) {
  const isRight = panelPlacement.startsWith("right");
  const isDown = panelPlacement.endsWith("down");
  const tailClass = isRight ? "popout-bubbles--tail-left" : "popout-bubbles--tail-right";
  const verticalClass = isDown ? "popout-bubbles--down" : "popout-bubbles--up";

  return (
    <aside
      className={`popout-bubbles ${tailClass} ${verticalClass}`}
      role="region"
      aria-label="Milo pop-out suggestions"
    >
      <div className="popout-bubbles__header">
        <div className="popout-bubbles__meta">
          <span className="popout-bubbles__spark" aria-hidden="true">
            <SparkIcon className="popout-bubbles__spark-icon" />
          </span>
          <span className="popout-bubbles__title">Milo suggestions</span>
        </div>
        {onClose && (
          <button
            className="popout-bubbles__dismiss"
            type="button"
            aria-label="Dismiss suggestions"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
          >
            <CloseIcon />
          </button>
        )}
      </div>

      <div className="popout-bubbles__list" role="feed" aria-label="Suggested replies">
        {replies.map((reply) => {
          const isCopied = copiedSuggestion === reply.id;
          return (
            <article
              key={reply.id}
              className={`speech-bubble speech-bubble--${reply.id} reply-card reply-card--${reply.id} card bg-base-100/95 shadow-md border border-base-content/10 hover:shadow-lg transition-all duration-200 cursor-pointer`}
              role="button"
              tabIndex={0}
              aria-label={`Copy ${reply.label}: ${reply.text}`}
              onClick={() => onCopy(reply.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onCopy(reply.id);
                }
              }}
            >
              <div className="speech-bubble__heading reply-card__heading flex items-center justify-between gap-2">
                <div className="reply-card__badge-wrap flex items-center gap-2">
                  <span
                    className={`reply-card__category-badge reply-card__category-badge--${reply.id} badge badge-sm ${
                      reply.id === "safe"
                        ? "badge-info"
                        : reply.id === "confident"
                        ? "badge-primary"
                        : "badge-secondary"
                    }`}
                  >
                    {reply.id === "safe" ? "Safe" : reply.id === "confident" ? "Confident" : "Playful"}
                  </span>
                  <strong className="speech-bubble__title reply-card__title text-xs font-semibold">
                    {reply.label}
                  </strong>
                </div>
                <span className={`copy-button ${isCopied ? "copy-button--copied btn-success" : ""} btn btn-xs gap-1 pointer-events-none`}>
                  {isCopied ? <CheckIcon /> : <CopyIcon />}
                  <span>{isCopied ? "Copied!" : "Copy"}</span>
                </span>
              </div>
              <p className="speech-bubble__body reply-card__body text-sm font-medium mt-1">
                {reply.text}
              </p>
              <div className="speech-bubble__rationale reply-card__rationale mt-1 text-xs text-base-content/70">
                <small>{reply.explanation}</small>
              </div>
            </article>
          );
        })}
      </div>
    </aside>
  );
}

export function App({ initialSnapshot = INITIAL_SNAPSHOT }: { initialSnapshot?: DesktopSnapshot } = {}) {
  const [appViewState, setAppViewState] = useState<AppView>("home");
  const [settingsTab, setSettingsTab] = useState("general");
  const [snapshot, setSnapshot] = useState<DesktopSnapshot>(initialSnapshot);
  const [busy, setBusy] = useState(false);
  const [windowCandidates, setWindowCandidates] = useState<readonly WindowCandidate[]>([]);
  const [windowPickerOpen, setWindowPickerOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("Milo is ready. Choose a window to begin.");
  const [authBusy, setAuthBusy] = useState(false);
  const [requestWarning, setRequestWarning] = useState<string | null>(null);
  const [contextPreview, setContextPreview] = useState<ContextPreview | null>(null);
  const [contextPreviewInput, setContextPreviewInput] = useState<ContextPreviewInput>(DEFAULT_CONTEXT_PREVIEW_INPUT);
  const [contextPreviewBusy, setContextPreviewBusy] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const catButtonRef = useRef<HTMLButtonElement>(null);
  const panelWasOpenRef = useRef(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [copiedSuggestion, setCopiedSuggestion] = useState<"safe" | "confident" | "playful" | null>(null);
  const [dismissedReplies, setDismissedReplies] = useState<readonly SyntheticSuggestion[] | null>(null);
  const bubblesVisible = snapshot.replies !== dismissedReplies;

  const stateCopy = STATE_COPY[snapshot.state];
  const selectedWindowTitle = snapshot.watching.selectedWindow?.title;
  const isAuthenticated = snapshot.auth.status === "authenticated";
  const canSuggest = isAuthenticated && selectedWindowTitle !== undefined && snapshot.state !== "paused" && !busy && !authBusy;
  const appearance = snapshot.settings.appearance ?? DEFAULT_APPEARANCE;
  const progress = snapshot.settings.progress ?? INITIAL_SNAPSHOT.settings.progress!;

  const clearLocalContextPreview = useCallback(() => {
    setContextPreview(null);
    setContextPreviewInput(DEFAULT_CONTEXT_PREVIEW_INPUT);
  }, []);

  const previousSelectedWindowRef = useRef<string | undefined>(selectedWindowTitle);

  useEffect(() => {
    let active = true;
    const unsubscribe = window.milo.onStateChanged((next) => {
      if (active) setSnapshot(next);
    });
    void window.milo
      .getSnapshot()
      .then((next) => {
        if (active) setSnapshot(next);
      })
      .catch(() => {
        if (active) setAnnouncement("Milo could not load the local shell state.");
      });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => window.milo.onNavigate((view) => setAppViewState(view)), []);

  useEffect(() => {
    const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const applyPreferences = () => {
      const theme = snapshot.settings.theme === "system"
        ? darkQuery.matches ? "dark" : "light"
        : snapshot.settings.theme;
      document.documentElement.dataset.theme = theme;
      document.documentElement.dataset.reducedMotion = String(
        shouldReduceMotion(snapshot.settings.motion, motionQuery.matches),
      );
      document.documentElement.dataset.motion = snapshot.settings.motion;
    };
    applyPreferences();
    darkQuery.addEventListener("change", applyPreferences);
    motionQuery.addEventListener("change", applyPreferences);
    return () => {
      darkQuery.removeEventListener("change", applyPreferences);
      motionQuery.removeEventListener("change", applyPreferences);
    };
  }, [snapshot.settings.motion, snapshot.settings.theme]);

  useEffect(() => {
    const appearanceKey = snapshot.settings.appearance?.fur ?? snapshot.settings.catAppearance ?? "charcoal";
    const preset = CAT_APPEARANCE_PRESETS[appearanceKey] ?? CAT_APPEARANCE_PRESETS.charcoal;
    const rootStyle = document.documentElement.style;
    rootStyle.setProperty("--cat", preset.cat);
    rootStyle.setProperty("--cat-ear", preset.ear);
    rootStyle.setProperty("--cat-nose", preset.nose);
    rootStyle.setProperty("--cat-badge", preset.badge);
    document.documentElement.dataset.catAppearance = appearanceKey;
  }, [snapshot.settings.appearance?.fur, snapshot.settings.catAppearance]);

  useEffect(() => {
    sound.setConfig(
      snapshot.settings.soundEnabled ?? true,
      snapshot.settings.soundVolume ?? 0.7,
      snapshot.settings.noticeSoundEnabled ?? false,
    );
  }, [snapshot.settings.noticeSoundEnabled, snapshot.settings.soundEnabled, snapshot.settings.soundVolume]);

  const previousStateRef = useRef<DesktopState>(snapshot.state);
  useEffect(() => {
    if (previousStateRef.current !== snapshot.state) {
      if (snapshot.state === "ready") {
        sound.playPurr();
      } else if (snapshot.state === "noticed") {
        sound.playNotice();
      }
      previousStateRef.current = snapshot.state;
    }
  }, [snapshot.state]);

  useEffect(() => {
    if (snapshot.panelOpen) closeButtonRef.current?.focus();
    else if (panelWasOpenRef.current) catButtonRef.current?.focus();
    panelWasOpenRef.current = snapshot.panelOpen;
  }, [snapshot.panelOpen]);

  useEffect(() => {
    const windowChanged = previousSelectedWindowRef.current !== selectedWindowTitle;
    if (!snapshot.panelOpen || snapshot.state === "paused" || windowChanged || snapshot.auth.status === "signed_out") {
      clearLocalContextPreview();
    }
    previousSelectedWindowRef.current = selectedWindowTitle;
  }, [clearLocalContextPreview, selectedWindowTitle, snapshot.auth.status, snapshot.panelOpen, snapshot.state]);

  useEffect(() => () => {
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
  }, []);

  const placementClasses = useMemo(
    () => `shell shell--${snapshot.panelOpen ? "expanded" : "collapsed"} shell--${snapshot.panelPlacement}`,
    [snapshot.panelOpen, snapshot.panelPlacement],
  );

  const safely = useCallback(async (operation: () => Promise<unknown>, success?: string) => {
    try {
      await operation();
      if (success) setAnnouncement(success);
    } catch {
      setAnnouncement("Milo could not complete that action. Try again.");
    }
  }, []);

  const togglePanel = useCallback(async (open: boolean) => {
    if (!open) clearLocalContextPreview();
    await safely(async () => {
      const next = await window.milo.setPanelOpen(open);
      setSnapshot(next);
    });
  }, [clearLocalContextPreview, safely]);

  const askMilo = async (mode: "selected_window" | "screen_capture" = "selected_window") => {
    if (!isAuthenticated) {
      setAnnouncement("Sign in to ask Milo for a suggestion.");
      return;
    }
    if (selectedWindowTitle === undefined) {
      setAnnouncement("Choose a chat window before asking Milo.");
      return;
    }
    if (snapshot.state === "paused") {
      setAnnouncement("Resume Milo before asking for a suggestion.");
      return;
    }
    setBusy(true);
    clearLocalContextPreview();
    setRequestWarning(null);
    setAnnouncement(
      mode === "screen_capture"
        ? "Capturing screen and asking Milo for private suggestions."
        : "Asking Milo for three private suggestions.",
    );
    try {
      const response = await window.milo.askMilo({ mode });
      setRequestWarning(response.warning);
      setAnnouncement(response.warning ?? "Suggestions are ready. Review before copying.");
    } catch {
      setAnnouncement("Milo could not prepare suggestions. Check the selected window and try again.");
    } finally {
      setBusy(false);
    }
  };

  const signIn = async () => {
    setAuthBusy(true);
    setAnnouncement("Opening secure sign-in in your browser.");
    try {
      const auth = await window.milo.signIn();
      setSnapshot((current) => ({ ...current, auth }));
      setAnnouncement(auth.status === "authenticated" ? "You are signed in. Choose a window to ask Milo." : "Milo could not complete sign-in.");
    } catch {
      setAnnouncement("Milo could not complete sign-in. You can try again.");
    } finally {
      setAuthBusy(false);
    }
  };

  const signOut = async () => {
    setAuthBusy(true);
    try {
      const auth = await window.milo.signOut();
      setSnapshot((current) => ({ ...current, auth }));
      setRequestWarning(null);
      clearLocalContextPreview();
      setAnnouncement("You are signed out. Your local session was cleared.");
    } catch {
      setAnnouncement("Milo could not clear the local session. Try again.");
    } finally {
      setAuthBusy(false);
    }
  };

  const pauseWatching = async (paused: boolean) => {
    if (paused) clearLocalContextPreview();
    await safely(
      () => window.milo.pauseWatching(paused),
      paused ? "Milo paused. It is not reading the selected window." : "Milo resumed local window awareness.",
    );
  };

  const openWindowPicker = async () => {
    setBusy(true);
    try {
      const result = await window.milo.selectWindow({});
      if (result.mode !== "candidates") throw new Error("INVALID_WINDOW_PICKER_STATE");
      setWindowCandidates(result.candidates);
      setWindowPickerOpen(true);
      setAnnouncement(
        result.candidates.length > 0
          ? "Choose one window for Milo to watch."
          : "No eligible application windows are currently available.",
      );
    } catch {
      setAnnouncement("Milo could not enumerate local application windows.");
    } finally {
      setBusy(false);
    }
  };

  const chooseWindow = async (candidate: WindowCandidate) => {
    setBusy(true);
    try {
      const result = await window.milo.selectWindow({ sourceId: candidate.sourceId });
      if (result.mode !== "selected") throw new Error("WINDOW_SELECTION_REJECTED");
      setWindowPickerOpen(false);
      setWindowCandidates([]);
      clearLocalContextPreview();
      setAnnouncement("Window selected. Milo will only use it when you ask for a suggestion.");
    } catch {
      setAnnouncement("That window is no longer available. Refresh the list and choose again.");
    } finally {
      setBusy(false);
    }
  };

  const previewLocalContext = async () => {
    if (selectedWindowTitle === undefined) {
      setAnnouncement("Choose a chat window before previewing local context.");
      return;
    }
    if (snapshot.state === "paused") {
      setAnnouncement("Resume Milo before previewing local context.");
      return;
    }
    setContextPreviewBusy(true);
    setContextPreview(null);
    setRequestWarning(null);
    setAnnouncement("Reading normalized context locally. Nothing is being sent.");
    try {
      const result = await window.milo.previewContext(contextPreviewInput);
      setContextPreview(result);
      setAnnouncement("Local context preview ready. Minimal text is sent only after you click Suggest.");
    } catch {
      setContextPreview(null);
      setAnnouncement("Milo could not prepare a local context preview. Try again.");
    } finally {
      setContextPreviewBusy(false);
    }
  };

  const updateSettings = async (patch: PublicSettingsPatch) => {
    await safely(() => window.milo.updateSettings(patch), "Content-free preference saved.");
  };

  const copyReply = async (suggestionId: "safe" | "confident" | "playful") => {
    try {
      await window.milo.copyReply({ suggestionId });
      sound.playPop();
      setCopiedSuggestion(suggestionId);
      setAnnouncement("Reply copied. Review it before sending. Milo never sends messages for you.");
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopiedSuggestion(null), 2_000);
    } catch {
      setAnnouncement("Milo could not copy that reply. Try again.");
    }
  };

  const handleBubbleCopy = async (suggestionId: "safe" | "confident" | "playful") => {
    setDismissedReplies(snapshot.replies);
    await copyReply(suggestionId);
  };

  const handleBubbleDismiss = () => {
    setDismissedReplies(snapshot.replies);
    void window.milo.setPanelOpen(false);
  };

  const moveOverlay = useCallback(async (direction: PositionDirection, step: 10 | 40) => {
    await safely(
      () => window.milo.nudgePosition({ direction, step }),
      `Milo moved ${direction}.`,
    );
  }, [safely]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && snapshot.panelOpen) {
        event.preventDefault();
        void togglePanel(false);
        return;
      }
      if (event.shiftKey && event.key === "F10") {
        event.preventDefault();
        void safely(() => window.milo.openContextMenu());
        return;
      }
      if (event.altKey && ["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"].includes(event.key)) {
        event.preventDefault();
        const direction = event.key.replace("Arrow", "").toLowerCase() as PositionDirection;
        void moveOverlay(direction, event.shiftKey ? 40 : 10);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [moveOverlay, safely, snapshot.panelOpen, togglePanel]);

  return (
    <main
      className={placementClasses}
      data-state={snapshot.state}
      onContextMenu={(event) => {
        event.preventDefault();
        void safely(() => window.milo.openContextMenu());
      }}
    >
      <span className="sr-only">
        Drag the grip to reposition Milo, or use Alt plus an arrow key. Hold Shift for a larger step.
      </span>

      <section className="cat-dock" aria-label="Milo desktop companion">
        <div className="drag-handle" aria-hidden="true">
          <span />
        </div>
        <button
          ref={catButtonRef}
          className="cat-button"
          type="button"
          aria-label={snapshot.panelOpen ? "Collapse Milo panel" : "Open Milo panel"}
          aria-expanded={snapshot.panelOpen}
          onClick={() => void togglePanel(!snapshot.panelOpen)}
        >
          <MiloCat state={snapshot.state} />
        </button>
        {snapshot.settings.showWatchingIndicator && (
          <div className="watching-pill" aria-label={`${stateCopy.label}. ${selectedWindowTitle ?? stateCopy.detail}`}>
            <StateMark state={snapshot.state} />
            <span>
              {selectedWindowTitle
                ? snapshot.state === "paused" ? `Paused: ${selectedWindowTitle}` : `Watching: ${selectedWindowTitle}`
                : "Choose a chat"}
            </span>
          </div>
        )}
      </section>

      {!snapshot.panelOpen && snapshot.replies.length > 0 && bubblesVisible && (
        <PopoutBubbles
          replies={snapshot.replies}
          panelPlacement={snapshot.panelPlacement}
          copiedSuggestion={copiedSuggestion}
          onCopy={(id) => void handleBubbleCopy(id)}
          onClose={handleBubbleDismiss}
        />
      )}

      {snapshot.panelOpen && (
        <section className="panel" role="dialog" aria-modal="false" aria-label="Milo companion">
          <header className="panel__header">
            <div className="brand-lockup">
              <div className="brand-avatar" aria-hidden="true">M</div>
              <div>
                <p className="eyebrow">Private companion</p>
                <h1 id="panel-title">Milo</h1>
              </div>
            </div>
            <div className="header-actions">
              {isAuthenticated ? (
                <button className="auth-button" type="button" disabled={authBusy} onClick={() => void signOut()}>
                  {authBusy ? "Signing out…" : "Sign out"}
                </button>
              ) : (
                <button className="auth-button auth-button--primary" type="button" disabled={authBusy || snapshot.auth.status === "unavailable"} onClick={() => void signIn()}>
                  {authBusy ? "Signing in…" : "Sign in"}
                </button>
              )}
              <button
                className="icon-button"
                type="button"
                aria-label="Open Milo menu"
                title="Menu (Shift+F10)"
                onClick={() => void safely(() => window.milo.openContextMenu())}
              >
                <MoreIcon />
              </button>
              <button
                ref={closeButtonRef}
                className="icon-button"
                type="button"
                aria-label="Collapse Milo panel"
                onClick={() => void togglePanel(false)}
              >
                <CloseIcon />
              </button>
            </div>
          </header>

          {appViewState === "home" ? (
            <div className="home-layout">
              <div className="home-header">
                <h2>Milo</h2>
                <button className="icon-button" type="button" aria-label="Settings" onClick={() => setAppViewState("settings")}>
                  <SettingsIcon />
                </button>
              </div>
              <div className="home-hero">
                <div className="home-hero__cat">
                  <MiloCat state={snapshot.state} appearance={snapshot.settings.appearance} />
                </div>
                <h3>Welcome back!</h3>
                <button className="button button--primary" type="button" onClick={() => setAppViewState("workspace")}>
                  Open Desktop Milo
                </button>
              </div>
              <div className="home-actions">
                <button className="button button--secondary" type="button" onClick={() => setAppViewState("room")}>Milo Room</button>
                <button className="button button--secondary" type="button" onClick={() => setAppViewState("customize")}>Customize</button>
              </div>
              <div className="home-stats">
                <span>Friendship level {progress.level}</span>
                <span>{progress.currentStreak} day streak</span>
              </div>
              <ProgressBar value={progress.xp} max={xpTargetForLevel(progress.level)} label="Friendship XP" />
              <div className="home-privacy">
                <ShieldIcon />
                <div>
                  <strong>Milo&apos;s Eyes</strong>
                  <span>{selectedWindowTitle ?? "Selected window only"}</span>
                </div>
              </div>
            </div>
          ) : appViewState === "settings" ? (
            <div className="settings-layout">
              <div className="settings-header">
                <h2>Settings</h2>
                <button className="text-button" type="button" onClick={() => setAppViewState("home")}>
                  Done
                </button>
              </div>
              <div className="settings-body-split">
                <div className="settings-sidebar">
                  {["general", "milo", "sound", "display", "companion", "privacy", "data"].map((tab) => (
                    <SidebarItem
                      key={tab}
                      active={settingsTab === tab}
                      className="settings-tab"
                      onClick={() => setSettingsTab(tab)}
                    >
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </SidebarItem>
                  ))}
                </div>
                <div className="settings-content">
                  {settingsTab === "general" && (
                    <div className="settings-block">
                      <h3 className="settings-block__title">General</h3>
                      <Toggle
                        label="Start Milo with Windows"
                        description="Uses the standard Windows startup entry."
                        checked={snapshot.settings.launchAtLogin ?? false}
                        onChange={(event) => void updateSettings({ launchAtLogin: event.target.checked })}
                      />
                      <Toggle
                        label="Start with the workspace closed"
                        description="Show only the small desktop companion after sign-in."
                        checked={snapshot.settings.startMinimized ?? true}
                        onChange={(event) => void updateSettings({ startMinimized: event.target.checked })}
                      />
                      <Select
                        label="Close button"
                        value={snapshot.settings.closeBehavior ?? "hide"}
                        options={[
                          { value: "hide", label: "Hide Milo" },
                          { value: "minimize", label: "Minimize workspace" },
                          { value: "quit", label: "Quit Milo" },
                        ]}
                        onChange={(event) => void updateSettings({ closeBehavior: event.target.value as "hide" | "minimize" | "quit" })}
                      />
                    </div>
                  )}
                  {settingsTab === "milo" && (
                    <div className="settings-block">
                      <h3 className="settings-block__title">Personality Tone</h3>
                      <p className="settings-desc">Choose how Milo shapes Safe, Confident, and Playful replies.</p>
                      <SegmentedControl
                        label="Reply personality"
                        value={snapshot.settings.activeTone ?? "standard"}
                        options={(["standard", "romantic", "witty", "professional"] as const).map((toneKey) => ({
                          value: toneKey,
                          label: TONE_PROFILE_METADATA[toneKey].title,
                        }))}
                        onChange={(toneKey) => {
                          sound.playClick();
                          void updateSettings({ activeTone: toneKey });
                        }}
                      />
                      <p className="settings-desc">{TONE_PROFILE_METADATA[snapshot.settings.activeTone ?? "standard"].description}</p>
                    </div>
                  )}
                  {settingsTab === "sound" && (
                    <div className="settings-block">
                      <h3 className="settings-block__title">Sound Feedback</h3>
                      <Toggle
                        label="Interface sounds"
                        checked={snapshot.settings.soundEnabled ?? true}
                        onChange={(event) => {
                          const enabled = event.target.checked;
                          if (enabled) sound.playClick();
                          void updateSettings({ soundEnabled: enabled });
                        }}
                      />
                      <Toggle
                        label="New activity sound"
                        description="Off by default so Milo stays unobtrusive."
                        checked={snapshot.settings.noticeSoundEnabled ?? false}
                        disabled={!(snapshot.settings.soundEnabled ?? true)}
                        onChange={(event) => void updateSettings({ noticeSoundEnabled: event.target.checked })}
                      />
                      <Slider
                        label="Volume"
                        valueLabel={`${Math.round((snapshot.settings.soundVolume ?? 0.7) * 100)}%`}
                        min="0"
                        max="1"
                        step="0.05"
                        value={snapshot.settings.soundVolume ?? 0.7}
                        disabled={!(snapshot.settings.soundEnabled ?? true)}
                        onChange={(event) => void updateSettings({ soundVolume: Number(event.target.value) })}
                      />
                      <button className="button button--secondary button--sm" type="button" disabled={!(snapshot.settings.soundEnabled ?? true)} onClick={() => sound.playPurr()}>
                        Preview sound
                      </button>
                    </div>
                  )}
                  {settingsTab === "display" && (
                    <div className="settings-block">
                      <h3 className="settings-block__title">Display & Motion</h3>
                      <Select
                        label="Theme preference"
                        value={snapshot.settings.theme ?? "system"}
                        options={[
                          { value: "system", label: "Use Windows setting" },
                          { value: "light", label: "Light" },
                          { value: "dark", label: "Dark" },
                        ]}
                        onChange={(event) => void updateSettings({ theme: event.target.value as ThemePreference })}
                      />
                      <Select
                        label="Motion"
                        value={snapshot.settings.motion ?? "system"}
                        options={[
                          { value: "system", label: "Use Windows setting" },
                          { value: "full", label: "Full" },
                          { value: "reduced", label: "Reduced" },
                          { value: "minimal", label: "Minimal" },
                        ]}
                        onChange={(event) => void updateSettings({ motion: event.target.value as MotionPreference })}
                      />
                      <Toggle
                        label="Watching indicator"
                        description="Keep the selected-window status visible beside Milo."
                        checked={snapshot.settings.showWatchingIndicator ?? true}
                        onChange={(event) => void updateSettings({ showWatchingIndicator: event.target.checked })}
                      />
                    </div>
                  )}
                  {settingsTab === "companion" && (
                    <div className="settings-block">
                      <h3 className="settings-block__title">Companion Mode</h3>
                      <Select
                        label="Docking mode"
                        description="Choose a fixed corner or freely drag Milo on the current display."
                        value={snapshot.settings.dockMode === "follow-window" ? "free" : snapshot.settings.dockMode ?? "free"}
                        options={[
                          { value: "free", label: "Free position" },
                          { value: "top-left", label: "Top left" },
                          { value: "top-right", label: "Top right" },
                          { value: "bottom-left", label: "Bottom left" },
                          { value: "bottom-right", label: "Bottom right" },
                        ]}
                        onChange={(event) => {
                          sound.playClick();
                          void updateSettings({ dockMode: event.target.value as DockMode });
                        }}
                      />
                      <Toggle
                        label="Always on top"
                        description="Keep Milo visible above the selected chat window."
                        checked={snapshot.settings.isPinned ?? true}
                        onChange={(event) => {
                          sound.playClick();
                          void updateSettings({ isPinned: event.target.checked });
                        }}
                      />
                      <Slider
                        label="Resting opacity"
                        description="Milo becomes fully visible while you interact with the companion."
                        valueLabel={`${Math.round((snapshot.settings.opacity ?? 1) * 100)}%`}
                        min="0.75"
                        max="1"
                        step="0.05"
                        value={snapshot.settings.opacity ?? 1}
                        onChange={(event) => void updateSettings({ opacity: Number(event.target.value) })}
                      />
                    </div>
                  )}
                  {settingsTab === "privacy" && (
                    <div className="settings-block">
                      <h3 className="settings-block__title">{"Milo's Eyes"}</h3>
                      <div className="privacy-expanded">
                        <h4>What Milo can see</h4>
                        <ul>
                          <li><strong>Allowed</strong> Selected window</li>
                          <li className="disabled"><strong>Blocked</strong> Other windows</li>
                          <li className="disabled"><strong>Blocked</strong> Full desktop</li>
                          <li className="disabled"><strong>Blocked</strong> Password fields</li>
                        </ul>
                        <h4>Processing</h4>
                        <p>UI Automation, capture fallback, and OCR run on this device. Only bounded recent text is sent after you ask.</p>
                      </div>
                    </div>
                  )}
                  {settingsTab === "data" && (
                    <div className="settings-block">
                      <h3 className="settings-block__title">Data</h3>
                      <p className="settings-desc">Milo stores only content-free preferences and local companion progress. Conversation content is not included.</p>
                      <p className="settings-desc">Export and destructive reset controls stay hidden until their reviewed main-process handlers are available.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {appViewState === "workspace" && (
            <div className="desktop-layout">
              <aside className="sidebar" aria-label="Milo navigation">
                <div className="sidebar__brand">
                  <div className="sidebar__avatar" aria-hidden="true">M</div>
                  <div><strong>Milo</strong><span>Private companion</span></div>
                </div>
                <nav className="sidebar__nav" aria-label="Primary">
                  <button className="nav-item" type="button" onClick={() => setAppViewState("home")}>Home</button>
                  <button className="nav-item nav-item--active" type="button">Suggestions</button>
                  <button className="nav-item" type="button" onClick={() => setAppViewState("room")}>Room</button>
                  <button className="nav-item" type="button" onClick={() => setAppViewState("customize")}>Customize</button>
                  <button className="nav-item" type="button" onClick={() => setAppViewState("settings")}>Settings</button>
                </nav>
                <div className="sidebar__privacy"><ShieldIcon /><span>Only the selected window is read, and only after you ask.</span></div>
                <button className="sidebar__pause" type="button" onClick={() => void pauseWatching(snapshot.state !== "paused")}>
                  {snapshot.state === "paused" ? <PlayIcon /> : <PauseIcon />}
                  {snapshot.state === "paused" ? "Resume Milo" : "Pause Milo"}
                </button>
              </aside>

              <div className="workspace" id="conversation-area">
                <div className={`state-card state-card--${snapshot.state}`} role={snapshot.state === "error" ? "alert" : "status"}>
                  <StateMark state={snapshot.state} />
                  <div>
                    <strong>{stateCopy.label}</strong>
                    <span>{stateCopy.detail}</span>
                  </div>
                  <span className="state-card__status">{snapshot.state === "paused" ? "Paused" : isAuthenticated ? "Ready" : "Sign in"}</span>
                </div>

                <div className="privacy-strip">
                  <ShieldIcon />
                  <span><strong>Local and private</strong> Milo observes only the selected window and sends minimum recent text only when you ask.</span>
                </div>

                <div className="window-status">
                  <WindowIcon />
                  <div>
                    <span>Selected window</span>
                    <strong>{selectedWindowTitle ?? "Choose a chat to begin"}</strong>
                  </div>
                  <button className="button button--secondary" type="button" disabled={busy} onClick={() => void openWindowPicker()}>
                    {selectedWindowTitle ? "Change window" : "Choose window"}
                  </button>
                </div>

                {windowPickerOpen && (
                  <section className="window-picker" aria-labelledby="window-picker-title">
                    <div className="section-heading">
                      <h2 id="window-picker-title">Choose one window</h2>
                      <button
                        className="text-button"
                        type="button"
                        onClick={() => {
                          setWindowPickerOpen(false);
                          setWindowCandidates([]);
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                    <p>Milo will remain bound to only this window until you choose another one.</p>
                    {windowCandidates.length === 0 ? (
                      <div className="window-picker__empty" role="status">No eligible windows found.</div>
                    ) : (
                      <ul className="window-list">
                        {windowCandidates.map((candidate) => (
                          <li key={candidate.sourceId}>
                            <button type="button" disabled={busy} onClick={() => void chooseWindow(candidate)}>
                              {candidate.title}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                )}

                <section className="local-preview" aria-labelledby="local-preview-title">
                  <div className="section-heading">
                    <div>
                      <p className="section-kicker">Privacy preview</p>
                      <h2 id="local-preview-title">Review local context</h2>
                    </div>
                    <span className="section-meta">On device</span>
                  </div>
                  <p className="local-preview__intro">Review the exact normalized excerpt before requesting suggestions. Previewing does not call the AI service.</p>
                  <div className="local-preview__controls">
                    <label className="preview-checkbox">
                      <input
                        type="checkbox"
                        checked={contextPreviewInput.removeParticipantNames}
                        onChange={(event) => setContextPreviewInput((current) => ({ ...current, removeParticipantNames: event.target.checked }))}
                      />
                      <span>Remove participant names</span>
                    </label>
                    <label className="preview-limit">
                      <span>Recent messages</span>
                      <select
                        value={contextPreviewInput.maxMessages}
                        onChange={(event) => {
                          const value = Number(event.target.value);
                          if (CONTEXT_PREVIEW_MESSAGE_LIMITS.includes(value as 4 | 6 | 8)) {
                            setContextPreviewInput((current) => ({ ...current, maxMessages: value as 4 | 6 | 8 }));
                          }
                        }}
                      >
                        {CONTEXT_PREVIEW_MESSAGE_LIMITS.map((value) => <option key={value} value={value}>{value}</option>)}
                      </select>
                    </label>
                  </div>
                  <button
                    className="button button--secondary local-preview__button"
                    type="button"
                    disabled={contextPreviewBusy || busy || selectedWindowTitle === undefined || snapshot.state === "paused"}
                    onClick={() => void previewLocalContext()}
                  >
                    <EyeOffIcon />{contextPreviewBusy ? "Preparing preview…" : "Preview locally"}
                  </button>
                  {contextPreview !== null && (
                    <div className="local-preview__result" role="status" aria-live="polite">
                      <div className="local-preview__result-meta">
                        <span>{contextPreview.messageCount} recent {contextPreview.messageCount === 1 ? "message" : "messages"}</span>
                        <span>{contextPreview.participantNamesRemoved ? "Names removed" : "Names shown"}</span>
                        {contextPreview.truncated && <span>Excerpt bounded</span>}
                      </div>
                      <pre aria-label="Normalized recent context">{contextPreview.text}</pre>
                      <p>Only this bounded text is eligible to be sent after you click Suggest.</p>
                    </div>
                  )}
                </section>

                <div className="primary-actions">
                  <button className="button button--primary" type="button" disabled={!canSuggest} onClick={() => void askMilo()}>
                    <SparkIcon />{busy ? "Thinking…" : isAuthenticated ? "Suggest" : "Sign in to suggest"}
                  </button>
                  <button className="button button--secondary" type="button" onClick={() => void pauseWatching(snapshot.state !== "paused")}>
                    {snapshot.state === "paused" ? <PlayIcon /> : <PauseIcon />}
                    {snapshot.state === "paused" ? "Resume" : "Pause"}
                  </button>
                  <span className="primary-actions__shortcut">Alt+S</span>
                </div>

                {requestWarning !== null && (
                  <div className="analysis-warning" role="alert"><AlertIcon /><span>{requestWarning}</span></div>
                )}
                {snapshot.state === "error" && (
                  <div className="inline-error" role="alert"><AlertIcon /><span>Milo could not complete that request. Check the selected window and try again.</span></div>
                )}

                {snapshot.replies.length > 0 ? (
                  <section className="suggestions" aria-labelledby="suggestions-title">
                    <div className="section-heading">
                      <div><p className="section-kicker">Milo suggests</p><h2 id="suggestions-title">Three options</h2></div>
                      <label className="tone-quick-wrap">
                        <span className="sr-only">Personality tone</span>
                        <select
                          className="tone-quick-select"
                          value={snapshot.settings.activeTone ?? "standard"}
                          onChange={(event) => void updateSettings({ activeTone: event.target.value as ToneProfile })}
                        >
                          <option value="standard">Friend and dating</option>
                          <option value="romantic">Flirty</option>
                          <option value="witty">Witty</option>
                          <option value="professional">Professional</option>
                        </select>
                      </label>
                    </div>
                    <p className="helper-line">Copy a suggestion, edit it in your chat app, and decide whether to send it.</p>
                    <div className="reply-cards-list">
                      {snapshot.replies.map((reply) => {
                        const isCopied = copiedSuggestion === reply.id;
                        return (
                          <article className={`reply-card reply-card--${reply.id}`} key={reply.id}>
                            <div className="reply-card__heading">
                              <div className="reply-card__badge-wrap">
                                <span className={`reply-card__category-badge reply-card__category-badge--${reply.id}`}>
                                  {reply.id === "safe" ? "Safe" : reply.id === "confident" ? "Confident" : "Playful"}
                                </span>
                                <strong className="reply-card__title">{reply.label}</strong>
                              </div>
                              <button className={`copy-button ${isCopied ? "copy-button--copied" : ""}`} type="button" onClick={() => void copyReply(reply.id)}>
                                {isCopied ? <CheckIcon /> : <CopyIcon />}<span>{isCopied ? "Copied" : "Copy"}</span>
                              </button>
                            </div>
                            <p className="reply-card__body">{reply.text}</p>
                            <div className="reply-card__rationale"><small>{reply.explanation}</small></div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                ) : (
                  <section className="context-section" aria-labelledby="context-title">
                    <div className="section-heading"><div><p className="section-kicker">Suggestions</p><h2 id="context-title">Ready when you are</h2></div></div>
                    <div className="context-empty"><MessageIcon /><div><strong>{selectedWindowTitle ? "Ask Milo when you want a second opinion." : "Select one chat window first."}</strong><span>No message is ever pasted or sent automatically.</span></div></div>
                  </section>
                )}
              </div>

              <aside className="companion-rail" aria-label="Milo companion status">
                <div className="companion-rail__topline">
                  <span className={`companion-rail__status-dot companion-rail__status-dot--${snapshot.state === "paused" ? "paused" : selectedWindowTitle === undefined ? "idle" : "active"}`} aria-hidden="true" />
                  <span>{snapshot.state === "paused" ? "Paused" : selectedWindowTitle === undefined ? "Not watching" : "Watching locally"}</span>
                  <button className="companion-rail__settings" type="button" aria-label="Open settings" onClick={() => setAppViewState("settings")}><SettingsIcon /></button>
                </div>
                <div className="companion-rail__cat"><MiloCat state={snapshot.state} appearance={appearance} /></div>
                <h2>Milo</h2>
                <p className="companion-rail__subtitle">A calm second opinion.</p>
                <div className="companion-rail__watching"><span>Selected window</span><strong>{selectedWindowTitle ?? "None selected"}</strong></div>
                <div className="companion-rail__actions">
                  <button className="button button--primary" type="button" disabled={!canSuggest} onClick={() => void askMilo()}><SparkIcon />Suggest</button>
                  <button className="button button--secondary" type="button" disabled={!canSuggest} onClick={() => void askMilo("screen_capture")}><WindowIcon />Use OCR fallback</button>
                </div>
                <div className="companion-rail__private"><ShieldIcon /><span><strong>Local first</strong> Milo never sends a reply for you.</span></div>
              </aside>
            </div>
          )}

          {appViewState === "customize" && (
            <div className="settings-layout">
              <div className="settings-header">
                <h2>Customize Milo</h2>
                <button className="text-button" type="button" onClick={() => setAppViewState("home")}>Done</button>
              </div>
              <div className="settings-body">
                <div className="home-hero">
                  <div className="home-hero__cat" style={{ transform: "scale(1.5)", marginBottom: 16 }}>
                    <MiloCat state={snapshot.state} appearance={snapshot.settings.appearance} />
                  </div>
                </div>
                <div className="settings-block">
                  <h3 className="settings-block__title">Fur Color</h3>
                  <div className="tone-cards-grid">
                    {CAT_APPEARANCES.map((fur) => {
                      const isSelected = appearance.fur === fur;
                      return (
                        <button
                          key={fur}
                          className={`tone-card ${isSelected ? "tone-card--selected" : ""}`}
                          onClick={() => {
                            if (sound.playClick) sound.playClick();
                            void updateSettings({ appearance: { ...appearance, fur } });
                          }}
                        >
                          <div className="tone-card__text">
                            <strong>{fur.charAt(0).toUpperCase() + fur.slice(1)}</strong>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="settings-block">
                  <h3 className="settings-block__title">Animation Personality</h3>
                  <div className="tone-cards-grid">
                    {(["calm", "energetic", "chaotic", "sleepy"] as const).map((personality) => {
                      const isSelected = appearance.animationPersonality === personality;
                      return (
                        <button
                          key={personality}
                          className={`tone-card ${isSelected ? "tone-card--selected" : ""}`}
                          onClick={() => {
                            if (sound.playClick) sound.playClick();
                            void updateSettings({ appearance: { ...appearance, animationPersonality: personality } });
                          }}
                        >
                          <div className="tone-card__text">
                            <strong>{personality.charAt(0).toUpperCase() + personality.slice(1)}</strong>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {appViewState === "room" && (
            <div className="settings-layout">
              <div className="settings-header">
                <h2>Milo&apos;s Room</h2>
                <button className="text-button" type="button" onClick={() => setAppViewState("home")}>Done</button>
              </div>
              <div className="settings-body" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                <div style={{ position: "relative", width: "100%", height: 200, backgroundColor: "var(--bg-surface)", overflow: "hidden", borderRadius: "var(--radius-small)" }}>
                  {snapshot.settings.room?.items?.map((item) => (
                    <div
                      key={item.id}
                      className={`room-item room-item--${item.id}`}
                      aria-label={item.id}
                      style={{ left: item.x, top: item.y, transform: `scale(${item.scale}) rotate(${item.rotation ?? 0}deg)` }}
                    >
                      <span aria-hidden="true" />
                    </div>
                  ))}
                  <div style={{ position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)" }}>
                    <MiloCat state={snapshot.state} appearance={snapshot.settings.appearance} />
                  </div>
                </div>
                <div className="settings-block" style={{ marginTop: 16 }}>
                  <h3 className="settings-block__title">Furniture</h3>
                  <div className="tone-cards-grid">
                    {["plant", "rug", "lamp"].map((id, index) => {
                      const items = snapshot.settings.room?.items ?? [];
                      const hasItem = items.some((item) => item.id === id);
                      return (
                        <button
                          key={id}
                          className={`tone-card ${hasItem ? "tone-card--selected" : ""}`}
                          onClick={() => {
                            const newItems = hasItem
                              ? items.filter((item) => item.id !== id)
                              : [...items, { id, x: 36 + index * 82, y: 84 + (index % 2) * 28, scale: 1 }];
                            void updateSettings({
                              room: {
                                background: snapshot.settings.room?.background ?? "default",
                                items: newItems,
                              },
                            });
                          }}
                        >
                          <div className="tone-card__text"><strong>{id}</strong></div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

<footer className="panel__footer">
            <span>Milo never sends messages for you.</span>
            <button type="button" className="text-button" onClick={() => void safely(() => window.milo.quit())}>Quit</button>
          </footer>
        </section>
      )}

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </main>
  );
}

function StateMark({ state }: Readonly<{ state: DesktopState }>) {
  return (
    <span className={`state-mark state-mark--${state}`} aria-hidden="true">
      {state === "paused" ? <PauseIcon /> : state === "error" ? <AlertIcon /> : state === "ready" ? <CheckIcon /> : state === "generating" ? <SparkIcon /> : <span />}
    </span>
  );
}
