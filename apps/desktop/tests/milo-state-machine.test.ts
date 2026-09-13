import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MiloStateMachine } from "../src/main/milo-core/state-machine";
import { EventBus } from "../src/main/milo-core/event-bus";
import { resolveMiloState, STATE_DURATIONS } from "../src/main/milo-core/types";

describe("MiloStateMachine (Milestone 2 Requirement R1)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe("EventBus", () => {
    it("subscribes and emits events to handlers", () => {
      const bus = new EventBus();
      const handler = vi.fn();
      const unbind = bus.subscribe("system:reset", handler);

      bus.emit("system:reset", { timestamp: 12345 });
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({ timestamp: 12345 });

      unbind();
      bus.emit("system:reset", { timestamp: 67890 });
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("handles once() subscriptions correctly", () => {
      const bus = new EventBus();
      const handler = vi.fn();
      bus.once("system:pause", handler);

      bus.emit("system:pause", { paused: true });
      bus.emit("system:pause", { paused: false });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({ paused: true });
    });

    it("isolates handler errors and notifies onError callback", () => {
      const onError = vi.fn();
      const bus = new EventBus({ onError });
      const badHandler = vi.fn().mockImplementation(() => {
        throw new Error("handler failure");
      });
      const goodHandler = vi.fn();

      bus.subscribe("system:reset", badHandler);
      bus.subscribe("system:reset", goodHandler);

      bus.emit("system:reset", { timestamp: 111 });

      expect(badHandler).toHaveBeenCalledTimes(1);
      expect(goodHandler).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledTimes(1);
    });

    it("tracks listener counts and clears listeners", () => {
      const bus = new EventBus();
      const fn1 = () => {};
      const fn2 = () => {};

      expect(bus.listenerCount()).toBe(0);
      bus.subscribe("system:pause", fn1);
      bus.subscribe("system:pause", fn2);
      bus.subscribe("system:reset", fn1);

      expect(bus.listenerCount("system:pause")).toBe(2);
      expect(bus.listenerCount("system:reset")).toBe(1);
      expect(bus.listenerCount()).toBe(3);

      bus.clear("system:pause");
      expect(bus.listenerCount("system:pause")).toBe(0);
      expect(bus.listenerCount()).toBe(1);

      bus.clear();
      expect(bus.listenerCount()).toBe(0);
    });
  });

  describe("State Transitions & Acceptance Criteria", () => {
    it("initializes to idle state with priority 0", () => {
      const sm = new MiloStateMachine();
      expect(sm.currentState).toBe("idle");
      expect(sm.currentPriority).toBe(0);
      expect(sm.isPaused).toBe(false);
      expect(sm.isDragging).toBe(false);
      expect(sm.previousState).toBeNull();
      sm.dispose();
    });

    it("verifies full lifecycle: idle -> dragging -> drop -> idle (Acceptance Criterion)", () => {
      const sm = new MiloStateMachine();
      expect(sm.currentState).toBe("idle");

      // 1. User starts dragging
      const dragStarted = sm.transition("DRAG_START");
      expect(dragStarted).toBe(true);
      expect(sm.currentState).toBe("dragging");
      expect(sm.isDragging).toBe(true);
      expect(sm.currentPriority).toBe(100);

      // 2. User releases drag -> drop landing squash
      const dragEnded = sm.transition("DRAG_END");
      expect(dragEnded).toBe(true);
      expect(sm.currentState).toBe("drop");
      expect(sm.currentPriority).toBe(90);

      // 3. Drop timer (700ms) completes automatically -> idle
      vi.advanceTimersByTime(STATE_DURATIONS.drop);
      expect(sm.currentState).toBe("idle");
      expect(sm.currentPriority).toBe(0);

      sm.dispose();
    });

    it("rejects invalid state transitions and emits rejection event", () => {
      const eventBus = new EventBus();
      const rejectedHandler = vi.fn();
      eventBus.subscribe("state:transition_rejected", rejectedHandler);

      const sm = new MiloStateMachine({ eventBus });

      // DRAG_END is only allowed from dragging, not idle
      const result = sm.transition("DRAG_END");
      expect(result).toBe(false);
      expect(sm.currentState).toBe("idle");
      expect(rejectedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          current: "idle",
          event: "DRAG_END",
          reason: "INVALID_SOURCE_STATE_idle",
        }),
      );

      sm.dispose();
    });

    it("fails closed while paused (safety invariant)", () => {
      const eventBus = new EventBus();
      const rejectedHandler = vi.fn();
      eventBus.subscribe("state:transition_rejected", rejectedHandler);

      const sm = new MiloStateMachine({ eventBus });

      // Enter paused state
      expect(sm.transition("PAUSE_TOGGLE")).toBe(true);
      expect(sm.currentState).toBe("paused");
      expect(sm.isPaused).toBe(true);
      expect(sm.currentPriority).toBe(85);

      // Reject assistant message
      expect(sm.transition("MESSAGE_NOTICED")).toBe(false);
      expect(sm.currentState).toBe("paused");

      // Reject pet interaction
      expect(sm.transition("PET")).toBe(false);
      expect(sm.currentState).toBe("paused");

      // Reject drag start
      expect(sm.transition("DRAG_START")).toBe(false);
      expect(sm.currentState).toBe("paused");

      // Reject suggestion ask
      expect(sm.transition("ASK_MILO")).toBe(false);
      expect(sm.currentState).toBe("paused");

      expect(rejectedHandler).toHaveBeenCalledTimes(4);
      expect(rejectedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          current: "paused",
          reason: "PAUSED_FAILS_CLOSED",
        }),
      );

      // Resume recovers to idle
      expect(sm.transition("RESUME_TOGGLE")).toBe(true);
      expect(sm.currentState).toBe("idle");
      expect(sm.isPaused).toBe(false);

      sm.dispose();
    });

    it("auto-transitions transient states via timers", () => {
      const sm = new MiloStateMachine();

      // sleepy -> sleeping
      sm.transition("INACTIVITY_TIMEOUT");
      expect(sm.currentState).toBe("sleepy");
      vi.advanceTimersByTime(STATE_DURATIONS.sleepy);
      expect(sm.currentState).toBe("sleeping");

      // wake up -> waking -> idle
      sm.transition("WAKE_UP");
      expect(sm.currentState).toBe("waking");
      vi.advanceTimersByTime(STATE_DURATIONS.waking);
      expect(sm.currentState).toBe("idle");

      // pet -> purring -> idle
      sm.transition("PET");
      expect(sm.currentState).toBe("pet");
      vi.advanceTimersByTime(STATE_DURATIONS.pet);
      expect(sm.currentState).toBe("purring");
      vi.advanceTimersByTime(STATE_DURATIONS.purring);
      expect(sm.currentState).toBe("idle");

      // level_up -> celebrating -> idle
      sm.transition("LEVEL_UP_AWARD");
      expect(sm.currentState).toBe("level_up");
      vi.advanceTimersByTime(STATE_DURATIONS.level_up);
      expect(sm.currentState).toBe("celebrating");
      vi.advanceTimersByTime(STATE_DURATIONS.celebrating);
      expect(sm.currentState).toBe("idle");

      sm.dispose();
    });

    it("cancels active auto-return timer if state changes before expiry", () => {
      const sm = new MiloStateMachine();

      sm.transition("DRAG_START");
      sm.transition("DRAG_END");
      expect(sm.currentState).toBe("drop");

      // Advance 300ms of 700ms drop duration
      vi.advanceTimersByTime(300);

      // User immediately grabs again before drop completes
      sm.transition("DRAG_START");
      expect(sm.currentState).toBe("dragging");

      // Advance past the remaining 400ms of original drop
      vi.advanceTimersByTime(500);
      // State should still be dragging, not reset to idle by old drop timer!
      expect(sm.currentState).toBe("dragging");

      sm.dispose();
    });

    it("maintains a bounded history ring buffer capped at 50 records", () => {
      const sm = new MiloStateMachine({ maxHistoryLength: 50 });

      // Run 65 valid transitions
      for (let i = 0; i < 65; i++) {
        sm.forceState(i % 2 === 0 ? "idle" : "looking", `step_${i}`);
      }

      expect(sm.history.length).toBe(50);
      expect(sm.history[49].metadata?.reason).toBe("step_64");

      sm.clearHistory();
      expect(sm.history.length).toBe(0);

      sm.dispose();
    });

    it("forceState updates state and records transition metadata", () => {
      const sm = new MiloStateMachine();

      sm.forceState("celebrating", "TEST_MANUAL");
      expect(sm.currentState).toBe("celebrating");
      expect(sm.previousState).toBe("idle");
      expect(sm.lastTransitionReason).toBe("TEST_MANUAL");

      sm.dispose();
    });

    it("resolves state aliases correctly for backward compatibility", () => {
      expect(resolveMiloState("noticed")).toBe("alert");
      expect(resolveMiloState("generating")).toBe("thinking");
      expect(resolveMiloState("petting")).toBe("pet");
      expect(resolveMiloState("dropped")).toBe("drop");
      expect(resolveMiloState("suggesting")).toBe("ready");
      expect(resolveMiloState("wake_up")).toBe("waking");
      expect(resolveMiloState("dragging")).toBe("dragging");
      expect(resolveMiloState("non_existent")).toBe("idle");
    });
  });
});
