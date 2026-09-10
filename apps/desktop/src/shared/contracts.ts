export const DESKTOP_STATES = [
  "idle",
  "noticed",
  "generating",
  "ready",
  "paused",
  "error",
] as const;

export type DesktopState = (typeof DESKTOP_STATES)[number];
export type ThemePreference = "system" | "light" | "dark";
export type MotionPreference = "system" | "full" | "reduced";
export type PanelPlacement = "right-down" | "right-up" | "left-down" | "left-up";
export type SuggestionId = "safe" | "confident" | "playful";
export type PreviewAction = "notice" | "generate" | "fail" | "reset";
export type PositionDirection = "up" | "right" | "down" | "left";
export type AccountDestination = "account" | "billing" | "privacy" | "terms";
export type ToneProfile = "standard" | "romantic" | "witty" | "professional";
export type DockMode = "free" | "top-left" | "top-right" | "bottom-left" | "bottom-right" | "follow-window";

export const CAT_APPEARANCES = ["charcoal", "slate", "mauve", "caramel"] as const;
export type CatAppearance = (typeof CAT_APPEARANCES)[number];

export const TONE_PROFILE_METADATA: Record<ToneProfile, { title: string; description: string; emoji: string }> = {
  standard: { title: "Dating & Friends", description: "Balanced, authentic & calm", emoji: "💬" },
  romantic: { title: "Flirty & Romantic", description: "Charming, warm & playful", emoji: "✨" },
  witty: { title: "Witty & Sarcastic", description: "Clever, sharp & fun", emoji: "😼" },
  professional: { title: "Professional", description: "Clear, respectful & diplomatic", emoji: "👔" },
};

export type PublicSettings = Readonly<{
  theme: ThemePreference;
  motion: MotionPreference;
  showWatchingIndicator: boolean;
  soundEnabled?: boolean;
  soundVolume?: number;
  noticeSoundEnabled?: boolean;
  activeTone?: ToneProfile;
  opacity?: number;
  isPinned?: boolean;
  dockMode?: DockMode;
  catAppearance?: CatAppearance;
}>;

export type PublicSettingsPatch = Partial<PublicSettings>;

export type SyntheticSuggestion = Readonly<{
  id: SuggestionId;
  label: string;
  text: string;
  explanation: string;
}>;

export type AuthSummary = Readonly<{
  status: "signed_out" | "authenticated" | "unavailable" | "error";
  expiresAt: number | null;
  storageAvailable: boolean;
}>;
export type WindowCandidate = Readonly<{
  sourceId: string;
  title: string;
}>;

export type SelectedWindowSummary = Readonly<{
  available: true;
  title: string;
  processId: number | null;
}>;

export type SelectWindowInput = Readonly<{ sourceId?: string }>;
export type WindowSelectionResult =
  | Readonly<{ mode: "candidates"; candidates: readonly WindowCandidate[] }>
  | Readonly<{ mode: "selected"; window: SelectedWindowSummary }>;

export const CONTEXT_PREVIEW_MESSAGE_LIMITS = [4, 6, 8] as const;
export type ContextPreviewMessageLimit = (typeof CONTEXT_PREVIEW_MESSAGE_LIMITS)[number];
export type ContextPreviewInput = Readonly<{
  removeParticipantNames: boolean;
  maxMessages: ContextPreviewMessageLimit;
}>;
export type ContextPreview = Readonly<{
  text: string;
  messageCount: number;
  truncated: boolean;
  participantNamesRemoved: boolean;
  maxMessages: ContextPreviewMessageLimit;
}>;

export type WatchingState = Readonly<{
  paused: boolean;
  selectedWindow: SelectedWindowSummary | null;
  capability: Readonly<{ available: true }>;
}>;

export type SuggestionResponse = Readonly<{
  mode: "live" | "synthetic_preview";
  warning: string | null;
  replies: readonly SyntheticSuggestion[];
}>;

export const CHARACTER_STATES = [
  "idle",
  "looking",
  "sleepy",
  "sleeping",
  "waking",
  "dragging",
  "drop",
  "pet",
  "purring",
  "curious",
  "playful",
  "alert",
  "thinking",
  "ready",
  "celebrating",
  "level_up",
  "paused",
  "error",
  "offline",
] as const;

export type CharacterState = (typeof CHARACTER_STATES)[number];

export type CharacterAnimationSnapshot = Readonly<{
  name: string;
  state: CharacterState;
  priority: number;
  interruptible: boolean;
  startedAt: number;
  duration?: number;
}>;

