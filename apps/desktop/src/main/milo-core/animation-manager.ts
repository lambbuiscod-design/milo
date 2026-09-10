import {
  STATE_PRIORITIES,
  STATE_DURATIONS,
  type CharacterState,
  type AnimationRequest,
  type ActiveAnimation,
  type AnimationRequestResult,
  type CharacterStateSnapshot,
} from "./types";
import { EventBus, type MiloEventMap } from "./event-bus";
import { MiloStateMachine } from "./state-machine";

export class AnimationManager {
  readonly #stateMachine: MiloStateMachine;
  readonly #eventBus: EventBus<MiloEventMap>;
  #currentAnimation: ActiveAnimation | null = null;
  #animationTimer: NodeJS.Timeout | null = null;
  readonly #priorityQueue: AnimationRequest[] = [];
  readonly #returnStack: CharacterState[] = [];
  #isDisposed = false;

  constructor(stateMachine: MiloStateMachine, eventBus?: EventBus<MiloEventMap>) {
    this.#stateMachine = stateMachine;
    this.#eventBus = eventBus ?? stateMachine.eventBus;
  }

  get currentAnimation(): ActiveAnimation | null {
    return this.#currentAnimation;
  }

  get currentPriority(): number {
    return this.#currentAnimation?.priority ?? this.#stateMachine.currentPriority;
  }

  get queueLength(): number {
    return this.#priorityQueue.length;
  }

  get returnStackLength(): number {
    return this.#returnStack.length;
  }

  get stateMachine(): MiloStateMachine {
    return this.#stateMachine;
  }

  get eventBus(): EventBus<MiloEventMap> {
    return this.#eventBus;
  }

  /**
   * Enqueues a request or refreshes an existing queued request with the same ID,
   * maintaining strict descending priority sort. Returns 1-indexed position in queue.
   */
  #enqueueOrUpdate(request: AnimationRequest): number {
    const existingIndex = this.#priorityQueue.findIndex((r) => r.id === request.id);
    if (existingIndex >= 0) {
      this.#priorityQueue[existingIndex] = request;
    } else {
      this.#priorityQueue.push(request);
    }

