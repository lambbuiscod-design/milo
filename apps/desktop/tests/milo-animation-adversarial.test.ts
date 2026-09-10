import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MiloStateMachine } from "../src/main/milo-core/state-machine";
import { AnimationManager } from "../src/main/milo-core/animation-manager";
import { EventBus } from "../src/main/milo-core/event-bus";
import {
  STATE_PRIORITIES,
  STATE_DURATIONS,
  type CharacterState,
} from "../src/main/milo-core/types";

describe("AnimationManager Adversarial Challenge Test Suite", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // =========================================================================
  // VECTOR 1: Multi-Level Preemption Ladder
  // =========================================================================
  describe("Attack Vector 1: Multi-Level Preemption Ladder", () => {
    it("rapidly preempts through the full 8-step ascending priority ladder", () => {
      const eventBus = new EventBus();
      const interruptedLog: Array<{ from: string; to: string }> = [];
      const startedLog: string[] = [];

      eventBus.subscribe("animation:interrupted", ({ interrupted, by }) => {
        interruptedLog.push({ from: interrupted.id, to: by.id });
      });
      eventBus.subscribe("animation:started", (active) => {
        startedLog.push(active.id);
      });

      const sm = new MiloStateMachine({ initialState: "idle", eventBus });
      const am = new AnimationManager(sm, eventBus);

      // Ladder: idle (0) -> looking (20) -> curious (30) -> alert (40) -> pet (60) -> level_up (80) -> drop (90) -> dragging (100)
      const ladderSteps: Array<{ state: CharacterState; priority: number; id: string; durationMs: number }> = [
        { state: "idle", priority: 0, id: "anim-idle-0", durationMs: 0 },
        { state: "looking", priority: 20, id: "anim-looking-20", durationMs: 4000 },
        { state: "curious", priority: 30, id: "anim-curious-30", durationMs: 3000 },
        { state: "alert", priority: 40, id: "anim-alert-40", durationMs: 12000 },
        { state: "pet", priority: 60, id: "anim-pet-60", durationMs: 2000 },
        { state: "level_up", priority: 80, id: "anim-level_up-80", durationMs: 3500 },
        { state: "drop", priority: 90, id: "anim-drop-90", durationMs: 700 },
        { state: "dragging", priority: 100, id: "anim-dragging-100", durationMs: 0 },
      ];

      for (let i = 0; i < ladderSteps.length; i++) {
        const step = ladderSteps[i];
        const res = am.requestAnimation({
          id: step.id,
          state: step.state,
          priority: step.priority,
          durationMs: step.durationMs,
        });

        expect(res.accepted).toBe(true);
        if (i === 0) {
          expect(res.status).toBe("started");
        } else {
          expect(res.status).toBe("interrupted_previous");
          if (res.status === "interrupted_previous") {
            expect(res.interrupted.id).toBe(ladderSteps[i - 1].id);
            expect(res.active.id).toBe(step.id);
          }
        }

        expect(am.currentPriority).toBe(step.priority);
        expect(sm.currentState).toBe(step.state);
        expect(am.currentAnimation?.id).toBe(step.id);
      }

      // Check interrupted chain
      expect(interruptedLog).toHaveLength(7);
      expect(startedLog).toHaveLength(8);
      for (let i = 0; i < 7; i++) {
        expect(interruptedLog[i]).toEqual({
          from: ladderSteps[i].id,
          to: ladderSteps[i + 1].id,
        });
      }

      am.dispose();
      sm.dispose();
    });

    it("cancels completion timers of interrupted animations so they never fire phantom events", () => {
      const eventBus = new EventBus();
      const completedEvents: string[] = [];
      eventBus.subscribe("animation:completed", ({ id }) => {
        completedEvents.push(id);
      });

      const sm = new MiloStateMachine({ initialState: "idle", eventBus });
      const am = new AnimationManager(sm, eventBus);

      // Start pet (duration 2000ms)
      am.requestAnimation({
        id: "pet-early",
        state: "pet",
        priority: 60,
        durationMs: 2000,
      });

      // At 500ms, interrupted by level_up (duration 3500ms)
      vi.advanceTimersByTime(500);
      am.requestAnimation({
        id: "lvl-later",
        state: "level_up",
        priority: 80,
        durationMs: 3500,
      });

      // Advance past pet's original 2000ms deadline (i.e. +1600ms, total 2100ms)
      vi.advanceTimersByTime(1600);
      expect(completedEvents).toHaveLength(0); // pet-early timer must NOT have fired!
      expect(sm.currentState).toBe("level_up");

      // Advance past level_up deadline (+2000ms)
      vi.advanceTimersByTime(2000);
      expect(completedEvents).toEqual(["lvl-later"]);

      am.dispose();
      sm.dispose();
    });

    it("permits leapfrogging multiple priority tiers directly", () => {
      const sm = new MiloStateMachine({ initialState: "idle" });
      const am = new AnimationManager(sm);

      am.requestAnimation({ id: "look", state: "looking", priority: 20 });
      expect(am.currentPriority).toBe(20);

      // Leapfrog straight from looking (20) to dragging (100)
      const res = am.requestAnimation({ id: "drag", state: "dragging", priority: 100 });
      expect(res.accepted).toBe(true);
      expect(res.status).toBe("interrupted_previous");
      expect(am.currentPriority).toBe(100);
      expect(sm.currentState).toBe("dragging");

      am.dispose();
      sm.dispose();
    });
  });

  // =========================================================================
  // VECTOR 2: Return Stack Unwinding & Stack Dynamics
  // =========================================================================
  describe("Attack Vector 2: Return Stack Unwinding", () => {
    it("empirically tests return stack unwinding behavior across the multi-level preemption ladder", () => {
      const sm = new MiloStateMachine({ initialState: "idle" });
      const am = new AnimationManager(sm);

      // Ladder: looking (20) -> curious (30) -> alert (40) -> pet (60) -> level_up (80) -> drop (90) -> dragging (100)
      const ladder = [
        { state: "looking" as CharacterState, priority: 20, id: "look" },
        { state: "curious" as CharacterState, priority: 30, id: "curious" },
        { state: "alert" as CharacterState, priority: 40, id: "alert" },
        { state: "pet" as CharacterState, priority: 60, id: "pet" },
        { state: "level_up" as CharacterState, priority: 80, id: "lvl" },
        { state: "drop" as CharacterState, priority: 90, id: "drop" },
        { state: "dragging" as CharacterState, priority: 100, id: "drag" },
      ];

      for (const item of ladder) {
        am.requestAnimation({
          id: item.id,
          state: item.state,
          priority: item.priority,
        });
      }

      // 6 interruptions took place; check return stack depth
      expect(am.returnStackLength).toBe(6);
      expect(am.currentAnimation?.id).toBe("drag");

      // Complete active animation (drag)
      am.completeAnimation("drag");

      // Observation: am.currentAnimation becomes null
      expect(am.currentAnimation).toBeNull();

      // EMPIRICAL CHECK: What is returnStackLength now?
      // Notice: completeAnimation drains returnStack to root baseline (Architecture A).
      // returnStack length is strictly 0 after drain.
      const remainingStack = am.returnStackLength;
      expect(remainingStack).toBe(0);

      // Attempting to complete the previous animations in reverse order:
      am.completeAnimation("drop");
      am.completeAnimation("lvl");
      am.completeAnimation("pet");
      am.completeAnimation("alert");
      am.completeAnimation("curious");
      am.completeAnimation("look");

      // Because currentAnimation is null, subsequent completeAnimation calls no-op!
      expect(am.returnStackLength).toBe(0);

      am.dispose();
      sm.dispose();
    });

    it("verifies single-level interruption cleanly unwinds return stack to baseline", () => {
      const sm = new MiloStateMachine({ initialState: "idle" });
      const am = new AnimationManager(sm);

      // Pet (60) started
      am.requestAnimation({
        id: "pet-1",
        state: "pet",
        priority: 60,
        returnState: "idle",
      });
      expect(am.returnStackLength).toBe(0);

      // Level up (80) interrupts pet
      am.requestAnimation({
        id: "lvl-1",
        state: "level_up",
        priority: 80,
        returnState: "celebrating",
      });
      expect(am.returnStackLength).toBe(1);

      // Level up completes -> restores return state
      am.completeAnimation("lvl-1");

      // Return stack should now be cleanly unwound to 0!
      expect(am.returnStackLength).toBe(0);
      expect(sm.currentState).toBe("idle");

      am.dispose();
      sm.dispose();
    });

    it("measures return stack accumulation across 50 repeated preemption-completion cycles", () => {
      const sm = new MiloStateMachine({ initialState: "idle" });
      const am = new AnimationManager(sm);

      const stackDepths: number[] = [];

      for (let i = 0; i < 50; i++) {
        // Cycle: start A (20), interrupt with B (60), interrupt with C (100)
        am.requestAnimation({ id: `a-${i}`, state: "looking", priority: 20 });
        am.requestAnimation({ id: `b-${i}`, state: "pet", priority: 60 });
        am.requestAnimation({ id: `c-${i}`, state: "dragging", priority: 100 });

        // Complete C
        am.completeAnimation(`c-${i}`);
        stackDepths.push(am.returnStackLength);
      }

      // Check whether return stack depth accumulates across cycles
      const firstCycleDepth = stackDepths[0];
      const lastCycleDepth = stackDepths[stackDepths.length - 1];

      // With Architecture A, return stack drains to 0 upon completion of each cycle
      expect(firstCycleDepth).toBe(0);
      expect(lastCycleDepth).toBe(0);

      am.dispose();
      sm.dispose();
    });
  });

  // =========================================================================
  // VECTOR 3: Priority Queue Ordering & Priority Inversion
  // =========================================================================
  describe("Attack Vector 3: Priority Queue Ordering", () => {
    it("dequeues queued animations in strict descending priority order", () => {
      const executionOrder: string[] = [];
      const eventBus = new EventBus();
      eventBus.subscribe("animation:started", (anim) => {
        executionOrder.push(anim.id);
      });

      const sm = new MiloStateMachine({ initialState: "idle", eventBus });
      const am = new AnimationManager(sm, eventBus);

      // Active dragging (100)
      am.requestAnimation({ id: "active-drag", state: "dragging", priority: 100 });

      // Enqueue lower priority requests in jumbled order: 20, 60, 40, 80, 30, 90, 75
      const queuedRequests = [
        { id: "q-looking", state: "looking" as CharacterState, priority: 20 },
        { id: "q-pet", state: "pet" as CharacterState, priority: 60 },
        { id: "q-alert", state: "alert" as CharacterState, priority: 40 },
        { id: "q-lvl", state: "level_up" as CharacterState, priority: 80 },
        { id: "q-curious", state: "curious" as CharacterState, priority: 30 },
        { id: "q-drop", state: "drop" as CharacterState, priority: 90 },
        { id: "q-celebrating", state: "celebrating" as CharacterState, priority: 75 },
      ];

      for (const req of queuedRequests) {
        const res = am.requestAnimation({
          ...req,
          queueIfLower: true,
        });
        expect(res.accepted).toBe(true);
        expect(res.status).toBe("queued");
      }

      expect(am.queueLength).toBe(7);

      // Complete active animation
      am.completeAnimation("active-drag");

      // Expected dequeue sequence: 90 -> 80 -> 75 -> 60 -> 40 -> 30 -> 20
      const expectedSequence = [
        "q-drop",        // 90
        "q-lvl",         // 80
        "q-celebrating", // 75
        "q-pet",         // 60
        "q-alert",       // 40
        "q-curious",     // 30
        "q-looking",     // 20
      ];

      for (const expectedId of expectedSequence) {
        expect(am.currentAnimation?.id).toBe(expectedId);
        am.completeAnimation(expectedId);
      }

      expect(am.queueLength).toBe(0);
      expect(executionOrder).toEqual(["active-drag", ...expectedSequence]);

      am.dispose();
      sm.dispose();
    });

    it("verifies empirical priority inversion when an equal-priority request is queued after a lower-priority request", () => {
      const eventBus = new EventBus();
      const executionOrder: string[] = [];
      eventBus.subscribe("animation:started", (anim) => {
        executionOrder.push(anim.id);
      });

      const sm = new MiloStateMachine({ initialState: "idle", eventBus });
      const am = new AnimationManager(sm, eventBus);

      // Active pet (priority 60)
      am.requestAnimation({ id: "pet-active", state: "pet", priority: 60 });

      // Request 1: alert (priority 40 < 60), queueIfLower: true -> queued and sorted
      am.requestAnimation({ id: "alert-queued", state: "alert", priority: 40, queueIfLower: true });

      // Request 2: pet-second (priority 60 === 60), queueIfLower: true
      // In Case 3 (equal priority), requests are pushed to priorityQueue WITHOUT sort!
      am.requestAnimation({ id: "pet-second", state: "pet", priority: 60, queueIfLower: true });

      // Complete active animation
      am.completeAnimation("pet-active");

      // FIXED BEHAVIOR:
      // pet-second (priority 60) was sorted ahead of alert-queued (priority 40).
      // Therefore, pet-second is dequeued first, preventing priority inversion.
      expect(am.currentAnimation?.id).toBe("pet-second");
      expect(am.currentPriority).toBe(60);

      // alert-queued (priority 40) remained waiting in queue
      expect(am.queueLength).toBe(1);

      // Completing pet-second now dispatches alert-queued
      am.completeAnimation("pet-second");
      expect(am.currentAnimation?.id).toBe("alert-queued");
      expect(am.currentPriority).toBe(40);
      expect(am.queueLength).toBe(0);

      am.dispose();
      sm.dispose();
    });

    it("cancels a queued request without disrupting the remaining queue order", () => {
      const sm = new MiloStateMachine({ initialState: "idle" });
      const am = new AnimationManager(sm);

      am.requestAnimation({ id: "active", state: "dragging", priority: 100 });
      am.requestAnimation({ id: "q1", state: "level_up", priority: 80, queueIfLower: true });
      am.requestAnimation({ id: "q2", state: "pet", priority: 60, queueIfLower: true });
      am.requestAnimation({ id: "q3", state: "alert", priority: 40, queueIfLower: true });

      expect(am.queueLength).toBe(3);

      // Cancel middle request (q2)
      am.cancelAnimation("q2");
      expect(am.queueLength).toBe(2);

      // Complete active -> q1 (80) runs
      am.completeAnimation("active");
      expect(am.currentAnimation?.id).toBe("q1");

      // Complete q1 -> q3 (40) runs (q2 was skipped)
      am.completeAnimation("q1");
      expect(am.currentAnimation?.id).toBe("q3");

      am.dispose();
      sm.dispose();
    });
  });

  // =========================================================================
  // VECTOR 4: Duplicate Request Handling & Thrashing
  // =========================================================================
  describe("Attack Vector 4: Duplicate Request Handling", () => {
    it("refreshes the duration of an active animation on duplicate request with same ID", () => {
      const sm = new MiloStateMachine({ initialState: "idle" });
      const am = new AnimationManager(sm);

      // Initial request with 3000ms duration
      const res1 = am.requestAnimation({
        id: "alert-same",
        state: "alert",
        priority: 40,
        durationMs: 3000,
      });
      expect(res1.accepted).toBe(true);
      expect(res1.status).toBe("started");

      // Advance by 2000ms (1000ms remaining on original timer)
      vi.advanceTimersByTime(2000);
      expect(sm.currentState).toBe("alert");

      // Re-trigger with same ID and 5000ms duration
      const res2 = am.requestAnimation({
        id: "alert-same",
        state: "alert",
        priority: 40,
        durationMs: 5000,
      });
      expect(res2.accepted).toBe(true);
      expect(res2.status).toBe("started");

      // Advance by 2000ms (original 3000ms deadline would have expired at +1000ms!)
      vi.advanceTimersByTime(2000);
      expect(sm.currentState).toBe("alert"); // still active!

      // Advance remaining 3000ms (total 5000ms from refresh)
      vi.advanceTimersByTime(3000);
      expect(am.currentAnimation).toBeNull(); // cleanly completed

      am.dispose();
      sm.dispose();
    });

    it("rejects equal priority request with a different ID when queueIfLower is false to prevent thrashing", () => {
      const eventBus = new EventBus();
      const rejectedEvents: unknown[] = [];
      eventBus.subscribe("animation:rejected", (data) => rejectedEvents.push(data));

      const sm = new MiloStateMachine({ initialState: "idle", eventBus });
      const am = new AnimationManager(sm, eventBus);

      // Active alert-1 (40)
      am.requestAnimation({ id: "alert-1", state: "alert", priority: 40 });

      // Incoming alert-2 (40) without queueIfLower
      const res = am.requestAnimation({ id: "alert-2", state: "alert", priority: 40 });

      expect(res.accepted).toBe(false);
      expect(res.status).toBe("rejected");
      if (!res.accepted) {
        expect(res.reason).toContain("equals active priority");
      }

      expect(rejectedEvents).toHaveLength(1);
      expect(am.currentAnimation?.id).toBe("alert-1"); // active animation preserved

      am.dispose();
      sm.dispose();
    });

    it("tests duplicate request flood (100 rapid requests of same ID) for stability", () => {
      const sm = new MiloStateMachine({ initialState: "idle" });
      const am = new AnimationManager(sm);

      for (let i = 0; i < 100; i++) {
        const res = am.requestAnimation({
          id: "rapid-flood",
          state: "alert",
          priority: 40,
          durationMs: 1000,
        });
        expect(res.accepted).toBe(true);
        expect(res.status).toBe("started");
      }

      expect(sm.currentState).toBe("alert");
      expect(am.currentAnimation?.id).toBe("rapid-flood");

      // Timer cleanly expires 1000ms from the last refresh
      vi.advanceTimersByTime(1000);
      expect(am.currentAnimation).toBeNull();

      am.dispose();
      sm.dispose();
    });
  });

  // =========================================================================
  // VECTOR 5: Disposal & Timer Leak Check
  // =========================================================================
  describe("Attack Vector 5: Disposal & Timer Leak Check", () => {
    it("clears pending completion timers and prevents post-disposal execution", () => {
      const eventBus = new EventBus();
      const completedEvents: string[] = [];
      eventBus.subscribe("animation:completed", ({ id }) => completedEvents.push(id));

      const sm = new MiloStateMachine({ initialState: "idle", eventBus });
      const am = new AnimationManager(sm, eventBus);

      am.requestAnimation({
        id: "long-timer",
        state: "alert",
        priority: 40,
        durationMs: 10000,
      });

      // Dispose while timer is ticking (at 3000ms)
      vi.advanceTimersByTime(3000);
      am.dispose();

      // Advance past original 10000ms deadline
      vi.advanceTimersByTime(10000);

      // Completed event must NEVER fire
      expect(completedEvents).toHaveLength(0);
      expect(am.currentAnimation).toBeNull();

      sm.dispose();
    });

    it("flushes priority queue and return stack on disposal", () => {
      const sm = new MiloStateMachine({ initialState: "idle" });
      const am = new AnimationManager(sm);

      am.requestAnimation({ id: "a1", state: "pet", priority: 60 });
      am.requestAnimation({ id: "a2", state: "dragging", priority: 100 }); // pushes to returnStack
      am.requestAnimation({ id: "q1", state: "alert", priority: 40, queueIfLower: true });
      am.requestAnimation({ id: "q2", state: "looking", priority: 20, queueIfLower: true });

      expect(am.returnStackLength).toBe(1);
      expect(am.queueLength).toBe(2);
      expect(am.currentAnimation?.id).toBe("a2");

      am.dispose();

      expect(am.returnStackLength).toBe(0);
      expect(am.queueLength).toBe(0);
      expect(am.currentAnimation).toBeNull();

      sm.dispose();
    });

    it("rejects all subsequent requests with DISPOSED status after disposal", () => {
      const sm = new MiloStateMachine({ initialState: "idle" });
      const am = new AnimationManager(sm);

      am.dispose();

      const res = am.requestAnimation({ id: "post-dispose", state: "pet", priority: 60 });
      expect(res.accepted).toBe(false);
      expect(res.status).toBe("rejected");
      if (!res.accepted) {
        expect(res.reason).toBe("DISPOSED");
      }

      // completeAnimation and cancelAnimation should safely no-op
      expect(() => am.completeAnimation("any")).not.toThrow();
      expect(() => am.cancelAnimation("any")).not.toThrow();

      sm.dispose();
    });
  });
});
