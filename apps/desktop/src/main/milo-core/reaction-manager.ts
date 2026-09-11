import { MiloStateMachine } from "./state-machine";
import { AnimationManager } from "./animation-manager";
import { CharacterState } from "../../shared/contracts";

export type MiloReaction =
  | "love"
  | "laugh"
  | "happy"
  | "confused"
  | "surprised"
  | "annoyed"
  | "proud"
  | "sleepy";

// Map reactions to visual states and duration
const REACTION_CONFIG: Record<MiloReaction, { state: CharacterState; durationMs: number; priority: number }> = {
  love: { state: "affectionate", durationMs: 2500, priority: 70 },
  laugh: { state: "laughing", durationMs: 2500, priority: 70 },
  happy: { state: "happy", durationMs: 2500, priority: 70 },
  confused: { state: "thinking", durationMs: 2000, priority: 70 },
  surprised: { state: "surprised", durationMs: 2000, priority: 70 },
  annoyed: { state: "annoyed", durationMs: 2500, priority: 70 },
  proud: { state: "confident", durationMs: 3000, priority: 70 },
  sleepy: { state: "sleepy", durationMs: 3000, priority: 70 },
};

export class ReactionManager {
  private stateMachine: MiloStateMachine;
  private animationManager: AnimationManager;

  // Track drag events to trigger annoyed reaction
  private dragCount = 0;
  private lastDragReset = Date.now();

  constructor(stateMachine: MiloStateMachine, animationManager: AnimationManager) {
    this.stateMachine = stateMachine;
    this.animationManager = animationManager;

    this.setupListeners();
  }

  private setupListeners(): void {
    // Return after sleep
    this.stateMachine.eventBus.subscribe("state:changed", (event: import("./types").StateTransitionRecord) => {
      if (event.from === "waking" && event.to === "idle") {
        this.trigger("happy");
      }
    });

    // Too much dragging
    this.stateMachine.eventBus.subscribe("state:changed", (event: import("./types").StateTransitionRecord) => {
      if (event.event === "DRAG_START") {
        this.recordDrag();
      }
    });
  }

  private recordDrag(): void {
    const now = Date.now();
    // Reset count if more than 10 seconds since last drag tracking started
    if (now - this.lastDragReset > 10000) {
      this.dragCount = 0;
      this.lastDragReset = now;
    }
    
    this.dragCount++;

    // If dragged 3 times within 10 seconds
    if (this.dragCount >= 3) {
      this.trigger("annoyed");
      this.dragCount = 0;
      this.lastDragReset = now;
    }
  }

  public trigger(reaction: MiloReaction): void {
    const config = REACTION_CONFIG[reaction];
    if (config) {
      this.animationManager.requestAnimation({
        id: `reaction_${reaction}`,
        state: config.state,
        priority: config.priority,
        interruptible: true,
        durationMs: config.durationMs,
        returnState: "idle",
      });
    }
  }
}
