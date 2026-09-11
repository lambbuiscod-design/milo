import { MiloStateMachine, AnimationManager } from "./milo-core";
import type { CharacterState } from "../shared/contracts";

export interface IdleBehavior {
  id: string;
  weight: number;
  cooldownMs: number;
  state: CharacterState;
  durationMs?: number;
}

export const IDLE_BEHAVIORS: IdleBehavior[] = [
  // 0-2 min
  { id: "blink", weight: 40, cooldownMs: 15000, state: "idle" },
  { id: "look_around", weight: 30, cooldownMs: 30000, state: "looking", durationMs: 4000 },
  { id: "normal_idle", weight: 30, cooldownMs: 15000, state: "idle" },
  // 2-5 min
  { id: "stretch", weight: 30, cooldownMs: 60000, state: "waking", durationMs: 3000 },
  { id: "clean_paws", weight: 30, cooldownMs: 60000, state: "pet", durationMs: 4000 },
  // 5-10 min
  { id: "coffee", weight: 20, cooldownMs: 120000, state: "alert", durationMs: 4000 },
  { id: "read", weight: 20, cooldownMs: 120000, state: "thinking", durationMs: 6000 },
  { id: "small_toy", weight: 20, cooldownMs: 120000, state: "playful", durationMs: 5000 },
  // 10-15 min
  { id: "yawn", weight: 50, cooldownMs: 60000, state: "sleepy", durationMs: 3000 },
  { id: "sleepy", weight: 50, cooldownMs: 60000, state: "sleepy", durationMs: 4000 },
  // 15+ min
  { id: "sleep", weight: 100, cooldownMs: 0, state: "sleeping" },
];

export class IdleManager {
  public lastUserInteraction: number;
  public lastMiloAnimation: number;
  public lastIdleBehavior: string | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private readonly behaviorLastUsed: Map<string, number> = new Map();

  constructor(
    private readonly stateMachine: MiloStateMachine,
    private readonly animationManager: AnimationManager,
    private readonly evaluationIntervalMs: number = 30000
  ) {
    this.lastUserInteraction = Date.now();
    this.lastMiloAnimation = Date.now();
  }

  public get currentIdleDuration(): number {
    return Date.now() - this.lastUserInteraction;
  }

  public start(): void {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => this.evaluate(), this.evaluationIntervalMs);
  }

  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  public touch(): void {
    const now = Date.now();
    this.lastUserInteraction = now;

    const currentState = this.stateMachine.currentState;
    if (currentState === "sleeping" || currentState === "sleepy") {
      this.stateMachine.transition("WAKE_UP");
      this.animationManager.requestAnimation({ id: "waking", state: "waking", priority: 80, interruptible: true, durationMs: 2000, returnState: "idle" });
    }
  }

  private evaluate(): void {
    const now = Date.now();
    const idleMs = this.currentIdleDuration;
    const idleMin = idleMs / 60000;

    // Only trigger idle behaviors if Milo is currently idle, looking, or sleeping
    const currentState = this.stateMachine.currentState;
    if (!["idle", "looking", "sleepy", "sleeping"].includes(currentState)) {
      return;
    }

    let pool: IdleBehavior[] = [];
    if (idleMin < 2) {
      pool = IDLE_BEHAVIORS.filter(b => ["blink", "look_around", "normal_idle"].includes(b.id));
    } else if (idleMin < 5) {
      pool = IDLE_BEHAVIORS.filter(b => ["stretch", "clean_paws", "look_around"].includes(b.id));
    } else if (idleMin < 10) {
      pool = IDLE_BEHAVIORS.filter(b => ["coffee", "read", "small_toy"].includes(b.id));
    } else if (idleMin < 15) {
      pool = IDLE_BEHAVIORS.filter(b => ["yawn", "sleepy"].includes(b.id));
    } else {
      pool = IDLE_BEHAVIORS.filter(b => ["sleep"].includes(b.id));
    }

    const behavior = this.pickBehavior(pool, now);
    if (behavior) {
      this.lastIdleBehavior = behavior.id;
      this.lastMiloAnimation = now;
      this.behaviorLastUsed.set(behavior.id, now);
      
      this.animationManager.requestAnimation({ 
        id: behavior.id, 
        state: behavior.state, 
        priority: 20, 
        interruptible: true, 
        durationMs: behavior.durationMs,
        returnState: behavior.id === "sleep" ? "sleeping" : "idle"
      });
    }
  }

  private pickBehavior(pool: IdleBehavior[], now: number): IdleBehavior | null {
    const available = pool.filter(b => {
      const lastUsed = this.behaviorLastUsed.get(b.id) || 0;
      return (now - lastUsed) >= b.cooldownMs;
    });

    if (available.length === 0) return null;

    const totalWeight = available.reduce((sum, b) => sum + b.weight, 0);
    let random = Math.random() * totalWeight;

    for (const b of available) {
      if (random < b.weight) {
        return b;
      }
      random -= b.weight;
    }
    return available[available.length - 1];
  }
}
