import {
  CHARACTER_STATES,
  STATE_PRIORITIES,
  STATE_DURATIONS,
  type CharacterState,
  type MiloStateEvent,
  type StateTransitionRecord,
} from "./types";
import { EventBus, type MiloEventMap } from "./event-bus";

/**
 * Transition Rule definition.
 * target can be a fixed CharacterState or a function of current state.
 */
interface TransitionRule {
  readonly target: CharacterState | ((current: CharacterState) => CharacterState);
  readonly allowedSources: readonly CharacterState[] | "*";
}

const TRANSITION_RULES: Readonly<Record<MiloStateEvent, TransitionRule>> = Object.freeze({
  PAUSE_TOGGLE: { target: "paused", allowedSources: "*" },
  RESUME_TOGGLE: { target: "idle", allowedSources: ["paused"] },
  RESET: { target: "idle", allowedSources: "*" },
  ERROR_OCCURRED: { target: "error", allowedSources: "*" },

  DRAG_START: {
    target: "dragging",
    allowedSources: CHARACTER_STATES.filter((s) => s !== "paused"),
  },
  DRAG_END: {
    target: "drop",
    allowedSources: ["dragging"],
  },
  TIMER_EXPIRED: {
    target: (current: CharacterState) => {
      if (current === "sleepy") return "sleeping";
      if (current === "pet") return "purring";
      if (current === "level_up") return "celebrating";
      return "idle";
    },
    allowedSources: [
      "drop",
      "looking",
      "sleepy",
      "waking",
      "pet",
      "purring",
      "curious",
      "playful",
      "alert",
      "celebrating",
      "level_up",
      "error",
    ],
  },
  LOOK_AROUND: {
    target: "looking",
    allowedSources: ["idle"],
  },
  INACTIVITY_TIMEOUT: {
    target: "sleepy",
    allowedSources: ["idle", "looking"],
  },
  WAKE_UP: {
    target: "waking",
    allowedSources: ["sleeping", "sleepy"],
  },
  PET: {
    target: "pet",
    allowedSources: ["idle", "looking", "sleeping", "curious", "ready"],
  },
  PURR_COMPLETE: {
    target: "purring",
    allowedSources: ["pet"],
  },
  MESSAGE_NOTICED: {
    target: "alert",
    allowedSources: ["idle", "looking", "sleeping", "waking", "curious", "playful"],
  },
  ASK_MILO: {
    target: "thinking",
    allowedSources: ["idle", "looking", "alert", "ready", "curious", "playful"],
  },
  SUGGESTIONS_READY: {
    target: "ready",
    allowedSources: ["thinking"],
  },
  REPLY_COPIED: {
    target: "celebrating",
    allowedSources: ["ready", "thinking", "idle"],
  },
  PANEL_CLOSED: {
    target: "idle",
    allowedSources: ["ready", "thinking"],
  },
  LEVEL_UP_AWARD: {
    target: "level_up",
    allowedSources: CHARACTER_STATES.filter((s) => s !== "paused" && s !== "dragging"),
  },
  CELEBRATION_COMPLETE: {
    target: "celebrating",
    allowedSources: ["level_up"],
  },
});

export interface MiloStateMachineOptions {
  readonly initialState?: CharacterState;
  readonly eventBus?: EventBus<MiloEventMap>;
  readonly maxHistoryLength?: number;
}

export class MiloStateMachine {
  #currentState: CharacterState;
  #previousState: CharacterState | null = null;
  readonly #eventBus: EventBus<MiloEventMap>;
  readonly #history: StateTransitionRecord[] = [];
  readonly #maxHistoryLength: number;
  #activeTimer: NodeJS.Timeout | null = null;
  #lastTransitionTime: number;
  #lastTransitionReason: string | undefined = undefined;
  #isDisposed = false;

  constructor(options?: MiloStateMachineOptions) {
    this.#currentState = options?.initialState ?? "idle";
    this.#eventBus = options?.eventBus ?? new EventBus();
    this.#maxHistoryLength = options?.maxHistoryLength ?? 50;
    this.#lastTransitionTime = Date.now();
  }

  get currentState(): CharacterState {
    return this.#currentState;
  }

  get previousState(): CharacterState | null {
    return this.#previousState;
  }

