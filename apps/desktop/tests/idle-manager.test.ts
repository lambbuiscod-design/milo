import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { IdleManager, IDLE_BEHAVIORS } from "../src/main/idle-manager";
import { MiloStateMachine, EventBus, AnimationManager } from "../src/main/milo-core";

describe("IdleManager", () => {
  let stateMachine: MiloStateMachine;
  let animationManager: AnimationManager;
  let idleManager: IdleManager;

  beforeEach(() => {
    vi.useFakeTimers();
    const eventBus = new EventBus();
    stateMachine = new MiloStateMachine({ eventBus });
    animationManager = new AnimationManager(stateMachine);
    idleManager = new IdleManager(stateMachine, animationManager);
  });

  afterEach(() => {
    idleManager.stop();
    vi.useRealTimers();
  });

  it("should initialize with current time", () => {
    expect(idleManager.currentIdleDuration).toBe(0);
  });

  it("should increment idle duration", () => {
    vi.advanceTimersByTime(5000);
    expect(idleManager.currentIdleDuration).toBe(5000);
  });

  it("should reset idle duration on touch", () => {
    vi.advanceTimersByTime(5000);
    idleManager.touch();
    expect(idleManager.currentIdleDuration).toBe(0);
  });

  it("should wake from sleep on touch", () => {
    stateMachine.transition("INACTIVITY_TIMEOUT"); // Transition to idle? No, we can just transition.
    stateMachine.forceState("sleeping", "test");
    expect(stateMachine.currentState).toBe("sleeping");
    
    idleManager.touch();
    
    // Animation Manager should request waking
    expect(stateMachine.currentState).toBe("waking");
  });

  it("should execute progressive behaviors over time", () => {
    idleManager.start();
    
    // Fast forward 1 minute (0-2 min phase)
    vi.advanceTimersByTime(60000);
    
    // Should have picked a behavior from the first pool (blink, look_around, normal_idle)
    const b1 = idleManager.lastIdleBehavior;
    expect(["blink", "look_around", "normal_idle"]).toContain(b1);
    
    // Fast forward to 3 minutes (2-5 min phase)
    vi.advanceTimersByTime(120000); // +2 mins
    const b2 = idleManager.lastIdleBehavior;
    expect(["stretch", "clean_paws", "look_around"]).toContain(b2);

    // Fast forward to 16 minutes (15+ min phase)
    vi.advanceTimersByTime(15 * 60000);
    const b3 = idleManager.lastIdleBehavior;
    expect(b3).toBe("sleep");
  });
});
