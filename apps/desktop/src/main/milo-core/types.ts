import {
  CHARACTER_STATES,
  type CharacterState,
  type CharacterAnimationSnapshot,
  type CharacterStateSnapshot,
} from "../../shared/contracts";

export {
  CHARACTER_STATES,
  type CharacterState,
  type CharacterAnimationSnapshot,
  type CharacterStateSnapshot,
};

/**
 * 19-state enum for the Milo Character Engine.
 */
export const MILO_STATES = CHARACTER_STATES;
export type MiloState = CharacterState;

/**
 * State aliases to guarantee backward compatibility with legacy 6-state DesktopState
 * and alternate naming conventions.
 */
export const STATE_ALIASES: Readonly<Record<string, CharacterState>> = Object.freeze({
  noticed: "alert",
  generating: "thinking",
  petting: "pet",
  dropped: "drop",
  suggesting: "ready",
  wake_up: "waking",
});

/**
 * Resolves an arbitrary string into a valid canonical CharacterState.
 */
export function resolveMiloState(input: string): CharacterState {
  if ((CHARACTER_STATES as readonly string[]).includes(input)) {
    return input as CharacterState;
  }
  if (input in STATE_ALIASES) {
    return STATE_ALIASES[input];
  }
  return "idle";
}

/**
 * Priority Hierarchy Ladder (0 - 100).
 * Higher numerical priority interrupts lower numerical priority.
 */
export const STATE_PRIORITIES: Readonly<Record<CharacterState, number>> = Object.freeze({
  dragging: 100, // Critical user physics manipulation
  drop: 90, // Immediate landing squash & settle physics
  paused: 85, // Security / privacy fail-closed override
  level_up: 80, // Major progression fanfare
  celebrating: 75, // Achievement / copy / streak milestone
  thinking: 70, // AI suggestion generation active
  happy: 70, // Emotional reaction
  laughing: 70, // Emotional reaction
  surprised: 70, // Emotional reaction
  confident: 70, // Emotional reaction
  annoyed: 70, // Emotional reaction
  affectionate: 70, // Emotional reaction
  ready: 65, // Suggestions ready & bubbles visible
  pet: 60, // Direct user affection interaction
  error: 50, // Diagnostic error feedback
  purring: 45, // Affection afterglow
  alert: 40, // Message noticed in watched window
  offline: 40, // Connection lost / offline
  playful: 35, // Ambient high-energy action
  curious: 30, // Inquisitive head tilt
  waking: 25, // Awakening from sleep stretch
  looking: 20, // Ambient eye glance / cursor tracking
  sleepy: 15, // Drowsiness pre-sleep
  sleeping: 10, // Deep idle sleep
  idle: 0, // Baseline resting state
});

/**
 * Default animation durations (in milliseconds) for transient states.
 * 0 indicates persistent state until next event.
 */
export const STATE_DURATIONS: Readonly<Record<CharacterState, number>> = Object.freeze({
  idle: 0,
  looking: 4000,
  sleepy: 4000,
  sleeping: 0,
  waking: 1800,
  dragging: 0,
  drop: 700,
  pet: 2000,
  purring: 3000,
  curious: 3000,
  playful: 3000,
  alert: 12000,
  thinking: 0,
  ready: 0,
  celebrating: 2500,
  level_up: 3500,
  paused: 0,
  error: 8000,
  offline: 0,
  happy: 2500,
  laughing: 2500,
  surprised: 2000,
  confident: 3000,
  annoyed: 2500,
  affectionate: 2500,
});

/**
 * Allowed events that trigger state machine transitions.
 */
export type MiloStateEvent =
  | "DRAG_START"
  | "DRAG_END"
  | "LOOK_AROUND"
  | "INACTIVITY_TIMEOUT"
  | "WAKE_UP"
  | "PET"
  | "PURR_COMPLETE"
  | "MESSAGE_NOTICED"
  | "ASK_MILO"
  | "SUGGESTIONS_READY"
  | "REPLY_COPIED"
  | "PANEL_CLOSED"
  | "LEVEL_UP_AWARD"
  | "CELEBRATION_COMPLETE"
  | "PAUSE_TOGGLE"
  | "RESUME_TOGGLE"
  | "ERROR_OCCURRED"
  | "RESET"
  | "TIMER_EXPIRED";

export interface StateTransitionRecord {
  readonly id: string;
  readonly from: CharacterState;
  readonly to: CharacterState;
  readonly event: MiloStateEvent;
  readonly timestamp: number;
  readonly metadata?: Record<string, unknown>;
}

export interface AnimationRequest {
  readonly id: string;
  readonly state: CharacterState;
  readonly priority?: number;
  readonly durationMs?: number;
  readonly returnState?: CharacterState;
  readonly queueIfLower?: boolean;
  readonly interruptible?: boolean;
  readonly metadata?: Record<string, unknown>;
}

export interface ActiveAnimation {
  readonly id: string;
  readonly state: CharacterState;
  readonly priority: number;
  readonly startTime: number;
  readonly durationMs?: number;
  readonly returnState: CharacterState;
  readonly interruptible?: boolean;
  readonly metadata?: Record<string, unknown>;
}

export type AnimationRequestResult =
  | { accepted: true; status: "started"; active: ActiveAnimation }
  | { accepted: true; status: "interrupted_previous"; active: ActiveAnimation; interrupted: ActiveAnimation }
  | { accepted: true; status: "queued"; position: number }
  | { accepted: false; status: "rejected"; reason: string };