export type CharacterStateSnapshot = Readonly<{
  currentState: CharacterState;
  previousState: CharacterState | null;
  currentPriority: number;
  activeAnimation: CharacterAnimationSnapshot | null;
  lastTransitionTime: number;
  transitionReason?: string;
}>;

export type DesktopSnapshot = Readonly<{
  state: DesktopState;
  panelOpen: boolean;
  panelPlacement: PanelPlacement;
  watching: WatchingState;
  settings: PublicSettings;
  auth: AuthSummary;
  replies: readonly SyntheticSuggestion[];
  lastAction: "none" | "copied";
  character?: CharacterStateSnapshot;
}>;

export type AskMiloInput = Readonly<{ mode?: "selected_window" | "screen_capture" }>;
export type CopyReplyInput = Readonly<{ suggestionId: SuggestionId }>;
export type NudgePositionInput = Readonly<{
  direction: PositionDirection;
  step: 10 | 40;
}>;

export type IpcPublicError = Readonly<{
  code: "INVALID_REQUEST" | "UNAVAILABLE" | "INTERNAL_ERROR";
  message: string;
}>;

export type IpcResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; error: IpcPublicError }>;

export type MiloDesktopApi = Readonly<{
  getSnapshot(): Promise<DesktopSnapshot>;
  selectWindow(input: SelectWindowInput): Promise<WindowSelectionResult>;
  previewContext(input: ContextPreviewInput): Promise<ContextPreview>;
  pauseWatching(paused: boolean): Promise<WatchingState>;
  askMilo(input: AskMiloInput): Promise<SuggestionResponse>;
  copyReply(input: CopyReplyInput): Promise<void>;
  getSettings(): Promise<PublicSettings>;
  updateSettings(input: PublicSettingsPatch): Promise<PublicSettings>;
  openAccount(destination: AccountDestination): Promise<void>;
  signIn(): Promise<AuthSummary>;
  signOut(): Promise<AuthSummary>;
  setPanelOpen(open: boolean): Promise<DesktopSnapshot>;
  previewState(action: PreviewAction): Promise<DesktopSnapshot>;
  nudgePosition(input: NudgePositionInput): Promise<void>;
  resetPosition(): Promise<void>;
  openContextMenu(): Promise<void>;
  quit(): Promise<void>;
  onStateChanged(listener: (state: DesktopSnapshot) => void): () => void;
}>;

export const IPC_CHANNELS = {
  getSnapshot: "milo:get-snapshot",
  selectWindow: "milo:select-window",
  previewContext: "milo:preview-context",
  pauseWatching: "milo:pause-watching",
  askMilo: "milo:ask",
  copyReply: "milo:copy-reply",
  getSettings: "milo:get-settings",
  updateSettings: "milo:update-settings",
  openAccount: "milo:open-account",
  signIn: "milo:sign-in",
  signOut: "milo:sign-out",
  setPanelOpen: "milo:set-panel-open",
  previewState: "milo:preview-state",
  nudgePosition: "milo:nudge-position",
  resetPosition: "milo:reset-position",
  openContextMenu: "milo:open-context-menu",
  quit: "milo:quit",
  stateChanged: "milo:state-changed",
} as const;

export const PRELOAD_METHOD_ALLOWLIST = [
  "getSnapshot",
  "selectWindow",
  "previewContext",
  "pauseWatching",
  "askMilo",
  "copyReply",
  "getSettings",
  "updateSettings",
  "openAccount",
  "signIn",
  "signOut",
  "setPanelOpen",
  "previewState",
  "nudgePosition",
  "resetPosition",
  "openContextMenu",
  "quit",
  "onStateChanged",
] as const satisfies readonly (keyof MiloDesktopApi)[];

export const SYNTHETIC_SUGGESTIONS: readonly SyntheticSuggestion[] = Object.freeze([
  Object.freeze({
    id: "safe",
    label: "Safe preview",
    text: "Synthetic preview — That sounds lovely. What day works best for you?",
    explanation: "A warm, low-pressure example. Milo has not read a real conversation.",
  }),
  Object.freeze({
    id: "confident",
    label: "Confident preview",
    text: "Synthetic preview — I’m in. Let’s pick a time and make it happen.",
    explanation: "A clear example that moves the conversation forward without pressure.",
  }),
  Object.freeze({
    id: "playful",
    label: "Playful preview",
    text: "Synthetic preview — Deal, but I’m choosing the dessert spot.",
    explanation: "A light example with personality. It is not based on captured content.",
  }),
]);