  get currentPriority(): number {
    return STATE_PRIORITIES[this.#currentState] ?? 0;
  }

  get isPaused(): boolean {
    return this.#currentState === "paused";
  }

  get isDragging(): boolean {
    return this.#currentState === "dragging";
  }

  get lastTransitionTime(): number {
    return this.#lastTransitionTime;
  }

  get lastTransitionReason(): string | undefined {
    return this.#lastTransitionReason;
  }

  get history(): readonly StateTransitionRecord[] {
    return [...this.#history];
  }

  get eventBus(): EventBus<MiloEventMap> {
    return this.#eventBus;
  }

  /**
   * Attempts a deterministic state transition.
   * Returns true if transition was valid and executed; false if rejected.
   */
  transition(event: MiloStateEvent, metadata?: Record<string, unknown>): boolean {
    if (this.#isDisposed) return false;

    // Safety rule: paused state fails closed to all events except RESUME_TOGGLE and RESET
    if (this.#currentState === "paused" && event !== "RESUME_TOGGLE" && event !== "RESET") {
      this.#eventBus.emit("state:transition_rejected", {
        current: this.#currentState,
        event,
        reason: "PAUSED_FAILS_CLOSED",
        timestamp: Date.now(),
      });
      return false;
    }

    const rule = TRANSITION_RULES[event];
    if (!rule) {
      this.#eventBus.emit("state:transition_rejected", {
        current: this.#currentState,
        event,
        reason: `UNKNOWN_EVENT_${event}`,
        timestamp: Date.now(),
      });
      return false;
    }

    const isAllowed =
      rule.allowedSources === "*" ||
      (Array.isArray(rule.allowedSources) && rule.allowedSources.includes(this.#currentState));

    if (!isAllowed) {
      this.#eventBus.emit("state:transition_rejected", {
        current: this.#currentState,
        event,
        reason: `INVALID_SOURCE_STATE_${this.#currentState}`,
        timestamp: Date.now(),
      });
      return false;
    }

    const fromState = this.#currentState;
    const toState = typeof rule.target === "function" ? rule.target(this.#currentState) : rule.target;

    this.#clearTimer();

    this.#previousState = fromState;
    this.#currentState = toState;
    this.#lastTransitionTime = Date.now();
    this.#lastTransitionReason = event;

    const record: StateTransitionRecord = {
      id: `trans_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      from: fromState,
      to: toState,
      event,
      timestamp: this.#lastTransitionTime,
      metadata,
    };

    this.#recordHistory(record);
    this.#eventBus.emit("state:changed", record);

    this.#scheduleTransientAutoReturn(toState);

    return true;
  }

  /**
   * Directly sets the state if instructed by the AnimationManager.
   */
  forceState(newState: CharacterState, reason = "FORCED"): void {
    if (this.#isDisposed) return;
    this.#clearTimer();
    const fromState = this.#currentState;
    this.#previousState = fromState;
    this.#currentState = newState;
    this.#lastTransitionTime = Date.now();
    this.#lastTransitionReason = reason;

    const record: StateTransitionRecord = {
      id: `force_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      from: fromState,
      to: newState,
      event: "RESET",
      timestamp: this.#lastTransitionTime,
      metadata: { reason },
    };

    this.#recordHistory(record);
    this.#eventBus.emit("state:changed", record);
    this.#scheduleTransientAutoReturn(newState);
  }

  #scheduleTransientAutoReturn(state: CharacterState): void {
    const duration = STATE_DURATIONS[state];
    if (duration && duration > 0) {
      this.#activeTimer = setTimeout(() => {
        if (!this.#isDisposed) {
          if (state === "pet") {
            this.transition("PURR_COMPLETE");
          } else if (state === "level_up") {
            this.transition("CELEBRATION_COMPLETE");
          } else {
            this.transition("TIMER_EXPIRED");
          }
        }
      }, duration);
    }
  }

  #clearTimer(): void {
    if (this.#activeTimer) {
      clearTimeout(this.#activeTimer);
      this.#activeTimer = null;
    }
  }

  #recordHistory(record: StateTransitionRecord): void {
    this.#history.push(record);
    if (this.#history.length > this.#maxHistoryLength) {
      this.#history.shift();
    }
  }

  clearHistory(): void {
    this.#history.length = 0;
  }

  dispose(): void {
    this.#isDisposed = true;
    this.#clearTimer();
    this.clearHistory();
  }
}
