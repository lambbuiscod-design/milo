import type {
  CharacterState,
  MiloStateEvent,
  StateTransitionRecord,
  ActiveAnimation,
} from "./types";

export interface MiloEventMap {
  // State machine events
  "state:changed": StateTransitionRecord;
  "state:transition_rejected": {
    current: CharacterState;
    event: MiloStateEvent;
    reason: string;
    timestamp: number;
  };

  // Animation manager events
  "animation:started": ActiveAnimation;
  "animation:completed": {
    id: string;
    state: CharacterState;
    returnState: CharacterState;
    durationMs?: number;
  };
  "animation:interrupted": {
    interrupted: ActiveAnimation;
    by: ActiveAnimation;
  };
  "animation:rejected": {
    id: string;
    state: CharacterState;
    priority: number;
    currentPriority: number;
    reason: string;
  };
  "animation:queued": {
    id: string;
    state: CharacterState;
    priority: number;
    position: number;
  };

  // User interaction events
  "interaction:drag_start": { x: number; y: number };
  "interaction:drag_end": { x: number; y: number };
  "interaction:pet": { count: number };

  // System & Lifecycle events
  "system:pause": { paused: boolean };
  "system:reset": { timestamp: number };
}

export type EventHandler<T = any> = (payload: T) => void;

export class EventBus<Events extends Record<string, any> = MiloEventMap> {
  readonly #listeners = new Map<keyof Events, Set<EventHandler>>();
  readonly #onError?: (error: unknown, event: keyof Events) => void;

  constructor(options?: { onError?: (error: unknown, event: keyof Events) => void }) {
    this.#onError = options?.onError;
  }

  /**
   * Subscribes to an event and returns an unbind function.
   */
  subscribe<E extends keyof Events>(event: E, handler: EventHandler<Events[E]>): () => void {
    let set = this.#listeners.get(event);
    if (!set) {
      set = new Set();
      this.#listeners.set(event, set);
    }
    set.add(handler as EventHandler);

    return () => this.unsubscribe(event, handler);
  }

  /**
   * Explicitly unbinds a previously registered handler.
   */
  unsubscribe<E extends keyof Events>(event: E, handler: EventHandler<Events[E]>): void {
    const set = this.#listeners.get(event);
    if (!set) return;
    set.delete(handler as EventHandler);
    if (set.size === 0) {
      this.#listeners.delete(event);
    }
  }

  /**
   * Registers a single-use listener that automatically unbinds upon first invocation.
   */
  once<E extends keyof Events>(event: E, handler: EventHandler<Events[E]>): () => void {
    const unbind = this.subscribe(event, (payload: Events[E]) => {
      unbind();
      handler(payload);
    });
    return unbind;
  }

  /**
   * Emits an event synchronously to all registered handlers with error isolation.
   * A failure in one handler will not block other handlers from executing.
   */
  emit<E extends keyof Events>(event: E, payload: Events[E]): void {
    const set = this.#listeners.get(event);
    if (!set || set.size === 0) return;

    // Snapshot set to prevent mutation issues during emission
    const snapshot = Array.from(set);
    for (const handler of snapshot) {
      try {
        handler(payload);
      } catch (error) {
        if (this.#onError) {
          this.#onError(error, event);
        }
      }
    }
  }

  /**
   * Returns active listener count for a specific event or total listeners across all events.
   */
  listenerCount<E extends keyof Events>(event?: E): number {
    if (event !== undefined) {
      return this.#listeners.get(event)?.size ?? 0;
    }
    let total = 0;
    for (const set of this.#listeners.values()) {
      total += set.size;
    }
    return total;
  }

  /**
   * Cleans up all listeners or listeners for a specific event.
   */
  clear<E extends keyof Events>(event?: E): void {
    if (event !== undefined) {
      this.#listeners.delete(event);
    } else {
      this.#listeners.clear();
    }
  }
}
