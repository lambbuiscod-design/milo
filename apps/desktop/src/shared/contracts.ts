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
export type MotionPreference = "system" | "full" | "reduced" | "minimal";
export type PanelPlacement = "right-down" | "right-up" | "left-down" | "left-up";
export type SuggestionId = "safe" | "confident" | "playful";
export type PreviewAction = "notice" | "generate" | "fail" | "reset";
export type PositionDirection = "up" | "right" | "down" | "left";
export type AccountDestination = "account" | "billing" | "privacy" | "terms";
export type ToneProfile = "standard" | "romantic" | "witty" | "professional";
export type DockMode = "free" | "top-left" | "top-right" | "bottom-left" | "bottom-right" | "follow-window";
export type CloseBehavior = "hide" | "minimize" | "quit";
export type LanguagePreference = "system" | "en" | "it";
export const APP_VIEWS = ["home", "workspace", "room", "customize", "settings"] as const;
export type AppView = (typeof APP_VIEWS)[number];

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
  launchAtLogin?: boolean;
  startMinimized?: boolean;
  closeBehavior?: CloseBehavior;
  language?: LanguagePreference;
  appearance?: MiloAppearance;
  progress?: MiloProgress;
  room?: RoomState;
  catAppearance?: CatAppearance;
}>;

export type PublicSettingsPatch = Partial<Omit<PublicSettings, "progress">>;

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
  "happy",
  "laughing",
  "surprised",
  "confident",
  "annoyed",
  "affectionate",
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

export type TriggerCharacterActionInput =
  | Readonly<{ action: "drag_start" }>
  | Readonly<{ action: "drag_move"; deltaX: number; deltaY: number }>
  | Readonly<{ action: "drag_end" }>
  | Readonly<{ action: "look_around" }>
  | Readonly<{ action: "play_animation"; animationName?: string }>;

export const HARMLESS_ANIMATIONS: Readonly<Record<string, { state: CharacterState; durationMs: number }>> = Object.freeze({
  wave: { state: "celebrating", durationMs: 2000 },
  jump: { state: "playful", durationMs: 1800 },
  spin: { state: "playful", durationMs: 1800 },
  happy: { state: "pet", durationMs: 2000 },
  surprised: { state: "curious", durationMs: 2000 },
  tiny_dance: { state: "celebrating", durationMs: 2500 },
});

export const CLICK_DELAY_MS = 250;
export const DOUBLE_CLICK_COOLDOWN_MS = 1500;
export const DRAG_DISTANCE_THRESHOLD = 5;
export const HOLD_DURATION_THRESHOLD_MS = 160;

export const MAX_PUPIL_OFFSET_X = 3.5;
export const MAX_PUPIL_OFFSET_Y = 2.5;
export const DEFAULT_FACE_CENTER = Object.freeze({ x: 125, y: 135 });
export const DEFAULT_MAX_DIST = Object.freeze({ x: 125, y: 150 });

export const HARMLESS_ANIMATION_NAMES = [
  "wave",
  "jump",
  "spin",
  "happy",
  "surprised",
  "tiny_dance",
] as const;
export type HarmlessAnimationName = (typeof HARMLESS_ANIMATION_NAMES)[number];

export interface PupilOffset {
  readonly x: number;
  readonly y: number;
}

export function calculatePupilOffset(
  pointer: { x: number; y: number },
  faceCenter: { x: number; y: number } = DEFAULT_FACE_CENTER,
  maxDist: { x: number; y: number } = DEFAULT_MAX_DIST,
): PupilOffset {
  const dx = pointer.x - faceCenter.x;
  const dy = pointer.y - faceCenter.y;
  const normalizedX = Math.max(-1, Math.min(1, dx / (maxDist.x || 1)));
  const normalizedY = Math.max(-1, Math.min(1, dy / (maxDist.y || 1)));
  const x = Math.round(normalizedX * MAX_PUPIL_OFFSET_X * 100) / 100;
  const y = Math.round(normalizedY * MAX_PUPIL_OFFSET_Y * 100) / 100;
  return { x, y };
}

export class ClickDisambiguator {
  #clickTimer: ReturnType<typeof setTimeout> | null = null;
  #lastDoubleClickTimestamp = 0;
  readonly #onSingleClick: () => void;
  readonly #onDoubleClick: (animationName: HarmlessAnimationName) => void;
  readonly #clickDelayMs: number;
  readonly #doubleClickCooldownMs: number;

  constructor(options: {
    onSingleClick: () => void;
    onDoubleClick: (animationName: HarmlessAnimationName) => void;
    clickDelayMs?: number;
    doubleClickCooldownMs?: number;
  }) {
    this.#onSingleClick = options.onSingleClick;
    this.#onDoubleClick = options.onDoubleClick;
    this.#clickDelayMs = options.clickDelayMs ?? CLICK_DELAY_MS;
    this.#doubleClickCooldownMs = options.doubleClickCooldownMs ?? DOUBLE_CLICK_COOLDOWN_MS;
  }

  get lastDoubleClickTimestamp(): number {
    return this.#lastDoubleClickTimestamp;
  }

  registerClick(now = Date.now()): "single_queued" | "double_triggered" | "double_cooldown_blocked" {
    if (this.#clickTimer !== null) {
      clearTimeout(this.#clickTimer);
      this.#clickTimer = null;

      if (this.#lastDoubleClickTimestamp === 0 || now - this.#lastDoubleClickTimestamp >= this.#doubleClickCooldownMs) {
        this.#lastDoubleClickTimestamp = now;
        const randomName =
          HARMLESS_ANIMATION_NAMES[Math.floor(Math.random() * HARMLESS_ANIMATION_NAMES.length)];
        this.#onDoubleClick(randomName);
        return "double_triggered";
      }
      return "double_cooldown_blocked";
    }

    this.#clickTimer = setTimeout(() => {
      this.#clickTimer = null;
      this.#onSingleClick();
    }, this.#clickDelayMs);

    return "single_queued";
  }

  cancelPendingClick(): void {
    if (this.#clickTimer !== null) {
      clearTimeout(this.#clickTimer);
      this.#clickTimer = null;
    }
  }

  dispose(): void {
    this.cancelPendingClick();
  }
}

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
  onNavigate(listener: (view: AppView) => void): () => void;
  triggerCharacterAction(input: TriggerCharacterActionInput): Promise<void>;
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
  navigate: "milo:navigate",
  triggerCharacterAction: "milo:trigger-character-action",
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
  "onNavigate",
  "triggerCharacterAction",
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



export type AnimationPersonality = "calm" | "energetic" | "chaotic" | "sleepy";

export interface MiloAccessories {
  head?: string;
  face?: string;
  neck?: string;
  body?: string;
}

export interface MiloAppearance {
  fur: CatAppearance;
  eyes: string;
  clothing?: string;
  accessories: MiloAccessories;
  animationPersonality: AnimationPersonality;
}

export interface MiloProgress {
  xp: number;
  level: number;
  firstMetAt: string;
  currentStreak: number;
}

export interface RoomItemState {
  id: string;
  x: number;
  y: number;
  scale: number;
  rotation?: number;
}
export interface RoomState {
  background: string;
  items: RoomItemState[];
}