    this.#priorityQueue.sort((a, b) => {
      const pA = a.priority ?? STATE_PRIORITIES[a.state] ?? 0;
      const pB = b.priority ?? STATE_PRIORITIES[b.state] ?? 0;
      return pB - pA;
    });

    return this.#priorityQueue.findIndex((r) => r.id === request.id) + 1;
  }

  /**
   * Requests an animation with priority evaluation, interruption, and queueing.
   */
  requestAnimation(request: AnimationRequest): AnimationRequestResult {
    if (this.#isDisposed) {
      return { accepted: false, status: "rejected", reason: "DISPOSED" };
    }

    // Refresh duration if re-triggering the same active animation
    if (this.#currentAnimation && this.#currentAnimation.id === request.id) {
      this.#clearTimer();
      const active: ActiveAnimation = {
        ...this.#currentAnimation,
        startTime: Date.now(),
        durationMs: request.durationMs ?? this.#currentAnimation.durationMs,
        interruptible: request.interruptible ?? this.#currentAnimation.interruptible,
        metadata: request.metadata ?? this.#currentAnimation.metadata,
      };
      this.#currentAnimation = active;
      this.#scheduleCompletion(active);
      return { accepted: true, status: "started", active };
    }

    const priority = request.priority ?? STATE_PRIORITIES[request.state] ?? 0;
    const currentPriority = this.currentPriority;
    const isCurrentInterruptible = this.#currentAnimation?.interruptible ?? true;

    // Case 1: Start animation if idle, or preempt active animation if higher priority and interruptible
    if (!this.#currentAnimation || (priority > currentPriority && isCurrentInterruptible)) {
      const previous = this.#currentAnimation;
      if (previous) {
        this.#clearTimer();
        // Save previous resumable target to return stack
        this.#returnStack.push(previous.returnState ?? previous.state ?? "idle");
        this.#eventBus.emit("animation:interrupted", {
          interrupted: previous,
          by: {
            id: request.id,
            state: request.state,
            priority,
            startTime: Date.now(),
            durationMs: request.durationMs,
            returnState: request.returnState ?? "idle",
            interruptible: request.interruptible ?? true,
            metadata: request.metadata,
          },
        });
      }

      const active: ActiveAnimation = {
        id: request.id,
        state: request.state,
        priority,
        startTime: Date.now(),
        durationMs: request.durationMs ?? STATE_DURATIONS[request.state],
        returnState: request.returnState ?? previous?.returnState ?? "idle",
        interruptible: request.interruptible ?? true,
        metadata: request.metadata,
      };

      this.#currentAnimation = active;
      this.#stateMachine.forceState(request.state, `ANIMATION_${request.id}`);
      this.#eventBus.emit("animation:started", active);

      this.#scheduleCompletion(active);

      return previous
        ? { accepted: true, status: "interrupted_previous", active, interrupted: previous }
        : { accepted: true, status: "started", active };
    }

    // Case 1b: Higher priority than active animation, but active animation is non-interruptible
    if (priority > currentPriority && !isCurrentInterruptible) {
      if (request.queueIfLower) {
        const position = this.#enqueueOrUpdate(request);
        this.#eventBus.emit("animation:queued", {
          id: request.id,
          state: request.state,
          priority,
          position,
        });
        return { accepted: true, status: "queued", position };
      }

      this.#eventBus.emit("animation:rejected", {
        id: request.id,
        state: request.state,
        priority,
        currentPriority,
        reason: "NON_INTERRUPTIBLE",
      });

      return {
        accepted: false,
        status: "rejected",
        reason: `Active animation ${this.#currentAnimation?.id} is non-interruptible`,
      };
    }

    // Case 2: Lower priority than active animation
    if (priority < currentPriority) {
      if (request.queueIfLower) {
        const position = this.#enqueueOrUpdate(request);
        this.#eventBus.emit("animation:queued", {
          id: request.id,
          state: request.state,
          priority,
          position,
        });
        return { accepted: true, status: "queued", position };
      }

      this.#eventBus.emit("animation:rejected", {
        id: request.id,
        state: request.state,
        priority,
        currentPriority,
        reason: "LOWER_PRIORITY",
      });

      return {
        accepted: false,
        status: "rejected",
        reason: `Request priority ${priority} is lower than current priority ${currentPriority}`,
      };
    }

    // Case 3: Equal priority
    if (request.queueIfLower) {
      const position = this.#enqueueOrUpdate(request);
      this.#eventBus.emit("animation:queued", {
        id: request.id,
        state: request.state,
        priority,
        position,
      });
      return { accepted: true, status: "queued", position };
    }

    this.#eventBus.emit("animation:rejected", {
      id: request.id,
      state: request.state,
      priority,
      currentPriority,
      reason: "EQUAL_PRIORITY_COLLISION",
    });

    return {
      accepted: false,
      status: "rejected",
      reason: `Request priority ${priority} equals active priority; active animation maintained to prevent thrashing`,
    };
  }

  /**
   * Completes an active animation, resolves pending queue, or transitions back to returnState.
   */
  completeAnimation(id: string): void {
    if (this.#isDisposed || !this.#currentAnimation || this.#currentAnimation.id !== id) {
      return;
    }

    this.#clearTimer();
    const completed = this.#currentAnimation;
    this.#currentAnimation = null;

    this.#eventBus.emit("animation:completed", {
      id: completed.id,
      state: completed.state,
      returnState: completed.returnState,
      durationMs: completed.durationMs,
    });

    // Check priority queue first
    if (this.#priorityQueue.length > 0) {
      const nextRequest = this.#priorityQueue.shift()!;
      this.requestAnimation(nextRequest);
      return;
    }

    // Check return stack: drain to root baseline and clear all accumulated preemption entries
    const returnTarget = this.#returnStack.length > 0 ? this.#returnStack[0] : (completed.returnState ?? "idle");
    this.#returnStack.length = 0;
    this.#stateMachine.forceState(returnTarget, "RETURN_STATE_RESTORED");
  }

  /**
   * Cancels an active animation or removes a queued request.
   */
  cancelAnimation(id: string): void {
    if (this.#currentAnimation?.id === id) {
      this.completeAnimation(id);
    } else {
      const idx = this.#priorityQueue.findIndex((r) => r.id === id);
      if (idx >= 0) {
        this.#priorityQueue.splice(idx, 1);
      }
    }
  }

  /**
   * Generates an immutable snapshot of the character engine state suitable for DesktopSnapshot.
   */
  getCharacterSnapshot(): CharacterStateSnapshot {
    return {
      currentState: this.#stateMachine.currentState,
      previousState: this.#stateMachine.previousState,
      currentPriority: this.currentPriority,
      activeAnimation: this.#currentAnimation
        ? {
            name: this.#currentAnimation.id,
            state: this.#currentAnimation.state,
            priority: this.#currentAnimation.priority,
            interruptible: this.#currentAnimation.interruptible ?? true,
            startedAt: this.#currentAnimation.startTime,
            duration: this.#currentAnimation.durationMs,
          }
        : null,
      lastTransitionTime: this.#stateMachine.lastTransitionTime,
      transitionReason: this.#stateMachine.lastTransitionReason,
    };
  }

  #scheduleCompletion(active: ActiveAnimation): void {
    if (active.durationMs && active.durationMs > 0) {
      this.#animationTimer = setTimeout(() => {
        if (!this.#isDisposed) {
          this.completeAnimation(active.id);
        }
      }, active.durationMs);
    }
  }

  #clearTimer(): void {
    if (this.#animationTimer) {
      clearTimeout(this.#animationTimer);
      this.#animationTimer = null;
    }
  }

  dispose(): void {
    this.#isDisposed = true;
    this.#clearTimer();
    this.#priorityQueue.length = 0;
    this.#returnStack.length = 0;
    this.#currentAnimation = null;
  }
}
