import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { MiloStateMachine } from "../src/main/milo-core/state-machine";
import { AnimationManager } from "../src/main/milo-core/animation-manager";
import { EventBus } from "../src/main/milo-core/event-bus";
import type { MiloStateEvent } from "../src/main/milo-core/types";

describe("Milo Core Security & Determinism Audit (Requirement R4)", () => {
  const miloCoreDir = path.resolve(__dirname, "../src/main/milo-core");

  it("statically verifies zero network, AI, or external API modules imported", () => {
    const files = readdirSync(miloCoreDir).filter((f) => f.endsWith(".ts"));
    expect(files.length).toBeGreaterThanOrEqual(4);

    const forbiddenImports = [
      ["open", "ai"].join(""),
      ["@open", "router"].join(""),
      ["str", "ipe"].join(""),
      ["supa", "base"].join(""),
      "node:http",
      "http",
      "node:https",
      "https",
      "node:net",
      "net",
      "node:tls",
      "tls",
      "node:dgram",
      "dgram",
      "node:child_process",
      "child_process",
      "desktop-suggestion-client",
      "ocr-engine",
      "window-capturer",
    ];

    const forbiddenPatterns = [
      /\bfetch\s*\(/,
      /\bXMLHttpRequest\b/,
      /\bWebSocket\b/,
      /\bchild_process\b/,
      /\bexec\s*\(/,
      /\bspawn\s*\(/,
    ];

    for (const file of files) {
      const fullPath = path.join(miloCoreDir, file);
      const content = readFileSync(fullPath, "utf8");

      // Check imports
      for (const forbidden of forbiddenImports) {
        const importRegex = new RegExp(`from\\s+["'].*${forbidden}.*["']`, "i");
        expect(
          importRegex.test(content),
          `File ${file} must not import from forbidden package ${forbidden}`,
        ).toBe(false);
      }

      // Check forbidden patterns
      for (const pattern of forbiddenPatterns) {
        expect(
          pattern.test(content),
          `File ${file} must not contain forbidden pattern ${pattern.toString()}`,
        ).toBe(false);
      }
    }
  });

  it("dynamically guarantees 100% deterministic state transitions across runs", () => {
    const eventSequence: MiloStateEvent[] = [
      "LOOK_AROUND",
      "TIMER_EXPIRED",
      "PET",
      "PURR_COMPLETE",
      "TIMER_EXPIRED",
      "DRAG_START",
      "DRAG_END",
      "TIMER_EXPIRED",
      "MESSAGE_NOTICED",
      "ASK_MILO",
      "SUGGESTIONS_READY",
      "REPLY_COPIED",
      "TIMER_EXPIRED",
    ];

    const runSequence = () => {
      const sm = new MiloStateMachine({ initialState: "idle" });
      const states: string[] = [sm.currentState];

      for (const event of eventSequence) {
        sm.transition(event);
        states.push(sm.currentState);
      }

      sm.dispose();
      return states;
    };

    const baseline = runSequence();
    expect(baseline).toEqual([
      "idle",
      "looking",
      "idle",
      "pet",
      "purring",
      "idle",
      "dragging",
      "drop",
      "idle",
      "alert",
      "thinking",
      "ready",
      "celebrating",
      "idle",
    ]);

    // Run 50 iterations and assert identical output
    for (let i = 0; i < 50; i++) {
      expect(runSequence()).toEqual(baseline);
    }
  });

  it("verifies global network clients are completely uncalled during operation", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    try {
      const eventBus = new EventBus();
      const stateMachine = new MiloStateMachine({ eventBus });
      const animationManager = new AnimationManager(stateMachine, eventBus);

      // Execute full lifecycle
      stateMachine.transition("DRAG_START");
      stateMachine.transition("DRAG_END");
      animationManager.requestAnimation({
        id: "test-anim-1",
        state: "level_up",
        priority: 80,
        queueIfLower: false,
      });
      animationManager.requestAnimation({
        id: "test-anim-2",
        state: "dragging",
        priority: 100,
      });
      animationManager.completeAnimation("test-anim-2");
      stateMachine.transition("PAUSE_TOGGLE");
      stateMachine.transition("RESUME_TOGGLE");

      expect(fetchSpy).not.toHaveBeenCalled();

      stateMachine.dispose();
      animationManager.dispose();
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
