import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  CHARACTER_STATES,
  type CharacterState,
} from "../src/shared/contracts";
import {
  type Point,
  type Rectangle,
  type Size,
} from "../src/shared/position";
import {
  triggerCharacterActionInputSchema,
  parseTriggerCharacterActionInput,
  RequestValidationError,
} from "../src/shared/validation";
import {
  calculateCompanionBounds,
  clampWithEdgePeeking,
  MIN_COMPANION_PEEK_PX,
  DEFAULT_COMPANION_SIZE,
} from "../src/shared/companion-bounds";
import {
  MiloStateMachine,
  AnimationManager,
  EventBus,
  STATE_PRIORITIES,
  type MiloStateEvent,
} from "../src/main/milo-core";

describe("Milestone 4 Challenger 2 Empirical Adversarial Stress Suite", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // =========================================================================
  // MISSION 1: State Transition Lifecycle & Priority Preemption Adversarial Suite
  // =========================================================================
  describe("Mission 1: State Transition Lifecycle & Preemption Adversary", () => {
    it("verifies dragging priority (100) strictly exceeds all other 18 canonical state priorities", () => {
      const draggingPriority = STATE_PRIORITIES.dragging;
      expect(draggingPriority).toBe(100);

      for (const state of CHARACTER_STATES) {
        if (state === "dragging") continue;
        const priority = STATE_PRIORITIES[state];
        expect(priority).toBeLessThan(draggingPriority);
      }
    });

    it("verifies DRAG_START preempts all non-paused states into 'dragging' with priority 100", () => {
      const eventBus = new EventBus();
      const nonPausedStates = CHARACTER_STATES.filter((s) => s !== "paused");

      for (const startState of nonPausedStates) {
        const sm = new MiloStateMachine({ initialState: startState, eventBus });
        expect(sm.currentState).toBe(startState);

        const accepted = sm.transition("DRAG_START", { source: startState });
        expect(accepted).toBe(true);
        expect(sm.currentState).toBe("dragging");
        expect(sm.currentPriority).toBe(100);
        expect(sm.isDragging).toBe(true);
        expect(sm.previousState).toBe(startState);

        sm.dispose();
      }
    });

    it("verifies paused state fails closed: strictly rejects DRAG_START and maintains paused", () => {
      const eventBus = new EventBus();
      const sm = new MiloStateMachine({ initialState: "paused", eventBus });
      const rejectedEvents: Array<{ event: string; reason: string }> = [];

      eventBus.subscribe("state:transition_rejected", (payload) => {
        rejectedEvents.push({ event: payload.event, reason: payload.reason });
      });

      expect(sm.currentState).toBe("paused");
      expect(sm.isPaused).toBe(true);
      expect(sm.currentPriority).toBe(85);

      // Attempt DRAG_START
      const dragStartRes = sm.transition("DRAG_START");
      expect(dragStartRes).toBe(false);
      expect(sm.currentState).toBe("paused");
      expect(sm.isPaused).toBe(true);

      // Attempt all other interaction events while paused
      const forbiddenEvents: MiloStateEvent[] = [
        "DRAG_END",
        "LOOK_AROUND",
        "PET",
        "INACTIVITY_TIMEOUT",
        "WAKE_UP",
        "MESSAGE_NOTICED",
        "ASK_MILO",
        "SUGGESTIONS_READY",
        "REPLY_COPIED",
        "PANEL_CLOSED",
        "LEVEL_UP_AWARD",
        "CELEBRATION_COMPLETE",
        "ERROR_OCCURRED",
        "TIMER_EXPIRED",
      ];

      for (const ev of forbiddenEvents) {
        const res = sm.transition(ev);
        expect(res).toBe(false);
        expect(sm.currentState).toBe("paused");
      }

      // Verify rejection reasons
      expect(rejectedEvents.length).toBe(forbiddenEvents.length + 1);
      for (const rejection of rejectedEvents) {
        expect(rejection.reason).toBe("PAUSED_FAILS_CLOSED");
      }

      // Verify only RESUME_TOGGLE can exit paused
      const resumeRes = sm.transition("RESUME_TOGGLE");
      expect(resumeRes).toBe(true);
      expect(sm.currentState).toBe("idle");
      expect(sm.isPaused).toBe(false);

      sm.dispose();
    });

    it("stress-tests DRAG_START across specific named base states with active timers", () => {
      const baseStates: CharacterState[] = [
        "idle",
        "looking",
        "sleepy",
        "pet",
        "curious",
        "playful",
        "error",
      ];

      for (const base of baseStates) {
        const eventBus = new EventBus();
        const sm = new MiloStateMachine({ initialState: base, eventBus });

        // If the state has a transient duration, schedule timer via force
        sm.forceState(base, `TEST_ENTER_${base}`);
        expect(sm.currentState).toBe(base);

        // Preempt with DRAG_START halfway through
        vi.advanceTimersByTime(500);
        const accepted = sm.transition("DRAG_START");
        expect(accepted).toBe(true);
        expect(sm.currentState).toBe("dragging");

        // Advance past original state's duration to ensure no old timer clobbers dragging
        vi.advanceTimersByTime(15000);
        expect(sm.currentState).toBe("dragging");
        expect(sm.isDragging).toBe(true);

        sm.dispose();
      }
    });

    it("evaluates AnimationManager interaction when DRAG_START occurs during an active animation", () => {
      const eventBus = new EventBus();
      const sm = new MiloStateMachine({ initialState: "idle", eventBus });
      const am = new AnimationManager(sm, eventBus);

      // Start "wave" animation (celebrating, 2000ms, priority 75)
      const reqRes = am.requestAnimation({
        id: "wave",
        state: "celebrating",
        durationMs: 2000,
        priority: 75,
        returnState: "idle",
      });
      expect(reqRes.accepted).toBe(true);
      expect(sm.currentState).toBe("celebrating");

      // Advance by 500ms
      vi.advanceTimersByTime(500);

      // User starts dragging the companion
      const dragStartRes = sm.transition("DRAG_START");
      expect(dragStartRes).toBe(true);
      expect(sm.currentState).toBe("dragging");
      expect(sm.currentPriority).toBe(100);

      // Scenario A: Short drag (ends before the 2000ms animation timer expires)
      // Drag ends at t=500+200=700ms (< 2000ms)
      vi.advanceTimersByTime(200);
      const dragEndRes = sm.transition("DRAG_END");
      expect(dragEndRes).toBe(true);
      expect(sm.currentState).toBe("drop");

      // Settle drop squash (700ms duration) -> returns to idle at t=700+700=1400ms
      vi.advanceTimersByTime(700);
      expect(sm.currentState).toBe("idle");

      // Now advance past remaining animation duration (at t=2000ms)
      vi.advanceTimersByTime(600);
      expect(sm.currentState).toBe("idle");
      expect(am.currentAnimation).toBeNull();

      am.dispose();
      sm.dispose();
    });
  });

  // =========================================================================
  // MISSION 2: Rapid Drag-Drop Cycling Adversarial Suite (100 Iterations)
  // =========================================================================
  describe("Mission 2: Rapid Drag-Drop Cycling (100 Iterations)", () => {
    it("executes 100 consecutive rapid drag-drop cycles before drop timer expires without deadlocking", () => {
      const eventBus = new EventBus();
      const stateHistory: Array<{ from: CharacterState; to: CharacterState; event: string }> = [];

      eventBus.subscribe("state:changed", (record) => {
        stateHistory.push({ from: record.from, to: record.to, event: record.event });
      });

      const sm = new MiloStateMachine({ initialState: "idle", eventBus, maxHistoryLength: 250 });

      for (let i = 0; i < 100; i++) {
        // Step 1: Start Drag
        const startAccepted = sm.transition("DRAG_START", { iteration: i });
        expect(startAccepted).toBe(true);
        expect(sm.currentState).toBe("dragging");
        expect(sm.isDragging).toBe(true);

        // Advance by jittered drag duration (10ms to 50ms)
        const dragDuration = 10 + (i % 5) * 10;
        vi.advanceTimersByTime(dragDuration);
        expect(sm.currentState).toBe("dragging");

        // Step 2: End Drag -> drop (squash phase scheduled for 700ms)
        const endAccepted = sm.transition("DRAG_END", { iteration: i });
        expect(endAccepted).toBe(true);
        expect(sm.currentState).toBe("drop");
        expect(sm.isDragging).toBe(false);

        // Step 3: Advance by jittered drop duration BEFORE 700ms expires (20ms to 170ms < 700ms)
        // Only advance early interruption if not the final iteration
        if (i < 99) {
          const dropInterruptionTime = 20 + (i % 7) * 25;
          vi.advanceTimersByTime(dropInterruptionTime);
          expect(sm.currentState).toBe("drop");
        }
      }

      // After 100 iterations, the mascot is immediately in "drop" state
      expect(sm.currentState).toBe("drop");
      expect(sm.currentPriority).toBe(90);

      // Advance by 650ms (< 700ms, still in drop squash phase)
      vi.advanceTimersByTime(650);
      expect(sm.currentState).toBe("drop");

      // Advance remaining 60ms (total 710ms > 700ms from last drop)
      vi.advanceTimersByTime(60);

      // State machine MUST settle cleanly to "idle" with priority 0
      expect(sm.currentState).toBe("idle");
      expect(sm.currentPriority).toBe(0);
      expect(sm.isDragging).toBe(false);
      expect(sm.isPaused).toBe(false);

      // Verify no lingering transitions after idle settlement
      const historyLengthAtRest = stateHistory.length;
      vi.advanceTimersByTime(5000);
      expect(stateHistory.length).toBe(historyLengthAtRest);
      expect(sm.currentState).toBe("idle");

      sm.dispose();
    });

    it("survives 100 zero-delay synchronous drag-drop transitions without call stack overflow", () => {
      const eventBus = new EventBus();
      const sm = new MiloStateMachine({ initialState: "idle", eventBus });

      for (let i = 0; i < 100; i++) {
        expect(sm.transition("DRAG_START")).toBe(true);
        expect(sm.currentState).toBe("dragging");
        expect(sm.transition("DRAG_END")).toBe(true);
        expect(sm.currentState).toBe("drop");
      }

      // After 100 immediate cycles, advance 700ms -> settles to idle
      vi.advanceTimersByTime(700);
      expect(sm.currentState).toBe("idle");

      sm.dispose();
    });

    it("handles interrupted drop squash halfway (350ms in) across 20 cycles and settles", () => {
      const eventBus = new EventBus();
      const sm = new MiloStateMachine({ initialState: "idle", eventBus });

      for (let i = 0; i < 20; i++) {
        expect(sm.transition("DRAG_START")).toBe(true);
        vi.advanceTimersByTime(50);
        expect(sm.transition("DRAG_END")).toBe(true);
        expect(sm.currentState).toBe("drop");

        // Advance 350ms (exactly half of 700ms)
        vi.advanceTimersByTime(350);
        expect(sm.currentState).toBe("drop");
      }

      // Allow final drop to finish completely (700ms)
      vi.advanceTimersByTime(700);
      expect(sm.currentState).toBe("idle");

      sm.dispose();
    });
  });

  // =========================================================================
  // MISSION 3: Window Movement Bounds Protection Stress Suite
  // =========================================================================
  describe("Mission 3: Window Movement Bounds Protection Stress Suite", () => {
    const defaultSize: Size = DEFAULT_COMPANION_SIZE; // 250 x 300
    const primaryWorkArea: Rectangle = { x: 0, y: 0, width: 1920, height: 1080 };

    it("clamps single display to guarantee at least 25px edge always remains visible", () => {
      const bounds = calculateCompanionBounds(defaultSize, primaryWorkArea, MIN_COMPANION_PEEK_PX);

      // minX = 0 - 250 + 25 = -225
      // maxX = 0 + 1920 - 25 = 1895
      // minY = 0 - 300 + 25 = -275
      // maxY = 0 + 1080 - 25 = 1055
      expect(bounds.minX).toBe(-225);
      expect(bounds.maxX).toBe(1895);
      expect(bounds.minY).toBe(-275);
      expect(bounds.maxY).toBe(1055);

      // Test extreme positive delta jump (+1,000,000, +1,000,000)
      const farPositive = clampWithEdgePeeking(
        { x: 1_000_000, y: 1_000_000 },
        defaultSize,
        primaryWorkArea,
        MIN_COMPANION_PEEK_PX,
      );
      expect(farPositive.x).toBe(1895);
      expect(farPositive.y).toBe(1055);

      // Test extreme negative delta jump (-1,000,000, -1,000,000)
      const farNegative = clampWithEdgePeeking(
        { x: -1_000_000, y: -1_000_000 },
        defaultSize,
        primaryWorkArea,
        MIN_COMPANION_PEEK_PX,
      );
      expect(farNegative.x).toBe(-225);
      expect(farNegative.y).toBe(-275);
    });

    it("verifies mathematical overlap invariant: visible area on workArea is >= 25px horizontally and vertically", () => {
      const testCoordinates: Point[] = [
        { x: -100_000, y: -100_000 },
        { x: -500, y: -500 },
        { x: -225, y: -275 }, // exact min
        { x: 0, y: 0 },
        { x: 500, y: 300 },
        { x: 1895, y: 1055 }, // exact max
        { x: 3000, y: 2000 },
        { x: 100_000, y: 100_000 },
      ];

      for (const pt of testCoordinates) {
        const clamped = clampWithEdgePeeking(pt, defaultSize, primaryWorkArea, MIN_COMPANION_PEEK_PX);

        // Horizontal visible span
        const leftVisible = Math.max(clamped.x, primaryWorkArea.x);
        const rightVisible = Math.min(clamped.x + defaultSize.width, primaryWorkArea.x + primaryWorkArea.width);
        const visibleWidth = Math.max(0, rightVisible - leftVisible);

        // Vertical visible span
        const topVisible = Math.max(clamped.y, primaryWorkArea.y);
        const bottomVisible = Math.min(clamped.y + defaultSize.height, primaryWorkArea.y + primaryWorkArea.height);
        const visibleHeight = Math.max(0, bottomVisible - topVisible);

        expect(visibleWidth).toBeGreaterThanOrEqual(MIN_COMPANION_PEEK_PX);
        expect(visibleHeight).toBeGreaterThanOrEqual(MIN_COMPANION_PEEK_PX);
      }
    });

    it("handles multi-monitor configurations correctly", () => {
      const monitors: Array<{ name: string; workArea: Rectangle }> = [
        { name: "Primary 1080p", workArea: { x: 0, y: 0, width: 1920, height: 1080 } },
        { name: "Left Monitor", workArea: { x: -1920, y: 0, width: 1920, height: 1080 } },
        { name: "Right Monitor 1440p", workArea: { x: 1920, y: 0, width: 2560, height: 1440 } },
        { name: "Top Stacked Monitor", workArea: { x: 0, y: -1080, width: 1920, height: 1080 } },
        { name: "Staggered Height Monitor", workArea: { x: 1920, y: 200, width: 1920, height: 1080 } },
      ];

      for (const mon of monitors) {
        const bounds = calculateCompanionBounds(defaultSize, mon.workArea, MIN_COMPANION_PEEK_PX);

        // Test extreme overshoot on each monitor
        const clampedLow = clampWithEdgePeeking(
          { x: mon.workArea.x - 50_000, y: mon.workArea.y - 50_000 },
          defaultSize,
          mon.workArea,
          MIN_COMPANION_PEEK_PX,
        );
        expect(clampedLow.x).toBe(bounds.minX);
        expect(clampedLow.y).toBe(bounds.minY);

        const clampedHigh = clampWithEdgePeeking(
          { x: mon.workArea.x + 50_000, y: mon.workArea.y + 50_000 },
          defaultSize,
          mon.workArea,
          MIN_COMPANION_PEEK_PX,
        );
        expect(clampedHigh.x).toBe(bounds.maxX);
        expect(clampedHigh.y).toBe(bounds.maxY);

        // Verify >= 25px visible invariant on this display
        const visibleW = Math.min(clampedHigh.x + defaultSize.width, mon.workArea.x + mon.workArea.width) -
          Math.max(clampedHigh.x, mon.workArea.x);
        const visibleH = Math.min(clampedHigh.y + defaultSize.height, mon.workArea.y + mon.workArea.height) -
          Math.max(clampedHigh.y, mon.workArea.y);

        expect(visibleW).toBeGreaterThanOrEqual(MIN_COMPANION_PEEK_PX);
        expect(visibleH).toBeGreaterThanOrEqual(MIN_COMPANION_PEEK_PX);
      }
    });

    it("handles non-finite coordinates (NaN, Infinity, -Infinity) gracefully without crashing", () => {
      const nanCoord = clampWithEdgePeeking(
        { x: NaN, y: NaN },
        defaultSize,
        primaryWorkArea,
        MIN_COMPANION_PEEK_PX,
      );
      expect(nanCoord.x).toBe(primaryWorkArea.x);
      expect(nanCoord.y).toBe(primaryWorkArea.y);

      const infCoord = clampWithEdgePeeking(
        { x: Infinity, y: -Infinity },
        defaultSize,
        primaryWorkArea,
        MIN_COMPANION_PEEK_PX,
      );
      expect(infCoord.x).toBe(primaryWorkArea.x);
      expect(infCoord.y).toBe(primaryWorkArea.y);
    });

    it("stress tests 1,000 pseudo-random positions across multiple displays verifying edge invariant", () => {
      const displays: Rectangle[] = [
        { x: 0, y: 0, width: 1920, height: 1080 },
        { x: -1920, y: 0, width: 1920, height: 1080 },
        { x: 1920, y: -200, width: 2560, height: 1440 },
      ];

      for (let i = 0; i < 1000; i++) {
        const display = displays[i % displays.length];
        const randomX = (Math.sin(i * 13) * 100_000);
        const randomY = (Math.cos(i * 17) * 100_000);

        const clamped = clampWithEdgePeeking(
          { x: randomX, y: randomY },
          defaultSize,
          display,
          MIN_COMPANION_PEEK_PX,
        );

        // Verification of invariant
        const visibleW = Math.min(clamped.x + defaultSize.width, display.x + display.width) -
          Math.max(clamped.x, display.x);
        const visibleH = Math.min(clamped.y + defaultSize.height, display.y + display.height) -
          Math.max(clamped.y, display.y);

        expect(visibleW).toBeGreaterThanOrEqual(MIN_COMPANION_PEEK_PX);
        expect(visibleH).toBeGreaterThanOrEqual(MIN_COMPANION_PEEK_PX);
      }
    });
  });

  // =========================================================================
  // MISSION 4: Input Schema Boundary Adversarial Suite
  // =========================================================================
  describe("Mission 4: Input Schema Boundary Adversarial Suite", () => {
    it("strictly rejects unknown actions and bad types with zero crashes", () => {
      const invalidActions = [
        { action: "unknown" },
        { action: "DRAG_START" },
        { action: "dragStart" },
        { action: "drop" },
        { action: "idle" },
        { action: "" },
        { action: 123 },
        { action: null },
        { action: true },
        {},
        null,
        undefined,
        "drag_start",
        12345,
        [],
      ];

      for (const payload of invalidActions) {
        expect(() => parseTriggerCharacterActionInput(payload)).toThrow(RequestValidationError);
        const parseResult = triggerCharacterActionInputSchema.safeParse(payload);
        expect(parseResult.success).toBe(false);
      }
    });

    it("strictly enforces deltaX and deltaY bounds on drag_move [-2000, 2000]", () => {
      // Valid boundary values
      expect(() =>
        parseTriggerCharacterActionInput({ action: "drag_move", deltaX: 2000, deltaY: 2000 })
      ).not.toThrow();

      expect(() =>
        parseTriggerCharacterActionInput({ action: "drag_move", deltaX: -2000, deltaY: -2000 })
      ).not.toThrow();

      expect(() =>
        parseTriggerCharacterActionInput({ action: "drag_move", deltaX: 0, deltaY: 0 })
      ).not.toThrow();

      // Invalid extreme values
      const invalidDeltas = [
        { action: "drag_move", deltaX: 1e9, deltaY: 0 },
        { action: "drag_move", deltaX: -1e9, deltaY: 0 },
        { action: "drag_move", deltaX: 2001, deltaY: 0 },
        { action: "drag_move", deltaX: -2001, deltaY: 0 },
        { action: "drag_move", deltaX: 0, deltaY: 2001 },
        { action: "drag_move", deltaX: 0, deltaY: -2001 },
        { action: "drag_move", deltaX: NaN, deltaY: 0 },
        { action: "drag_move", deltaX: Infinity, deltaY: 0 },
        { action: "drag_move", deltaX: -Infinity, deltaY: 0 },
        { action: "drag_move", deltaX: "100", deltaY: 0 },
        { action: "drag_move", deltaX: null, deltaY: 0 },
        { action: "drag_move", deltaX: 10 }, // missing deltaY
        { action: "drag_move", deltaY: 10 }, // missing deltaX
      ];

      for (const payload of invalidDeltas) {
        expect(() => parseTriggerCharacterActionInput(payload)).toThrow(RequestValidationError);
      }
    });

    it("strictly rejects extra/unexpected properties across all action variants (.strict() validation)", () => {
      const payloadsWithExtra = [
        { action: "drag_start", injectedProp: "malicious" },
        { action: "drag_move", deltaX: 10, deltaY: 10, overflow: true },
        { action: "drag_end", extraField: 1234 },
        { action: "look_around", timestamp: Date.now() },
        { action: "play_animation", animationName: "wave", hack: true },
        { action: "drag_start", __proto__: { admin: true } },
      ];

      for (const payload of payloadsWithExtra) {
        expect(() => parseTriggerCharacterActionInput(payload)).toThrow(RequestValidationError);
      }
    });

    it("strictly validates play_animation animationName lengths and boundaries", () => {
      // Valid cases
      expect(() =>
        parseTriggerCharacterActionInput({ action: "play_animation" })
      ).not.toThrow();

      expect(() =>
        parseTriggerCharacterActionInput({ action: "play_animation", animationName: "wave" })
      ).not.toThrow();

      expect(() =>
        parseTriggerCharacterActionInput({ action: "play_animation", animationName: "a".repeat(64) })
      ).not.toThrow();

      // Invalid cases
      expect(() =>
        parseTriggerCharacterActionInput({ action: "play_animation", animationName: "" })
      ).toThrow(RequestValidationError);

      expect(() =>
        parseTriggerCharacterActionInput({ action: "play_animation", animationName: "a".repeat(65) })
      ).toThrow(RequestValidationError);

      expect(() =>
        parseTriggerCharacterActionInput({ action: "play_animation", animationName: 12345 })
      ).toThrow(RequestValidationError);
    });
  });
});
