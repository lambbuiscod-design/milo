import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MiloStateMachine } from "../src/main/milo-core/state-machine";
import { AnimationManager } from "../src/main/milo-core/animation-manager";
import { EventBus } from "../src/main/milo-core/event-bus";

describe("AnimationManager (Milestone 2 Requirement R2)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("verifies dragging at priority 100 interrupts idle at priority 0 (Acceptance Criterion)", () => {
    const sm = new MiloStateMachine({ initialState: "idle" });
    const am = new AnimationManager(sm);

    expect(am.currentPriority).toBe(0);
    expect(sm.currentState).toBe("idle");

    const result = am.requestAnimation({
      id: "drag-session-1",
      state: "dragging",
      priority: 100,
    });

    expect(result.accepted).toBe(true);
    expect(result.status).toBe("started");
    expect(am.currentPriority).toBe(100);
    expect(sm.currentState).toBe("dragging");
    expect(sm.isDragging).toBe(true);

    am.dispose();
    sm.dispose();
  });

  it("verifies level_up (80) interrupts pet (60)", () => {
    const eventBus = new EventBus();
    const interruptedHandler = vi.fn();
    eventBus.subscribe("animation:interrupted", interruptedHandler);

    const sm = new MiloStateMachine({ initialState: "idle", eventBus });
    const am = new AnimationManager(sm, eventBus);

    // 1. Start pet animation (priority 60)
    const petRes = am.requestAnimation({
      id: "anim-pet-1",
      state: "pet",
      priority: 60,
      durationMs: 2000,
      returnState: "idle",
    });
    expect(petRes.accepted).toBe(true);
    expect(sm.currentState).toBe("pet");
    expect(am.currentPriority).toBe(60);

    // 2. Level up arrives (priority 80 > 60) -> INTERRUPTS
    const levelUpRes = am.requestAnimation({
      id: "anim-lvl-1",
      state: "level_up",
      priority: 80,
      durationMs: 3500,
      returnState: "celebrating",
    });

    expect(levelUpRes.accepted).toBe(true);
    expect(levelUpRes.status).toBe("interrupted_previous");
    expect(interruptedHandler).toHaveBeenCalledTimes(1);
    expect(interruptedHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        interrupted: expect.objectContaining({ id: "anim-pet-1", state: "pet" }),
        by: expect.objectContaining({ id: "anim-lvl-1", state: "level_up" }),
      }),
    );

    expect(sm.currentState).toBe("level_up");
    expect(am.currentPriority).toBe(80);

    am.dispose();
    sm.dispose();
  });

  it("verifies dragging (100) interrupts level_up (80)", () => {
    const sm = new MiloStateMachine({ initialState: "idle" });
    const am = new AnimationManager(sm);

    am.requestAnimation({
      id: "anim-lvl-1",
      state: "level_up",
      priority: 80,
    });
    expect(sm.currentState).toBe("level_up");

    const dragRes = am.requestAnimation({
      id: "anim-drag-1",
      state: "dragging",
      priority: 100,
    });

    expect(dragRes.accepted).toBe(true);
    expect(dragRes.status).toBe("interrupted_previous");
    expect(sm.currentState).toBe("dragging");
    expect(am.currentPriority).toBe(100);

    am.dispose();
    sm.dispose();
  });

  it("rejects lower priority animation requests when queueIfLower is false", () => {
    const eventBus = new EventBus();
    const rejectedHandler = vi.fn();
    eventBus.subscribe("animation:rejected", rejectedHandler);

    const sm = new MiloStateMachine({ initialState: "idle", eventBus });
    const am = new AnimationManager(sm, eventBus);

    // Active drag (100)
    am.requestAnimation({
      id: "anim-drag-1",
      state: "dragging",
      priority: 100,
    });

    // Incoming alert (40) with queueIfLower: false
    const alertRes = am.requestAnimation({
      id: "anim-alert-1",
      state: "alert",
      priority: 40,
      queueIfLower: false,
    });

    expect(alertRes.accepted).toBe(false);
    expect(alertRes.status).toBe("rejected");
    expect(rejectedHandler).toHaveBeenCalledTimes(1);
    expect(rejectedHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "anim-alert-1",
        reason: "LOWER_PRIORITY",
      }),
    );
    expect(sm.currentState).toBe("dragging");

    am.dispose();
    sm.dispose();
  });

  it("queues lower priority animations and executes in priority order upon completion", () => {
    const eventBus = new EventBus();
    const queuedHandler = vi.fn();
    eventBus.subscribe("animation:queued", queuedHandler);

    const sm = new MiloStateMachine({ initialState: "idle", eventBus });
    const am = new AnimationManager(sm, eventBus);

    // Active drag at 100
    am.requestAnimation({
      id: "anim-drag-1",
      state: "dragging",
      priority: 100,
      durationMs: 1000,
    });

    // Queue pet (priority 60)
    const q1 = am.requestAnimation({
      id: "anim-pet-1",
      state: "pet",
      priority: 60,
      durationMs: 500,
      queueIfLower: true,
    });
    expect(q1.accepted).toBe(true);
    expect(q1.status).toBe("queued");
    expect(am.queueLength).toBe(1);

    // Queue level_up (priority 80) -> should sort ahead of pet!
    const q2 = am.requestAnimation({
      id: "anim-lvl-1",
      state: "level_up",
      priority: 80,
      durationMs: 800,
      queueIfLower: true,
    });
    expect(q2.accepted).toBe(true);
    expect(q2.status).toBe("queued");
    expect(am.queueLength).toBe(2);

    expect(queuedHandler).toHaveBeenCalledTimes(2);

    // Complete dragging -> level_up (80) should start first!
    am.completeAnimation("anim-drag-1");
    expect(sm.currentState).toBe("level_up");
    expect(am.currentPriority).toBe(80);
    expect(am.queueLength).toBe(1);

    // Complete level_up -> pet (60) should start next!
    am.completeAnimation("anim-lvl-1");
    expect(sm.currentState).toBe("pet");
    expect(am.currentPriority).toBe(60);
    expect(am.queueLength).toBe(0);

    // Complete pet -> returns to baseline idle
    am.completeAnimation("anim-pet-1");
    expect(sm.currentState).toBe("idle");
    expect(am.currentPriority).toBe(0);

    am.dispose();
    sm.dispose();
  });

  it("handles return-state stack resolution when interrupted animation completes", () => {
    const sm = new MiloStateMachine({ initialState: "sleeping" });
    const am = new AnimationManager(sm);

    // Dragging (100) interrupts sleeping (10)
    am.requestAnimation({
      id: "anim-drag-1",
      state: "dragging",
      priority: 100,
      returnState: "sleeping",
    });
    expect(sm.currentState).toBe("dragging");

    // Drag completes -> restores return state (sleeping)
    am.completeAnimation("anim-drag-1");
    expect(sm.currentState).toBe("sleeping");

    am.dispose();
    sm.dispose();
  });

  it("handles equal priority re-triggering and collisions", () => {
    const sm = new MiloStateMachine({ initialState: "idle" });
    const am = new AnimationManager(sm);

    // Start alert at 40
    am.requestAnimation({
      id: "alert-1",
      state: "alert",
      priority: 40,
      durationMs: 3000,
    });

    // Re-triggering same ID refreshes timer
    const retrigger = am.requestAnimation({
      id: "alert-1",
      state: "alert",
      priority: 40,
      durationMs: 5000,
    });
    expect(retrigger.accepted).toBe(true);
    expect(retrigger.status).toBe("started");

    // Different ID at same priority rejected without queue flag
    const collision = am.requestAnimation({
      id: "alert-2",
      state: "alert",
      priority: 40,
    });
    expect(collision.accepted).toBe(false);
    expect(collision.status).toBe("rejected");

    am.dispose();
    sm.dispose();
  });

  it("generates an accurate immutable snapshot via getCharacterSnapshot()", () => {
    const sm = new MiloStateMachine({ initialState: "idle" });
    const am = new AnimationManager(sm);

    const initialSnap = am.getCharacterSnapshot();
    expect(initialSnap.currentState).toBe("idle");
    expect(initialSnap.currentPriority).toBe(0);
    expect(initialSnap.activeAnimation).toBeNull();

    am.requestAnimation({
      id: "anim-drag-test",
      state: "dragging",
      priority: 100,
      durationMs: 5000,
    });

    const activeSnap = am.getCharacterSnapshot();
    expect(activeSnap.currentState).toBe("dragging");
    expect(activeSnap.currentPriority).toBe(100);
    expect(activeSnap.activeAnimation).toEqual(
      expect.objectContaining({
        name: "anim-drag-test",
        state: "dragging",
        priority: 100,
        interruptible: true,
        duration: 5000,
      }),
    );

    am.dispose();
    sm.dispose();
  });

  it("prevents non-interruptible animation from being preempted by higher priority request", () => {
    const eventBus = new EventBus();
    const rejectedHandler = vi.fn();
    const interruptedHandler = vi.fn();
    eventBus.subscribe("animation:rejected", rejectedHandler);
    eventBus.subscribe("animation:interrupted", interruptedHandler);

    const sm = new MiloStateMachine({ initialState: "idle", eventBus });
    const am = new AnimationManager(sm, eventBus);

    // 1. Start pet with interruptible: false
    const petRes = am.requestAnimation({
      id: "pet-locked",
      state: "pet",
      priority: 60,
      durationMs: 3000,
      interruptible: false,
    });
    expect(petRes.accepted).toBe(true);
    expect(petRes.status).toBe("started");

    // 2. High priority dragging (100) arrives without queueIfLower
    const dragRes = am.requestAnimation({
      id: "drag-attempt",
      state: "dragging",
      priority: 100,
    });

    expect(dragRes.accepted).toBe(false);
    expect(dragRes.status).toBe("rejected");
    if (!dragRes.accepted) {
      expect(dragRes.reason).toContain("non-interruptible");
    }
    expect(rejectedHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "drag-attempt",
        reason: "NON_INTERRUPTIBLE",
      }),
    );
    expect(interruptedHandler).not.toHaveBeenCalled();
    expect(sm.currentState).toBe("pet");
    expect(am.currentAnimation?.id).toBe("pet-locked");

    am.dispose();
    sm.dispose();
  });

  it("queues higher priority request when active animation is non-interruptible and queueIfLower is true", () => {
    const sm = new MiloStateMachine({ initialState: "idle" });
    const am = new AnimationManager(sm);

    // 1. Drop state (90) with interruptible: false
    am.requestAnimation({
      id: "drop-locked",
      state: "drop",
      priority: 90,
      durationMs: 700,
      interruptible: false,
    });

    // 2. Dragging (100) with queueIfLower: true
    const dragRes = am.requestAnimation({
      id: "drag-queued",
      state: "dragging",
      priority: 100,
      queueIfLower: true,
    });

    expect(dragRes.accepted).toBe(true);
    expect(dragRes.status).toBe("queued");
    if (dragRes.status === "queued") {
      expect(dragRes.position).toBe(1);
    }
    expect(am.queueLength).toBe(1);
    expect(am.currentAnimation?.id).toBe("drop-locked");

    // 3. Complete non-interruptible animation -> queued higher priority runs next!
    am.completeAnimation("drop-locked");
    expect(sm.currentState).toBe("dragging");
    expect(am.currentAnimation?.id).toBe("drag-queued");
    expect(am.currentPriority).toBe(100);

    am.dispose();
    sm.dispose();
  });

  it("refreshes queued request duration and parameters without duplicating queue entries", () => {
    const sm = new MiloStateMachine({ initialState: "idle" });
    const am = new AnimationManager(sm);

    am.requestAnimation({ id: "active-drag", state: "dragging", priority: 100, durationMs: 5000 });

    // Initial queued request
    const q1 = am.requestAnimation({
      id: "dup-queued",
      state: "pet",
      priority: 60,
      durationMs: 2000,
      queueIfLower: true,
    });
    expect(q1.accepted).toBe(true);
    expect(am.queueLength).toBe(1);

    // Re-queued duplicate request with updated duration
    const q2 = am.requestAnimation({
      id: "dup-queued",
      state: "pet",
      priority: 60,
      durationMs: 4000,
      queueIfLower: true,
    });
    expect(q2.accepted).toBe(true);
    expect(am.queueLength).toBe(1); // Queue length must NOT grow

    // On completion, dup-queued runs with updated duration
    am.completeAnimation("active-drag");
    expect(am.currentAnimation?.id).toBe("dup-queued");
    expect(am.currentAnimation?.durationMs).toBe(4000);

    am.dispose();
    sm.dispose();
  });

  it("re-sorts queued request position when duplicate request changes priority", () => {
    const sm = new MiloStateMachine({ initialState: "idle" });
    const am = new AnimationManager(sm);

    am.requestAnimation({ id: "active", state: "dragging", priority: 100 });
    am.requestAnimation({ id: "item-pet", state: "pet", priority: 60, queueIfLower: true });
    am.requestAnimation({ id: "item-alert", state: "alert", priority: 40, queueIfLower: true });
    expect(am.queueLength).toBe(2);

    // Update item-alert to priority 80
    const updated = am.requestAnimation({
      id: "item-alert",
      state: "level_up",
      priority: 80,
      queueIfLower: true,
    });
    expect(updated.accepted).toBe(true);
    if (updated.status === "queued") {
      expect(updated.position).toBe(1); // Promoted ahead of pet
    }
    expect(am.queueLength).toBe(2);

    am.completeAnimation("active");
    expect(am.currentAnimation?.id).toBe("item-alert");

    am.dispose();
    sm.dispose();
  });

  it("prevents priority inversion when an equal-priority request is queued after a lower-priority request", () => {
    const sm = new MiloStateMachine({ initialState: "idle" });
    const am = new AnimationManager(sm);

    // Active pet (priority 60)
    am.requestAnimation({ id: "active-pet", state: "pet", priority: 60 });

    // Queue alert (priority 40 < 60)
    const q1 = am.requestAnimation({ id: "q-alert", state: "alert", priority: 40, queueIfLower: true });
    expect(q1.accepted).toBe(true);
    expect(q1.status).toBe("queued");
    if (q1.status === "queued") {
      expect(q1.position).toBe(1);
    }

    // Queue second pet (priority 60 === 60) -> must sort ahead of q-alert to position 1
    const q2 = am.requestAnimation({ id: "q-pet-2", state: "pet", priority: 60, queueIfLower: true });
    expect(q2.accepted).toBe(true);
    expect(q2.status).toBe("queued");
    if (q2.status === "queued") {
      expect(q2.position).toBe(1);
    }

    // Complete active pet -> q-pet-2 (60) runs first
    am.completeAnimation("active-pet");
    expect(am.currentAnimation?.id).toBe("q-pet-2");
    expect(am.currentPriority).toBe(60);

    // Complete q-pet-2 -> q-alert (40) runs next
    am.completeAnimation("q-pet-2");
    expect(am.currentAnimation?.id).toBe("q-alert");
    expect(am.currentPriority).toBe(40);

    am.dispose();
    sm.dispose();
  });
});
