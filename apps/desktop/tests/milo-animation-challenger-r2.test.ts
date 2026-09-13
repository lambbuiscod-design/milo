import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MiloStateMachine } from "../src/main/milo-core/state-machine";
import { AnimationManager } from "../src/main/milo-core/animation-manager";
import { EventBus } from "../src/main/milo-core/event-bus";
import type { MiloEventMap } from "../src/main/milo-core/event-bus";
import {
  type CharacterState,
} from "../src/main/milo-core/types";

describe("AnimationManager Challenger R2 Comprehensive Test Suite", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // =========================================================================
  // TASK 2: Vector 2 Multi-level preemption return stack unwinding & leak check
  // =========================================================================
  describe("Task 2: Vector 2 Multi-level preemption return stack unwinding & leak check", () => {
    it("confirms #returnStack.length is 0 after draining multi-level preemption ladder", () => {
      const sm = new MiloStateMachine({ initialState: "idle" });
      const am = new AnimationManager(sm);

      // Preemption chain: looking (20) -> curious (30) -> alert (40) -> pet (60) -> level_up (80) -> drop (90) -> dragging (100)
      const chain: Array<{ state: CharacterState; priority: number; id: string }> = [
        { state: "looking", priority: 20, id: "c-look" },
        { state: "curious", priority: 30, id: "c-curious" },
        { state: "alert", priority: 40, id: "c-alert" },
        { state: "pet", priority: 60, id: "c-pet" },
        { state: "level_up", priority: 80, id: "c-lvl" },
        { state: "drop", priority: 90, id: "c-drop" },
        { state: "dragging", priority: 100, id: "c-drag" },
      ];

      for (const item of chain) {
        const res = am.requestAnimation(item);
        expect(res.accepted).toBe(true);
      }

      // During active dragging, 6 previous animations were preempted and pushed to returnStack
      expect(am.returnStackLength).toBe(6);
      expect(sm.currentState).toBe("dragging");

      // Complete dragging -> drains returnStack to root baseline (idle) and clears returnStack to 0
      am.completeAnimation("c-drag");

      expect(am.returnStackLength).toBe(0);
      expect(am.currentAnimation).toBeNull();
      expect(sm.currentState).toBe("idle");

      am.dispose();
      sm.dispose();
    });

    it("verifies return stack does not leak across 50 cycles of 3-level preemption", () => {
      const sm = new MiloStateMachine({ initialState: "idle" });
      const am = new AnimationManager(sm);

      for (let i = 0; i < 50; i++) {
        am.requestAnimation({ id: `cycle-look-${i}`, state: "looking", priority: 20 });
        am.requestAnimation({ id: `cycle-pet-${i}`, state: "pet", priority: 60 });
        am.requestAnimation({ id: `cycle-drag-${i}`, state: "dragging", priority: 100 });

        expect(am.returnStackLength).toBe(2);

        am.completeAnimation(`cycle-drag-${i}`);

        // MUST be 0 after every single cycle drain
        expect(am.returnStackLength).toBe(0);
        expect(am.currentAnimation).toBeNull();
        expect(sm.currentState).toBe("idle");
      }

      expect(am.returnStackLength).toBe(0);

      am.dispose();
      sm.dispose();
    });

    it("stress-tests return stack across 500 cycles of random preemption chains", () => {
      const sm = new MiloStateMachine({ initialState: "idle" });
      const am = new AnimationManager(sm);

      for (let i = 0; i < 500; i++) {
        // Random ladder depth between 2 and 6
        const depth = 2 + (i % 5);
        const priorities = [10, 20, 40, 60, 80, 100].slice(0, depth);
        const states: CharacterState[] = ["sleeping", "looking", "alert", "pet", "level_up", "dragging"];

        for (let d = 0; d < depth; d++) {
          am.requestAnimation({
            id: `stress-${i}-${d}`,
            state: states[d],
            priority: priorities[d],
          });
        }

        expect(am.returnStackLength).toBe(depth - 1);

        // Complete top animation
        am.completeAnimation(`stress-${i}-${depth - 1}`);

        expect(am.returnStackLength).toBe(0);
        expect(am.currentAnimation).toBeNull();
      }

      expect(am.returnStackLength).toBe(0);

      am.dispose();
      sm.dispose();
    });

    it("verifies return stack drain when queue items are executed after preemption", () => {
      const sm = new MiloStateMachine({ initialState: "idle" });
      const am = new AnimationManager(sm);

      // A (20) started
      am.requestAnimation({ id: "anim-A", state: "looking", priority: 20 });
      // B (100) preempts A -> returnStack has 1 entry
      am.requestAnimation({ id: "anim-B", state: "dragging", priority: 100 });
      expect(am.returnStackLength).toBe(1);

      // C (60) queued while B is running
      am.requestAnimation({ id: "anim-C", state: "pet", priority: 60, queueIfLower: true });
      expect(am.queueLength).toBe(1);

      // B completes -> C executes next from queue
      am.completeAnimation("anim-B");
      expect(am.currentAnimation?.id).toBe("anim-C");
      expect(am.queueLength).toBe(0);

      // C completes -> queue empty -> drains return stack to root baseline
      am.completeAnimation("anim-C");
      expect(am.currentAnimation).toBeNull();
      expect(am.returnStackLength).toBe(0);
      expect(sm.currentState).toBe("idle");

      am.dispose();
      sm.dispose();
    });
  });

  // =========================================================================
  // TASK 3: Vector 3 Priority queue ordering & equal-priority handling
  // =========================================================================
  describe("Task 3: Vector 3 Priority queue ordering", () => {
    it("confirms pet-second (priority 60) dequeues before alert-queued (priority 40)", () => {
      const sm = new MiloStateMachine({ initialState: "idle" });
      const am = new AnimationManager(sm);

      // Active pet-1 (priority 60)
      am.requestAnimation({ id: "pet-active", state: "pet", priority: 60 });

      // Request 1: alert (40 < 60), queueIfLower: true
      const qAlert = am.requestAnimation({ id: "alert-queued", state: "alert", priority: 40, queueIfLower: true });
      expect(qAlert.accepted).toBe(true);
      expect(qAlert.status).toBe("queued");

      // Request 2: pet-second (60 === 60), queueIfLower: true
      const qPet = am.requestAnimation({ id: "pet-second", state: "pet", priority: 60, queueIfLower: true });
      expect(qPet.accepted).toBe(true);
      expect(qPet.status).toBe("queued");
      if (qPet.status === "queued") {
        expect(qPet.position).toBe(1); // Position 1: pet-second sorted ahead of alert-queued
      }

      // Complete active pet -> pet-second (60) must run first
      am.completeAnimation("pet-active");
      expect(am.currentAnimation?.id).toBe("pet-second");
      expect(am.currentPriority).toBe(60);
      expect(am.queueLength).toBe(1);

      // Complete pet-second -> alert-queued (40) runs next
      am.completeAnimation("pet-second");
      expect(am.currentAnimation?.id).toBe("alert-queued");
      expect(am.currentPriority).toBe(40);
      expect(am.queueLength).toBe(0);

      // Complete alert-queued -> idle
      am.completeAnimation("alert-queued");
      expect(am.currentAnimation).toBeNull();
      expect(sm.currentState).toBe("idle");

      am.dispose();
      sm.dispose();
    });

    it("verifies stable FIFO ordering among multiple items with identical priority", () => {
      const sm = new MiloStateMachine({ initialState: "idle" });
      const am = new AnimationManager(sm);

      // Active drag (100)
      am.requestAnimation({ id: "active-drag", state: "dragging", priority: 100 });

      // Enqueue items with mixed and identical priorities:
      // P40: alert-1, alert-2, alert-3
      // P60: pet-1, pet-2
      // P80: lvl-1
      am.requestAnimation({ id: "alert-1", state: "alert", priority: 40, queueIfLower: true });
      am.requestAnimation({ id: "pet-1", state: "pet", priority: 60, queueIfLower: true });
      am.requestAnimation({ id: "alert-2", state: "alert", priority: 40, queueIfLower: true });
      am.requestAnimation({ id: "lvl-1", state: "level_up", priority: 80, queueIfLower: true });
      am.requestAnimation({ id: "pet-2", state: "pet", priority: 60, queueIfLower: true });
      am.requestAnimation({ id: "alert-3", state: "alert", priority: 40, queueIfLower: true });

      expect(am.queueLength).toBe(6);

      const expectedOrder = [
        "lvl-1",   // 80
        "pet-1",   // 60 (first)
        "pet-2",   // 60 (second)
        "alert-1", // 40 (first)
        "alert-2", // 40 (second)
        "alert-3", // 40 (third)
      ];

      am.completeAnimation("active-drag");

      for (const expectedId of expectedOrder) {
        expect(am.currentAnimation?.id).toBe(expectedId);
        am.completeAnimation(expectedId);
      }

      expect(am.queueLength).toBe(0);
      expect(am.currentAnimation).toBeNull();

      am.dispose();
      sm.dispose();
    });
  });

  // =========================================================================
  // TASK 4: Non-interruptible preemption protection (interruptible: false)
  // =========================================================================
  describe("Task 4: Non-interruptible preemption protection", () => {
    it("strictly blocks preemption when active animation has interruptible: false", () => {
      const eventBus = new EventBus();
      const rejectedEvents: MiloEventMap["animation:rejected"][] = [];
      const interruptedEvents: MiloEventMap["animation:interrupted"][] = [];
      eventBus.subscribe("animation:rejected", (e) => rejectedEvents.push(e));
      eventBus.subscribe("animation:interrupted", (e) => interruptedEvents.push(e));

      const sm = new MiloStateMachine({ initialState: "idle", eventBus });
      const am = new AnimationManager(sm, eventBus);

      // Start non-interruptible drop animation (priority 90)
      const dropRes = am.requestAnimation({
        id: "drop-locked",
        state: "drop",
        priority: 90,
        interruptible: false,
        durationMs: 700,
      });
      expect(dropRes.accepted).toBe(true);
      expect(dropRes.status).toBe("started");

      // High priority dragging (100) without queueIfLower
      const dragReject = am.requestAnimation({
        id: "drag-attempt",
        state: "dragging",
        priority: 100,
      });

      expect(dragReject.accepted).toBe(false);
      expect(dragReject.status).toBe("rejected");
      if (!dragReject.accepted) {
        expect(dragReject.reason).toContain("non-interruptible");
      }
      expect(rejectedEvents).toHaveLength(1);
      expect(rejectedEvents[0].reason).toBe("NON_INTERRUPTIBLE");
      expect(interruptedEvents).toHaveLength(0);

      // Active animation is still drop-locked
      expect(am.currentAnimation?.id).toBe("drop-locked");
      expect(sm.currentState).toBe("drop");

      am.dispose();
      sm.dispose();
    });

    it("queues higher priority request when active is non-interruptible and queueIfLower is true", () => {
      const sm = new MiloStateMachine({ initialState: "idle" });
      const am = new AnimationManager(sm);

      am.requestAnimation({
        id: "non-int-pet",
        state: "pet",
        priority: 60,
        interruptible: false,
        durationMs: 2000,
      });

      // Higher priority request (dragging 100) with queueIfLower: true
      const dragQueue = am.requestAnimation({
        id: "drag-queued",
        state: "dragging",
        priority: 100,
        queueIfLower: true,
      });

      expect(dragQueue.accepted).toBe(true);
      expect(dragQueue.status).toBe("queued");
      if (dragQueue.status === "queued") {
        expect(dragQueue.position).toBe(1);
      }
      expect(am.queueLength).toBe(1);
      expect(am.currentAnimation?.id).toBe("non-int-pet");

      // Lower priority request (alert 40) with queueIfLower: true
      const alertQueue = am.requestAnimation({
        id: "alert-queued",
        state: "alert",
        priority: 40,
        queueIfLower: true,
      });
      expect(alertQueue.accepted).toBe(true);
      expect(am.queueLength).toBe(2);

      // Complete non-interruptible pet -> dragging (100) executes first!
      am.completeAnimation("non-int-pet");
      expect(am.currentAnimation?.id).toBe("drag-queued");
      expect(am.currentPriority).toBe(100);

      // Complete dragging -> alert (40) executes next
      am.completeAnimation("drag-queued");
      expect(am.currentAnimation?.id).toBe("alert-queued");
      expect(am.currentPriority).toBe(40);

      am.dispose();
      sm.dispose();
    });
  });

  // =========================================================================
  // TASK 5: Queue deduplication
  // =========================================================================
  describe("Task 5: Queue deduplication", () => {
    it("updates existing queued request without creating duplicate queue entries", () => {
      const sm = new MiloStateMachine({ initialState: "idle" });
      const am = new AnimationManager(sm);

      // Active dragging
      am.requestAnimation({ id: "active-drag", state: "dragging", priority: 100 });

      // Queue alert with id "task-item", priority 40, duration 1000
      const q1 = am.requestAnimation({
        id: "task-item",
        state: "alert",
        priority: 40,
        durationMs: 1000,
        queueIfLower: true,
      });
      expect(q1.accepted).toBe(true);
      expect(am.queueLength).toBe(1);

      // Resubmit "task-item" with updated duration 5000
      const q2 = am.requestAnimation({
        id: "task-item",
        state: "alert",
        priority: 40,
        durationMs: 5000,
        queueIfLower: true,
      });
      expect(q2.accepted).toBe(true);
      expect(am.queueLength).toBe(1); // STILL 1! No duplication

      // Complete active -> task-item runs with duration 5000
      am.completeAnimation("active-drag");
      expect(am.currentAnimation?.id).toBe("task-item");
      expect(am.currentAnimation?.durationMs).toBe(5000);

      am.dispose();
      sm.dispose();
    });

    it("re-sorts position when deduplicated queued request changes priority", () => {
      const sm = new MiloStateMachine({ initialState: "idle" });
      const am = new AnimationManager(sm);

      am.requestAnimation({ id: "active-drag", state: "dragging", priority: 100 });

      // Queue item-A (60) and item-B (40)
      am.requestAnimation({ id: "item-A", state: "pet", priority: 60, queueIfLower: true });
      am.requestAnimation({ id: "item-B", state: "alert", priority: 40, queueIfLower: true });
      expect(am.queueLength).toBe(2);

      // Re-queue item-B with promoted priority 80
      const promoted = am.requestAnimation({
        id: "item-B",
        state: "level_up",
        priority: 80,
        queueIfLower: true,
      });
      expect(promoted.accepted).toBe(true);
      if (promoted.status === "queued") {
        expect(promoted.position).toBe(1); // Moved ahead of item-A
      }
      expect(am.queueLength).toBe(2);

      // Re-queue item-B with demoted priority 20
      const demoted = am.requestAnimation({
        id: "item-B",
        state: "looking",
        priority: 20,
        queueIfLower: true,
      });
      expect(demoted.accepted).toBe(true);
      if (demoted.status === "queued") {
        expect(demoted.position).toBe(2); // Moved behind item-A
      }
      expect(am.queueLength).toBe(2);

      // Complete active -> item-A (60) runs first, then item-B (20)
      am.completeAnimation("active-drag");
      expect(am.currentAnimation?.id).toBe("item-A");

      am.completeAnimation("item-A");
      expect(am.currentAnimation?.id).toBe("item-B");

      am.dispose();
      sm.dispose();
    });

    it("cancels a deduplicated queued request cleanly by ID", () => {
      const sm = new MiloStateMachine({ initialState: "idle" });
      const am = new AnimationManager(sm);

      am.requestAnimation({ id: "active", state: "dragging", priority: 100 });
      am.requestAnimation({ id: "q-target", state: "pet", priority: 60, queueIfLower: true });
      // Re-queue same id 3 times
      am.requestAnimation({ id: "q-target", state: "pet", priority: 60, queueIfLower: true });
      am.requestAnimation({ id: "q-target", state: "pet", priority: 60, queueIfLower: true });
      expect(am.queueLength).toBe(1);

      // Cancel it
      am.cancelAnimation("q-target");
      expect(am.queueLength).toBe(0);

      // Complete active -> goes to idle, not q-target
      am.completeAnimation("active");
      expect(am.currentAnimation).toBeNull();
      expect(sm.currentState).toBe("idle");

      am.dispose();
      sm.dispose();
    });
  });
});
