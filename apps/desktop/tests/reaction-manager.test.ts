import { describe, it, expect, vi, beforeEach } from "vitest";
import { ReactionManager } from "../src/main/milo-core/reaction-manager";
import { MiloStateMachine, EventBus, AnimationManager } from "../src/main/milo-core";

describe("ReactionManager", () => {
  let stateMachine: MiloStateMachine;
  let animationManager: AnimationManager;
  let reactionManager: ReactionManager;
  let eventBus: EventBus;

  beforeEach(() => {
    vi.useFakeTimers();
    eventBus = new EventBus();
    stateMachine = new MiloStateMachine({ eventBus });
    animationManager = new AnimationManager(stateMachine);
    reactionManager = new ReactionManager(stateMachine, animationManager);
  });

  it("should trigger a reaction explicitly", () => {
    reactionManager.trigger("happy");
    expect(stateMachine.currentState).toBe("happy");
  });

  it("should trigger annoyed reaction if dragged too much", () => {
    // 1st drag
    eventBus.subscribe = vi.fn();
    // Simulate event bus directly
    stateMachine.transition("DRAG_START");
    stateMachine.transition("DRAG_END");
    
    stateMachine.transition("DRAG_START");
    stateMachine.transition("DRAG_END");
    
    stateMachine.transition("DRAG_START");
    
    // 3 drags should trigger annoyed
    expect(stateMachine.currentState).toBe("annoyed");
  });

  it("should trigger happy reaction when waking from sleep", () => {
    stateMachine.forceState("waking", "test");
    stateMachine.transition("TIMER_EXPIRED");
    // eventBus emits state:changed, reaction manager catches it and triggers happy
    expect(stateMachine.currentState).toBe("happy");
  });
});
