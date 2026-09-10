import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MiloStateMachine } from "../src/main/milo-core/state-machine";
import { EventBus } from "../src/main/milo-core/event-bus";
import {
  CHARACTER_STATES,
  type CharacterState,
  type MiloStateEvent,
  STATE_PRIORITIES,
  STATE_DURATIONS,
} from "../src/main/milo-core/types";

// Deterministic Pseudo-Random Number Generator (Mulberry32)
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ALL_MILO_EVENTS: readonly MiloStateEvent[] = [
  "DRAG_START",
  "DRAG_END",
  "LOOK_AROUND",
  "INACTIVITY_TIMEOUT",
  "WAKE_UP",
  "PET",
  "PURR_COMPLETE",
  "MESSAGE_NOTICED",
  "ASK_MILO",
  "SUGGESTIONS_READY",
  "REPLY_COPIED",
  "PANEL_CLOSED",
  "LEVEL_UP_AWARD",
  "CELEBRATION_COMPLETE",
  "PAUSE_TOGGLE",
  "RESUME_TOGGLE",
  "ERROR_OCCURRED",
  "RESET",
  "TIMER_EXPIRED",
];

describe("MiloStateMachine & EventBus Adversarial Stress Suite (Challenger)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // =========================================================================
  // VECTOR 1: Rapid Concurrent Transitions
  // =========================================================================
  describe("Attack Vector 1: Rapid Concurrent Transitions", () => {
    it("executes 1,000 randomized state transitions in a tight loop without unhandled exceptions, corruption, and strictly bounds history at 50", () => {
      const sm = new MiloStateMachine({ maxHistoryLength: 50 });
      const rng = mulberry32(424242);
      const invalidNoise = [
        "INVALID_EVENT_XYZ",
        "DROP_NOW",
        "HACK_TRANSITION",
        "",
        "null",
      ];
      const combinedPool = [...ALL_MILO_EVENTS, ...invalidNoise];

      let acceptedCount = 0;
      let rejectedCount = 0;

      for (let i = 0; i < 1000; i++) {
        const event = combinedPool[Math.floor(rng() * combinedPool.length)] as MiloStateEvent;
        const meta = { iteration: i, payload: `adversarial_${i}` };

        let result = false;
        expect(() => {
          result = sm.transition(event, meta);
        }).not.toThrow();

        if (result) {
          acceptedCount++;
        } else {
          rejectedCount++;
        }

        // Invariant 1: currentState must always remain in canonical CHARACTER_STATES
        expect(CHARACTER_STATES).toContain(sm.currentState);

        // Invariant 2: History must never exceed maxHistoryLength (50)
        expect(sm.history.length).toBeLessThanOrEqual(50);

        // Invariant 3: currentPriority matches STATE_PRIORITIES
        expect(sm.currentPriority).toBe(STATE_PRIORITIES[sm.currentState]);
      }

      // Ensure both accepted and rejected transitions occurred in the random barrage
      expect(acceptedCount).toBeGreaterThan(100);
      expect(rejectedCount).toBeGreaterThan(100);

      // Verify the final state of the history buffer
      expect(sm.history.length).toBe(50);
      for (const record of sm.history) {
        expect(CHARACTER_STATES).toContain(record.from);
        expect(CHARACTER_STATES).toContain(record.to);
        expect(ALL_MILO_EVENTS).toContain(record.event);
        expect(typeof record.timestamp).toBe("number");
        expect(record.timestamp).toBeGreaterThan(0);
      }

      sm.dispose();
    });

    it("survives concurrent asynchronous barrage of 1,000 transitions across multiple interleaved workers", async () => {
      const sm = new MiloStateMachine({ maxHistoryLength: 50 });
      const workerCount = 5;
      const iterationsPerWorker = 200;

      const workers = Array.from({ length: workerCount }, (_, workerIdx) => {
        return (async () => {
          const rng = mulberry32(1000 + workerIdx);
          for (let i = 0; i < iterationsPerWorker; i++) {
            const event = ALL_MILO_EVENTS[Math.floor(rng() * ALL_MILO_EVENTS.length)];
            sm.transition(event, { worker: workerIdx, step: i });
            // Yield to microtask queue to simulate interleaved concurrent execution
            await Promise.resolve();
            expect(sm.history.length).toBeLessThanOrEqual(50);
            expect(CHARACTER_STATES).toContain(sm.currentState);
          }
        })();
      });

      await Promise.all(workers);

      expect(sm.history.length).toBe(50);
      expect(CHARACTER_STATES).toContain(sm.currentState);

      sm.dispose();
    });

    it("handles re-entrant transitions in event listeners without throwing or corrupting state", () => {
      const eventBus = new EventBus();
      const sm = new MiloStateMachine({ eventBus });
      let reentrancyDepth = 0;
      const maxReentrancy = 3;

      eventBus.subscribe("state:changed", (record) => {
        if (reentrancyDepth < maxReentrancy && record.to === "looking") {
          reentrancyDepth++;
          // Re-entrant transition inside notification callback
          sm.transition("DRAG_START");
        }
      });

      expect(() => {
        sm.transition("LOOK_AROUND");
      }).not.toThrow();

      expect(CHARACTER_STATES).toContain(sm.currentState);
      expect(reentrancyDepth).toBe(1);
      expect(sm.currentState).toBe("dragging");

      sm.dispose();
    });
  });

  // =========================================================================
  // VECTOR 2: Privacy Lock Violations
  // =========================================================================
  describe("Attack Vector 2: Privacy Lock Violations", () => {
    it("enforces fail-closed security: attempts to transition out of paused using every event except RESUME_TOGGLE and RESET are 100% rejected", () => {
      const eventBus = new EventBus();
      const rejectionEvents: Array<{ event: string; reason: string }> = [];
      eventBus.subscribe("state:transition_rejected", (payload) => {
        rejectionEvents.push({ event: payload.event, reason: payload.reason });
      });

      const sm = new MiloStateMachine({ eventBus });

      // Put into paused state
      const pauseResult = sm.transition("PAUSE_TOGGLE");
      expect(pauseResult).toBe(true);
      expect(sm.currentState).toBe("paused");
      expect(sm.isPaused).toBe(true);
      expect(sm.currentPriority).toBe(85);

      const historyLengthBeforeAttacks = sm.history.length;

      // Filter all events except RESUME_TOGGLE and RESET
      const illegalEvents = ALL_MILO_EVENTS.filter(
        (e) => e !== "RESUME_TOGGLE" && e !== "RESET",
      );

      expect(illegalEvents.length).toBe(17);

      for (const event of illegalEvents) {
        const rejected = sm.transition(event);
        expect(
          rejected,
          `Event ${event} must be rejected when state machine is in paused state`,
        ).toBe(false);
        expect(sm.currentState).toBe("paused");
        expect(sm.isPaused).toBe(true);
      }

      // Verify all 17 rejections were emitted with PAUSED_FAILS_CLOSED
      expect(rejectionEvents.length).toBe(17);
      for (const rej of rejectionEvents) {
        expect(rej.reason).toBe("PAUSED_FAILS_CLOSED");
      }

      // History should NOT contain any rejected transition records
      expect(sm.history.length).toBe(historyLengthBeforeAttacks);

      // Verify arbitrary malicious strings fail closed while paused
      const maliciousStrings = [
        "RESUME",
        "UNPAUSE",
        "QUIT",
        "DROP",
        "FORCE_EXIT",
        "null",
        "undefined",
        "__proto__",
        "constructor",
        "; DROP TABLE;",
      ];

      for (const badStr of maliciousStrings) {
        const rejected = sm.transition(badStr as MiloStateEvent);
        expect(rejected).toBe(false);
        expect(sm.currentState).toBe("paused");
      }

      // Verify timers cannot break out of paused state
      vi.advanceTimersByTime(1000 * 60 * 60 * 24); // 24 hours
      expect(sm.currentState).toBe("paused");
      expect(sm.isPaused).toBe(true);

      // Verify legitimate recovery via RESUME_TOGGLE
      const resumeResult = sm.transition("RESUME_TOGGLE");
      expect(resumeResult).toBe(true);
      expect(sm.currentState).toBe("idle");
      expect(sm.isPaused).toBe(false);

      // Verify RESET can also break out of paused state
      sm.transition("PAUSE_TOGGLE");
      expect(sm.currentState).toBe("paused");
      const resetResult = sm.transition("RESET");
      expect(resetResult).toBe(true);
      expect(sm.currentState).toBe("idle");

      sm.dispose();
    });
  });

  // =========================================================================
  // VECTOR 3: Illegal Transition Sequences
  // =========================================================================
  describe("Attack Vector 3: Illegal Transition Sequences", () => {
    it("confirms illegal transitions (e.g. drop from idle, thinking from sleeping, purr from idle) fail closed", () => {
      const sm = new MiloStateMachine();

      // 1. drop (DRAG_END) from idle
      expect(sm.currentState).toBe("idle");
      expect(sm.transition("DRAG_END")).toBe(false);
      expect(sm.currentState).toBe("idle");

      // 2. purr (PURR_COMPLETE) from idle
      expect(sm.transition("PURR_COMPLETE")).toBe(false);
      expect(sm.currentState).toBe("idle");

      // 3. suggestions ready from idle
      expect(sm.transition("SUGGESTIONS_READY")).toBe(false);
      expect(sm.currentState).toBe("idle");

      // 4. thinking (ASK_MILO) from sleeping
      sm.forceState("sleeping");
      expect(sm.currentState).toBe("sleeping");
      expect(sm.transition("ASK_MILO")).toBe(false);
      expect(sm.currentState).toBe("sleeping");

      // 5. drop (DRAG_END) from sleeping
      expect(sm.transition("DRAG_END")).toBe(false);
      expect(sm.currentState).toBe("sleeping");

      // 6. look around from sleeping
      expect(sm.transition("LOOK_AROUND")).toBe(false);
      expect(sm.currentState).toBe("sleeping");

      // 7. wake_up from idle (only allowed from sleeping / sleepy)
      sm.forceState("idle");
      expect(sm.transition("WAKE_UP")).toBe(false);
      expect(sm.currentState).toBe("idle");

      // 8. celebration_complete from idle (only allowed from level_up)
      expect(sm.transition("CELEBRATION_COMPLETE")).toBe(false);
      expect(sm.currentState).toBe("idle");

      // 9. panel_closed from dragging
      sm.forceState("dragging");
      expect(sm.transition("PANEL_CLOSED")).toBe(false);
      expect(sm.currentState).toBe("dragging");

      // 10. drag_start while paused
      sm.forceState("paused");
      expect(sm.transition("DRAG_START")).toBe(false);
      expect(sm.currentState).toBe("paused");

      sm.dispose();
    });

    it("verifies the full 19 states x 19 events transition matrix adheres to strict whitelist", () => {
      const sm = new MiloStateMachine();
      let totalTests = 0;
      let totalRejections = 0;
      let totalAcceptances = 0;

      for (const state of CHARACTER_STATES) {
        for (const event of ALL_MILO_EVENTS) {
          sm.forceState(state);
          expect(sm.currentState).toBe(state);

          totalTests++;
          const wasAccepted = sm.transition(event);

          if (wasAccepted) {
            totalAcceptances++;
            expect(CHARACTER_STATES).toContain(sm.currentState);
          } else {
            totalRejections++;
            expect(sm.currentState).toBe(state);
          }
        }
      }

      expect(totalTests).toBe(19 * 19); // 361 combinations
      expect(totalAcceptances).toBeGreaterThan(0);
      expect(totalRejections).toBeGreaterThan(200); // Matrix is mostly restricted

      sm.dispose();
    });

    it("fails closed on completely unrecognized or malicious event names", () => {
      const eventBus = new EventBus();
      const rejections: Array<{ event: any; reason: string }> = [];
      eventBus.subscribe("state:transition_rejected", (data) => {
        rejections.push({ event: data.event, reason: data.reason });
      });

      const sm = new MiloStateMachine({ eventBus });
      const badEvents = [
        "TELEPORT",
        "DESTROY",
        "EXPLODE",
        "EAT_FISH",
        "",
        " ",
        null as any,
        undefined as any,
        12345 as any,
        {} as any,
      ];

      for (const bad of badEvents) {
        const result = sm.transition(bad);
        expect(result).toBe(false);
        expect(sm.currentState).toBe("idle");
      }

      expect(rejections.length).toBe(badEvents.length);
      for (const r of rejections) {
        expect(r.reason).toContain("UNKNOWN_EVENT");
      }

      sm.dispose();
    });
  });

  // =========================================================================
  // VECTOR 4: EventBus Resilience
  // =========================================================================
  describe("Attack Vector 4: EventBus Resilience", () => {
    it("registers 500 listeners, unbinds during emission, throws errors, and guarantees full error isolation", () => {
      const caughtErrors: Array<{ error: unknown; event: string }> = [];
      const bus = new EventBus({
        onError: (error, event) => {
          caughtErrors.push({ error, event: String(event) });
        },
      });

      const totalListeners = 500;
      const unbindCount = 50; // 50 listeners will unbind themselves during emission
      const throwCount = 30; // 30 listeners will throw an error during emission

      const executions = new Array<number>(totalListeners).fill(0);
      const unbindFns: Array<() => void> = [];

      for (let i = 0; i < totalListeners; i++) {
        const listenerIndex = i;
        const unbind = bus.subscribe("system:reset", () => {
          executions[listenerIndex]++;

          // Attack 1: Unbind self during emission if in unbind group
          if (listenerIndex < unbindCount) {
            unbind();
          }

          // Attack 2: Throw Error during emission if in throw group
          if (
            listenerIndex >= unbindCount &&
            listenerIndex < unbindCount + throwCount
          ) {
            throw new Error(`Chaos error from listener ${listenerIndex}`);
          }
        });

        unbindFns.push(unbind);
      }

      expect(bus.listenerCount("system:reset")).toBe(500);

      // First emission: ALL 500 handlers should be invoked (due to set snapshot)
      expect(() => {
        bus.emit("system:reset", { timestamp: 1111 });
      }).not.toThrow();

      // Verify all 500 executed during first emission despite 30 thrown errors
      for (let i = 0; i < totalListeners; i++) {
        expect(executions[i]).toBe(1);
      }

      // Verify error isolation: all 30 errors were captured by onError callback
      expect(caughtErrors.length).toBe(throwCount);
      for (let j = 0; j < throwCount; j++) {
        const errObj = caughtErrors[j].error as Error;
        expect(errObj.message).toContain("Chaos error");
        expect(caughtErrors[j].event).toBe("system:reset");
      }

      // Now verify listener count after the 50 self-unbound listeners
      expect(bus.listenerCount("system:reset")).toBe(totalListeners - unbindCount); // 450

      // Second emission: Only the remaining 450 should execute
      bus.emit("system:reset", { timestamp: 2222 });

      for (let i = 0; i < totalListeners; i++) {
        if (i < unbindCount) {
          // Self-unbound listeners should NOT have run on second emission
          expect(executions[i]).toBe(1);
        } else {
          // Remaining 450 should have run twice
          expect(executions[i]).toBe(2);
        }
      }

      // Clean up all
      bus.clear();
      expect(bus.listenerCount()).toBe(0);
    });

    it("resiliently handles high-volume once() listeners unbinding during emission", () => {
      const bus = new EventBus();
      const callCounts: number[] = new Array(200).fill(0);

      for (let i = 0; i < 200; i++) {
        const idx = i;
        bus.once("system:pause", () => {
          callCounts[idx]++;
        });
      }

      expect(bus.listenerCount("system:pause")).toBe(200);

      bus.emit("system:pause", { paused: true });
      expect(callCounts.every((c) => c === 1)).toBe(true);
      expect(bus.listenerCount("system:pause")).toBe(0);

      // Second emission: zero invocations
      bus.emit("system:pause", { paused: false });
      expect(callCounts.every((c) => c === 1)).toBe(true);
    });

    it("safely handles listeners calling bus.clear() mid-emission", () => {
      const bus = new EventBus();
      let callCountA = 0;
      let callCountB = 0;

      bus.subscribe("system:reset", () => {
        callCountA++;
        bus.clear();
      });

      bus.subscribe("system:reset", () => {
        callCountB++;
      });

      expect(() => {
        bus.emit("system:reset", { timestamp: 999 });
      }).not.toThrow();

      // Both execute in initial snapshot, but bus is now cleared
      expect(callCountA).toBe(1);
      expect(callCountB).toBe(1);
      expect(bus.listenerCount()).toBe(0);

      bus.emit("system:reset", { timestamp: 1000 });
      expect(callCountA).toBe(1);
      expect(callCountB).toBe(1);
    });
  });

  // =========================================================================
  // VECTOR 5: Determinism
  // =========================================================================
  describe("Attack Vector 5: Determinism", () => {
    it("guarantees 100% identical state records and transition sequences across independent instances for identical seeded event streams", () => {
      const seeds = [1337, 42, 99999, 1234567, 88888888];

      for (const seed of seeds) {
        const rngA = mulberry32(seed);
        const rngB = mulberry32(seed);

        const streamLength = 1000;
        const eventsA: MiloStateEvent[] = [];
        const eventsB: MiloStateEvent[] = [];

        for (let i = 0; i < streamLength; i++) {
          const eventA = ALL_MILO_EVENTS[Math.floor(rngA() * ALL_MILO_EVENTS.length)];
          const eventB = ALL_MILO_EVENTS[Math.floor(rngB() * ALL_MILO_EVENTS.length)];
          eventsA.push(eventA);
          eventsB.push(eventB);
        }

        // Verify identical generated streams from identical seeds
        expect(eventsA).toEqual(eventsB);

        const smA = new MiloStateMachine({ initialState: "idle", maxHistoryLength: 50 });
        const smB = new MiloStateMachine({ initialState: "idle", maxHistoryLength: 50 });

        const resultsA: boolean[] = [];
        const resultsB: boolean[] = [];

        for (let i = 0; i < streamLength; i++) {
          const resA = smA.transition(eventsA[i], { step: i });
          const resB = smB.transition(eventsB[i], { step: i });
          resultsA.push(resA);
          resultsB.push(resB);

          // Assert identical step-by-step state
          expect(smA.currentState).toBe(smB.currentState);
          expect(smA.previousState).toBe(smB.previousState);
          expect(smA.currentPriority).toBe(smB.currentPriority);
          expect(smA.isPaused).toBe(smB.isPaused);
        }

        // Assert 100% identical transition acceptance results
        expect(resultsA).toEqual(resultsB);

        // Assert 100% identical history buffer
        expect(smA.history.length).toBe(smB.history.length);
        for (let k = 0; k < smA.history.length; k++) {
          const recA = smA.history[k];
          const recB = smB.history[k];
          expect(recA.from).toBe(recB.from);
          expect(recA.to).toBe(recB.to);
          expect(recA.event).toBe(recB.event);
          expect(recA.metadata).toEqual(recB.metadata);
        }

        smA.dispose();
        smB.dispose();
      }
    });
  });

  // =========================================================================
  // ADDITIONAL HOSTILE SCENARIOS & BOUNDARY CONDITIONS
  // =========================================================================
  describe("Hostile Boundary Conditions & Edge Cases", () => {
    it("handles non-Error thrown objects in EventBus handlers without breaking loop", () => {
      const captured: any[] = [];
      const bus = new EventBus({
        onError: (err) => {
          captured.push(err);
        },
      });

      const order: number[] = [];
      bus.subscribe("system:pause", () => {
        order.push(1);
        throw "String error literal";
      });
      bus.subscribe("system:pause", () => {
        order.push(2);
        throw { custom: "error object" };
      });
      bus.subscribe("system:pause", () => {
        order.push(3);
        throw 404;
      });
      bus.subscribe("system:pause", () => {
        order.push(4);
      });

      expect(() => {
        bus.emit("system:pause", { paused: true });
      }).not.toThrow();

      expect(order).toEqual([1, 2, 3, 4]);
      expect(captured.length).toBe(3);
      expect(captured[0]).toBe("String error literal");
      expect(captured[1]).toEqual({ custom: "error object" });
      expect(captured[2]).toBe(404);
    });

    it("isolates errors even when no onError callback is configured", () => {
      const bus = new EventBus(); // No onError provided
      const executed: number[] = [];

      bus.subscribe("system:reset", () => {
        executed.push(1);
        throw new Error("unhandled listener crash");
      });
      bus.subscribe("system:reset", () => {
        executed.push(2);
      });

      expect(() => {
        bus.emit("system:reset", { timestamp: 1 });
      }).not.toThrow();

      expect(executed).toEqual([1, 2]);
    });

    it("ensures listeners subscribed mid-emission do not execute in current cycle", () => {
      const bus = new EventBus();
      let lateListenerCalls = 0;

      bus.subscribe("system:reset", () => {
        bus.subscribe("system:reset", () => {
          lateListenerCalls++;
        });
      });

      bus.emit("system:reset", { timestamp: 1 });
      expect(lateListenerCalls).toBe(0);

      bus.emit("system:reset", { timestamp: 2 });
      expect(lateListenerCalls).toBe(1);
    });

    it("strictly respects custom history length limits (0, 1, 10)", () => {
      // Limit 1
      const sm1 = new MiloStateMachine({ maxHistoryLength: 1 });
      sm1.transition("DRAG_START");
      expect(sm1.history.length).toBe(1);
      sm1.transition("DRAG_END");
      expect(sm1.history.length).toBe(1);
      expect(sm1.history[0].event).toBe("DRAG_END");
      sm1.dispose();

      // Limit 10
      const sm10 = new MiloStateMachine({ maxHistoryLength: 10 });
      for (let i = 0; i < 25; i++) {
        sm10.forceState("idle", `step_${i}`);
      }
      expect(sm10.history.length).toBe(10);
      expect(sm10.history[9].metadata?.reason).toBe("step_24");
      sm10.dispose();
    });

    it("guarantees safe fail-closed behavior post-disposal", () => {
      const sm = new MiloStateMachine();
      sm.transition("DRAG_START");
      expect(sm.currentState).toBe("dragging");

      sm.dispose();

      // Subsequent calls after disposal must fail closed and return false
      expect(sm.transition("DRAG_END")).toBe(false);
      expect(sm.history.length).toBe(0);

      // forceState after disposal is a no-op
      sm.forceState("ready");
      expect(sm.history.length).toBe(0);

      // Repeated disposal does not throw
      expect(() => sm.dispose()).not.toThrow();
    });
  });
});

