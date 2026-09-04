import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CONTEXT_PREVIEW_MESSAGE_LIMITS,
  TONE_PROFILE_METADATA,
  type ContextPreview,
  type ContextPreviewInput,
  type DesktopSnapshot,
  type DesktopState,
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
  ArrowIcon,
  CheckIcon,
  CloseIcon,
  CopyIcon,
  EyeOffIcon,
  MessageIcon,
  MoreIcon,
  PauseIcon,
  PinIcon,
  PlayIcon,
  ResetIcon,
  SendIcon,
  SettingsIcon,
  ShieldIcon,
  SparkIcon,
  VolumeIcon,
  VolumeMuteIcon,
  WindowIcon,
} from "./icons";
import { MiloCat } from "./MiloCat";
import { sound } from "./audio";

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
    dockMode: "follow-window",
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
          <span className="popout-bubbles__spark" aria-hidden="true">✨</span>
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
  const [bubblesVisible, setBubblesVisible] = useState(true);

  useEffect(() => {
    if (snapshot.replies.length > 0) {
      setBubblesVisible(true);
    }
  }, [snapshot.replies]);

  const stateCopy = STATE_COPY[snapshot.state];
  const selectedWindowTitle = snapshot.watching.selectedWindow?.title;
  const isAuthenticated = snapshot.auth.status === "authenticated";
  const canSuggest = isAuthenticated && selectedWindowTitle !== undefined && snapshot.state !== "paused" && !busy && !authBusy;

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
    setBubblesVisible(false);
    await copyReply(suggestionId);
  };

  const handleBubbleDismiss = () => {
    setBubblesVisible(false);
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

          <div className="desktop-layout">
            <aside className="sidebar" aria-label="Milo navigation">
              <div className="sidebar__brand">
                <div className="sidebar__avatar" aria-hidden="true">M</div>
                <div><strong>Milo</strong><span>Private companion</span></div>
              </div>
              <nav className="sidebar__nav" aria-label="Primary">
                <a className="nav-item nav-item--active" href="#conversation-area">Conversations</a>
                <a className="nav-item" href="#context-title">Insights</a>
                <a className="nav-item" href="#settings-area">Settings</a>
              </nav>
              <div className="sidebar__privacy"><ShieldIcon /><span>Milo reads only what you allow on your device.</span></div>
              <button className="sidebar__pause" type="button" onClick={() => void pauseWatching(snapshot.state !== "paused")}>
                {snapshot.state === "paused" ? <PlayIcon /> : <PauseIcon />}
                {snapshot.state === "paused" ? "Resume Milo" : "Pause Milo"}
              </button>
              <div className="sidebar__account" aria-label="Account">
                <div className="account-avatar" aria-hidden="true">A</div>
                <div><strong>{isAuthenticated ? "Signed in" : "Not signed in"}</strong><span>{isAuthenticated ? "Milo account" : "Sign in to suggest"}</span></div>
                <div className="sidebar__account-actions">
                  <button type="button" className="text-button" onClick={() => void safely(() => window.milo.openAccount("account"))}>Account</button>
                  <button type="button" className="text-button" onClick={() => void safely(() => window.milo.openAccount("billing"))}>Billing</button>
                  <button type="button" className="text-button" onClick={() => void safely(() => window.milo.openAccount("privacy"))}>Privacy</button>
                </div>
              </div>
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
                <span><strong>Local and private</strong> Milo observes only the selected window and sends the minimum context only when you ask.</span>
              </div>

              <div className="window-status">
                <WindowIcon />
                <div>
                  <span>Selected window</span>
                  <strong>{selectedWindowTitle ?? "Choose a chat to begin"}</strong>
                </div>
                <button
                  className="button button--secondary"
                  type="button"
                  disabled={busy}
                  onClick={() => void openWindowPicker()}
                >
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
                  <p>Milo will be bound only to the window you choose.</p>
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
                <p className="local-preview__intro">See the exact normalized excerpt Milo will use before you ask. Nothing is sent during this preview.</p>
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
                <button className="button button--secondary local-preview__button" type="button" disabled={contextPreviewBusy || busy || selectedWindowTitle === undefined || snapshot.state === "paused"} onClick={() => void previewLocalContext()}>
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
                    <p>Minimal text will be sent only after you explicitly click Suggest.</p>
                  </div>
                )}
              </section>

              <div className="primary-actions">
                <button
                  className="button button--primary"
                  type="button"
                  disabled={!canSuggest}
                  title="Suggest (Ctrl+Shift+M)"
                  onClick={() => void askMilo()}
                >
                  <SparkIcon />
                  {busy ? "Thinking…" : isAuthenticated ? "Suggest" : "Sign in to suggest"}
                </button>
                <button
                  className="button button--secondary"
                  type="button"
                  onClick={() => void pauseWatching(snapshot.state !== "paused")}
                >
                  {snapshot.state === "paused" ? <PlayIcon /> : <PauseIcon />}
                  {snapshot.state === "paused" ? "Resume" : "Pause"}
                </button>
                <span className="primary-actions__shortcut">Ctrl+Shift+M</span>
              </div>

              <section className="context-section" aria-labelledby="context-title">
                <div className="section-heading">
                  <div>
                    <p className="section-kicker">Milo&apos;s context insight</p>
                    <h2 id="context-title">A calm place to start</h2>
                  </div>
                  <span className="section-meta">Local only</span>
                </div>
                <div className="context-empty">
                  <MessageIcon />
                  <div>
                    <strong>{selectedWindowTitle ? "Context stays on your device until you ask." : "Select a chat window first."}</strong>
                    <span>Milo never reads another window, and sends only the minimum context when you request a suggestion.</span>
                  </div>
                </div>
              </section>

              <section className="messages-section" aria-labelledby="messages-title">
                <div className="section-heading">
                  <div>
                    <p className="section-kicker">Recent messages</p>
                    <h2 id="messages-title">Nothing captured</h2>
                  </div>
                  <span className="section-meta">On device</span>
                </div>
                <p className="empty-copy">When local extraction is available, Milo will show only the recent context you explicitly request.</p>
              </section>

              {requestWarning !== null && (
                <div className="analysis-warning" role="alert">
                  <AlertIcon />
                  <span>{requestWarning}</span>
                </div>
              )}

              {snapshot.state === "error" && (
                <div className="inline-error" role="alert">
                  <AlertIcon />
                  <span>Milo could not complete that request. Check your selected window and try again.</span>
                </div>
              )}

              {snapshot.replies.length > 0 && (
                <section className="suggestions" aria-labelledby="suggestions-title">
                  <div className="section-heading">
                    <div>
                      <p className="section-kicker">Milo suggests</p>
                      <h2 id="suggestions-title">Suggestions</h2>
                    </div>
                    <div className="tone-quick-wrap">
                      <label htmlFor="quick-tone-select" className="sr-only">Personality tone</label>
                      <select
                        id="quick-tone-select"
                        className="tone-quick-select"
                        value={snapshot.settings.activeTone ?? "standard"}
                        onChange={(event) => {
                          sound.playClick();
                          void updateSettings({ activeTone: event.target.value as ToneProfile });
                        }}
                      >
                        <option value="standard">💬 Standard</option>
                        <option value="romantic">✨ Romantic</option>
                        <option value="witty">😼 Witty</option>
                        <option value="professional">👔 Professional</option>
                      </select>
                      <span className="section-meta">3 options</span>
                    </div>
                  </div>
                  <p className="helper-line">Click a suggestion to copy it. Edit before sending.</p>
                  <div className="reply-cards-list">
                    {snapshot.replies.map((reply) => {
                      const isCopied = copiedSuggestion === reply.id;
                      return (
                        <article className={`reply-card reply-card--${reply.id} card bg-base-100/95 shadow-sm border border-base-content/10 hover:shadow-md transition-all duration-200`} key={reply.id}>
                          <div className="reply-card__heading">
                            <div className="reply-card__badge-wrap">
                              <span className={`reply-card__category-badge reply-card__category-badge--${reply.id} badge ${reply.id === "safe" ? "badge-info" : reply.id === "confident" ? "badge-primary" : "badge-secondary"}`}>
                                {reply.id === "safe" ? "Safe" : reply.id === "confident" ? "Confident" : "Playful"}
                              </span>
                              <strong className="reply-card__title">{reply.label}</strong>
                            </div>
                            <button
                              className={`copy-button ${isCopied ? "copy-button--copied btn-success" : ""} btn btn-xs gap-1`}
                              type="button"
                              aria-label={`Copy ${reply.label}`}
                              onClick={() => void copyReply(reply.id)}
                            >
                              {isCopied ? <CheckIcon /> : <CopyIcon />}
                              <span>{isCopied ? "Copied!" : "Copy"}</span>
                            </button>
                          </div>
                          <p className="reply-card__body">{reply.text}</p>
                          <div className="reply-card__rationale">
                            <small>{reply.explanation}</small>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              )}

              <section className="ask-section" aria-labelledby="ask-title">
                <div className="section-heading">
                  <div>
                    <p className="section-kicker">Ask Milo</p>
                    <h2 id="ask-title">Shape the suggestion</h2>
                  </div>
                </div>
                <div className="ask-input-wrap">
                  <input id="ask-milo" type="text" disabled placeholder="Available when local context is enabled" aria-describedby="ask-help" />
                  <button type="button" className="ask-send" disabled aria-label="Ask Milo unavailable until local context is enabled"><SendIcon /></button>
                </div>
                <p id="ask-help" className="ask-help">Milo never sends a message for you. Review and edit every suggestion.</p>
              </section>

              <details className="disclosure">
                <summary>Developer preview states and position</summary>
                <div className="disclosure__body">
                  <div className="state-lab" aria-label="Developer-only state previews">
                    <button type="button" onClick={() => void safely(() => window.milo.previewState("notice"))}>Notice</button>
                    <button type="button" onClick={() => void safely(() => window.milo.previewState("fail"))}>Error</button>
                    <button type="button" onClick={() => void safely(() => window.milo.previewState("reset"))}>Reset state</button>
                  </div>
                  <div className="move-grid" aria-label="Move Milo">
                    <button type="button" className="move-up" aria-label="Move Milo up" onClick={() => void moveOverlay("up", 10)}><ArrowIcon direction="up" /></button>
                    <button type="button" className="move-left" aria-label="Move Milo left" onClick={() => void moveOverlay("left", 10)}><ArrowIcon direction="left" /></button>
                    <button type="button" className="move-reset" aria-label="Reset Milo position" onClick={() => void safely(() => window.milo.resetPosition(), "Milo position reset.")}><ResetIcon /></button>
                    <button type="button" className="move-right" aria-label="Move Milo right" onClick={() => void moveOverlay("right", 10)}><ArrowIcon direction="right" /></button>
                    <button type="button" className="move-down" aria-label="Move Milo down" onClick={() => void moveOverlay("down", 10)}><ArrowIcon direction="down" /></button>
                  </div>
                  <p className="shortcut-note">Keyboard: Alt + arrow. Add Shift for a 40-pixel step.</p>
                </div>
              </details>

              <details className="disclosure" open>
                <summary id="settings-area"><span><SettingsIcon />Personality, Sound &amp; Docking</span></summary>
                <div className="disclosure__body settings-grid">
                  <div className="settings-block">
                    <h3 className="settings-block__title">Personality Tone</h3>
                    <p className="settings-desc">Choose how Milo shapes Safe, Confident, and Playful replies.</p>
                    <div className="tone-cards-grid">
                      {(["standard", "romantic", "witty", "professional"] as const).map((toneKey) => {
                        const meta = TONE_PROFILE_METADATA[toneKey];
                        const isSelected = (snapshot.settings.activeTone ?? "standard") === toneKey;
                        return (
                          <button
                            key={toneKey}
                            type="button"
                            className={`tone-card ${isSelected ? "tone-card--selected" : ""}`}
                            onClick={() => {
                              sound.playClick();
                              void updateSettings({ activeTone: toneKey });
                            }}
                          >
                            <span className="tone-card__emoji">{meta.emoji}</span>
                            <div className="tone-card__text">
                              <strong>{meta.title}</strong>
                              <small>{meta.description}</small>
                            </div>
                            {isSelected && <span className="tone-card__check"><CheckIcon /></span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="settings-block">
                    <h3 className="settings-block__title">Sound Feedback</h3>
                    <p className="settings-desc">Subtle synthesized feedback for actions (100–300ms).</p>
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={snapshot.settings.soundEnabled ?? true}
                        onChange={(event) => {
                          if (event.target.checked) sound.playClick();
                          void updateSettings({ soundEnabled: event.target.checked });
                        }}
                      />
                      <span>Enable Sound Feedback (Pops, Purrs &amp; Clicks)</span>
                    </label>
                    <label className="slider-row">
                      <span>Volume: {Math.round((snapshot.settings.soundVolume ?? 0.7) * 100)}%</span>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={snapshot.settings.soundVolume ?? 0.7}
                        disabled={!(snapshot.settings.soundEnabled ?? true)}
                        onChange={(event) => {
                          const val = Number(event.target.value);
                          void updateSettings({ soundVolume: val });
                        }}
                      />
                    </label>
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={snapshot.settings.noticeSoundEnabled ?? false}
                        disabled={!(snapshot.settings.soundEnabled ?? true)}
                        onChange={(event) => void updateSettings({ noticeSoundEnabled: event.target.checked })}
                      />
                      <span>Sound on new message detected (Off by default)</span>
                    </label>
                    <button
                      type="button"
                      className="button button--secondary button--sm"
                      disabled={!(snapshot.settings.soundEnabled ?? true)}
                      onClick={() => sound.playPurr()}
                    >
                      <VolumeIcon /> Test Sound Feedback
                    </button>
                  </div>

                  <div className="settings-block">
                    <h3 className="settings-block__title">Window Docking &amp; Opacity</h3>
                    <p className="settings-desc">Keep Milo visible and accessible beside your chat.</p>
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={snapshot.settings.isPinned ?? true}
                        onChange={(event) => {
                          sound.playClick();
                          void updateSettings({ isPinned: event.target.checked });
                        }}
                      />
                      <span>Always on Top (Pin to foreground)</span>
                    </label>
                    <label className="slider-row">
                      <span>Window Opacity: {Math.round((snapshot.settings.opacity ?? 1.0) * 100)}%</span>
                      <input
                        type="range"
                        min="0.75"
                        max="1.0"
                        step="0.05"
                        value={snapshot.settings.opacity ?? 1.0}
                        onChange={(event) => {
                          const val = Number(event.target.value);
                          void updateSettings({ opacity: val });
                        }}
                      />
                    </label>
                    <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                      {(["top-left", "top-right", "bottom-left", "bottom-right"] as const).map((dock) => (
                        <button
                          key={dock}
                          type="button"
                          className="button button--secondary button--sm"
                          style={{ flex: 1, padding: "0 4px", fontSize: "10px" }}
                          onClick={() => {
                            sound.playClick();
                            void updateSettings({ dockMode: dock });
                          }}
                        >
                          {dock.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="settings-block">
                    <h3 className="settings-block__title">Display &amp; Appearance</h3>
                    <label>
                      <span>Theme</span>
                      <select
                        value={snapshot.settings.theme}
                        onChange={(event) => void updateSettings({ theme: event.target.value as ThemePreference })}
                      >
                        <option value="system">Use Windows setting</option>
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                      </select>
                    </label>
                    <label>
                      <span>Motion</span>
                      <select
                        value={snapshot.settings.motion}
                        onChange={(event) => void updateSettings({ motion: event.target.value as MotionPreference })}
                      >
                        <option value="system">Use Windows setting</option>
                        <option value="full">Full</option>
                        <option value="reduced">Reduced</option>
                      </select>
                    </label>
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={snapshot.settings.showWatchingIndicator}
                        onChange={(event) => void updateSettings({ showWatchingIndicator: event.target.checked })}
                      />
                      <span>Show compact watching indicator</span>
                    </label>
                  </div>
                </div>
              </details>
            </div>

            <aside className="companion-rail" aria-label="Milo companion status">
              <div className="companion-rail__topline">
                <span className={`companion-rail__status-dot companion-rail__status-dot--${snapshot.state === "paused" ? "paused" : selectedWindowTitle === undefined ? "idle" : "active"}`} aria-hidden="true" />
                <span>{snapshot.state === "paused" ? "Paused" : selectedWindowTitle === undefined ? "Not watching" : "Watching locally"}</span>
                <button className="companion-rail__settings" type="button" aria-label="Open appearance and privacy settings" onClick={() => document.getElementById("settings-area")?.scrollIntoView({ block: "nearest" })}>
                  <SettingsIcon />
                </button>
              </div>
              <div className="companion-rail__cat"><MiloCat state={snapshot.state} /></div>
              <h2>Milo</h2>
              <p className="companion-rail__subtitle">A calm second opinion.</p>
              <div className="companion-rail__watching">
                <span>Listening to</span>
                <strong>{selectedWindowTitle ?? "No window selected"}</strong>
              </div>
              <div className="companion-rail__actions">
                <button className="button button--primary" type="button" disabled={!canSuggest} title="Suggest (Ctrl+Shift+M)" onClick={() => void askMilo()}><SparkIcon />{isAuthenticated ? "Suggest" : "Sign in to suggest"}</button>
                <button className="button button--secondary" type="button" disabled={!canSuggest} title="Screenshot & suggest" onClick={() => void askMilo("screen_capture")}><WindowIcon />Screenshot</button>
                <button className="button button--secondary" type="button" onClick={() => void pauseWatching(snapshot.state !== "paused")}>{snapshot.state === "paused" ? <PlayIcon /> : <PauseIcon />} {snapshot.state === "paused" ? "Resume" : "Pause Milo"}</button>
              </div>
              <div className="companion-rail__private"><ShieldIcon /><span><strong>Local &amp; private</strong> No automatic sending. You stay in control.</span></div>
              <button className="companion-rail__open" type="button" aria-label="Close Milo panel" onClick={() => void togglePanel(false)}>Close panel <span aria-hidden="true">↘</span></button>
            </aside>
          </div>

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
