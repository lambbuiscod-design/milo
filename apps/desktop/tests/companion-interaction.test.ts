import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  ClickDisambiguator,
  calculatePupilOffset,
  HARMLESS_ANIMATION_NAMES,
  CLICK_DELAY_MS,
  DOUBLE_CLICK_COOLDOWN_MS,
  MAX_PUPIL_OFFSET_X,
  MAX_PUPIL_OFFSET_Y,
  HARMLESS_ANIMATIONS,
  type TriggerCharacterActionInput,
} from "../src/shared/contracts";
import {
  triggerCharacterActionInputSchema,
  parseTriggerCharacterActionInput,
  RequestValidationError,
} from "../src/shared/validation";
import {
  MiloStateMachine,
  AnimationManager,
  EventBus,
  STATE_PRIORITIES,
} from "../src/main/milo-core";
import { createCompanionContextMenuTemplate } from "../src/main/desktop-ipc";
import type { BrowserWindow } from "electron";
import type { OverlayController } from "../src/main/overlay-controller";

describe("Milestone 4: Companion Window Interaction Layer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Requirement R1 & R3: Click Disambiguation and Cooldown", () => {
    it("fires single click after 250ms when no second click arrives", () => {
      const onSingleClick = vi.fn();
      const onDoubleClick = vi.fn();
      const disambiguator = new ClickDisambiguator({
        onSingleClick,
        onDoubleClick,
        clickDelayMs: CLICK_DELAY_MS,
      });

      const res = disambiguator.registerClick(1000);
      expect(res).toBe("single_queued");
      expect(onSingleClick).not.toHaveBeenCalled();
      expect(onDoubleClick).not.toHaveBeenCalled();

      // Advance by 240ms (still within delay)
      vi.advanceTimersByTime(240);
      expect(onSingleClick).not.toHaveBeenCalled();

      // Advance by remaining 10ms (total 250ms reached)
      vi.advanceTimersByTime(10);
      expect(onSingleClick).toHaveBeenCalledTimes(1);
      expect(onDoubleClick).not.toHaveBeenCalled();

      disambiguator.dispose();
    });

    it("cancels single click and executes double click if second click arrives within 250ms", () => {
      const onSingleClick = vi.fn();
      const onDoubleClick = vi.fn();
      const disambiguator = new ClickDisambiguator({
        onSingleClick,
        onDoubleClick,
        clickDelayMs: 250,
      });

      // First click at t=1000
      disambiguator.registerClick(1000);
      expect(onSingleClick).not.toHaveBeenCalled();

      // Second click at t=1100 (100ms later < 250ms)
      const res = disambiguator.registerClick(1100);
      expect(res).toBe("double_triggered");
      expect(onDoubleClick).toHaveBeenCalledTimes(1);
      const passedAnim = onDoubleClick.mock.calls[0][0];
      expect(HARMLESS_ANIMATION_NAMES).toContain(passedAnim);

      // Advance past 250ms to ensure single click does NOT fire
      vi.advanceTimersByTime(500);
      expect(onSingleClick).not.toHaveBeenCalled();

      disambiguator.dispose();
    });

    it("blocks double click if triggered within 1500ms cooldown window", () => {
      const onSingleClick = vi.fn();
      const onDoubleClick = vi.fn();
      const disambiguator = new ClickDisambiguator({
        onSingleClick,
        onDoubleClick,
        clickDelayMs: 250,
        doubleClickCooldownMs: 1500,
      });

      // First double click at t=1000
      disambiguator.registerClick(1000);
      const res1 = disambiguator.registerClick(1100);
      expect(res1).toBe("double_triggered");
      expect(onDoubleClick).toHaveBeenCalledTimes(1);

      // Second double click attempted at t=1600 (600ms < 1500ms)
      disambiguator.registerClick(1600);
      const res2 = disambiguator.registerClick(1700);
      expect(res2).toBe("double_cooldown_blocked");
      // Double click count should still be 1 (blocked!)
      expect(onDoubleClick).toHaveBeenCalledTimes(1);

      // Advance past disambiguation timer to ensure single click was also cancelled
      vi.advanceTimersByTime(500);
      expect(onSingleClick).not.toHaveBeenCalled();

      // Third double click attempted at t=2800 (1700ms > 1500ms since last double click at 1100)
      disambiguator.registerClick(2800);
      const res3 = disambiguator.registerClick(2900);
      expect(res3).toBe("double_triggered");
      expect(onDoubleClick).toHaveBeenCalledTimes(2);

      disambiguator.dispose();
    });

    it("allows canceling pending click when drag starts", () => {
      const onSingleClick = vi.fn();
      const onDoubleClick = vi.fn();
      const disambiguator = new ClickDisambiguator({
        onSingleClick,
        onDoubleClick,
      });

      disambiguator.registerClick(1000);
      // Drag started, cancel pending click
      disambiguator.cancelPendingClick();

      vi.advanceTimersByTime(500);
      expect(onSingleClick).not.toHaveBeenCalled();
      expect(onDoubleClick).not.toHaveBeenCalled();

      disambiguator.dispose();
    });
  });

  describe("Requirement R1: Pupil Offset Calculation and Clamping", () => {
    const center = { x: 125, y: 135 };
    const maxDist = { x: 125, y: 150 };

    it("returns zero offset when pointer is at the cat face center", () => {
      const offset = calculatePupilOffset(center, center, maxDist);
      expect(offset).toEqual({ x: 0, y: 0 });
    });

    it("clamps pupil offset horizontally to ±3.5px", () => {
      // Right edge
      const right = calculatePupilOffset({ x: 250, y: 135 }, center, maxDist);
      expect(right.x).toBe(MAX_PUPIL_OFFSET_X);
      expect(right.y).toBe(0);

      // Far right
      const farRight = calculatePupilOffset({ x: 9999, y: 135 }, center, maxDist);
      expect(farRight.x).toBe(MAX_PUPIL_OFFSET_X);

      // Left edge
      const left = calculatePupilOffset({ x: 0, y: 135 }, center, maxDist);
      expect(left.x).toBe(-MAX_PUPIL_OFFSET_X);
      expect(left.y).toBe(0);

      // Far left
      const farLeft = calculatePupilOffset({ x: -9999, y: 135 }, center, maxDist);
      expect(farLeft.x).toBe(-MAX_PUPIL_OFFSET_X);
    });

    it("clamps pupil offset vertically to ±2.5px", () => {
      // Bottom edge
      const bottom = calculatePupilOffset({ x: 125, y: 285 }, center, maxDist);
      expect(bottom.y).toBe(MAX_PUPIL_OFFSET_Y);
      expect(bottom.x).toBe(0);

      // Far bottom
      const farBottom = calculatePupilOffset({ x: 125, y: 9999 }, center, maxDist);
      expect(farBottom.y).toBe(MAX_PUPIL_OFFSET_Y);

      // Top edge
      const top = calculatePupilOffset({ x: 125, y: -15 }, center, maxDist);
      expect(top.y).toBe(-MAX_PUPIL_OFFSET_Y);
      expect(top.x).toBe(0);

      // Far top
      const farTop = calculatePupilOffset({ x: 125, y: -9999 }, center, maxDist);
      expect(farTop.y).toBe(-MAX_PUPIL_OFFSET_Y);
    });

    it("clamps pupil offset diagonally within [-3.5, 3.5] x and [-2.5, 2.5] y", () => {
      const diag = calculatePupilOffset({ x: 1000, y: 1000 }, center, maxDist);
      expect(diag.x).toBe(3.5);
      expect(diag.y).toBe(2.5);

      const diagOpposite = calculatePupilOffset({ x: -1000, y: -1000 }, center, maxDist);
      expect(diagOpposite.x).toBe(-3.5);
      expect(diagOpposite.y).toBe(-2.5);
    });
  });

  describe("Requirement R1: State Machine Drag/Drop Lifecycle", () => {
    it("transitions DRAG_START -> dragging (P:100) -> DRAG_END -> drop (P:90) -> auto-return idle (P:0)", () => {
      const eventBus = new EventBus();
      const stateMachine = new MiloStateMachine({ initialState: "idle", eventBus });

      expect(stateMachine.currentState).toBe("idle");
      expect(stateMachine.currentPriority).toBe(0);

      // Start drag
      const startAccepted = stateMachine.transition("DRAG_START");
      expect(startAccepted).toBe(true);
      expect(stateMachine.currentState).toBe("dragging");
      expect(stateMachine.currentPriority).toBe(100);
      expect(stateMachine.isDragging).toBe(true);

      // End drag (drop squash phase, duration 700ms)
      const endAccepted = stateMachine.transition("DRAG_END");
      expect(endAccepted).toBe(true);
      expect(stateMachine.currentState).toBe("drop");
      expect(stateMachine.currentPriority).toBe(90);
      expect(stateMachine.isDragging).toBe(false);

      // Advance by 690ms (still dropping)
      vi.advanceTimersByTime(690);
      expect(stateMachine.currentState).toBe("drop");

      // Advance remaining 20ms (total > 700ms) -> auto return to idle
      vi.advanceTimersByTime(20);
      expect(stateMachine.currentState).toBe("idle");
      expect(stateMachine.currentPriority).toBe(0);

      stateMachine.dispose();
    });

    it("fails closed when paused: refuses DRAG_START and maintains paused state", () => {
      const eventBus = new EventBus();
      const stateMachine = new MiloStateMachine({ initialState: "paused", eventBus });

      expect(stateMachine.currentState).toBe("paused");
      expect(stateMachine.isPaused).toBe(true);

      const dragAccepted = stateMachine.transition("DRAG_START");
      expect(dragAccepted).toBe(false);
      expect(stateMachine.currentState).toBe("paused");

      const lookAccepted = stateMachine.transition("LOOK_AROUND");
      expect(lookAccepted).toBe(false);
      expect(stateMachine.currentState).toBe("paused");

      stateMachine.dispose();
    });

    it("triggers LOOK_AROUND when idle and auto-returns to idle after duration", () => {
      const eventBus = new EventBus();
      const stateMachine = new MiloStateMachine({ initialState: "idle", eventBus });

      const lookAccepted = stateMachine.transition("LOOK_AROUND");
      expect(lookAccepted).toBe(true);
      expect(stateMachine.currentState).toBe("looking");
      expect(stateMachine.currentPriority).toBe(20);

      // Duration for looking is 4000ms
      vi.advanceTimersByTime(4010);
      expect(stateMachine.currentState).toBe("idle");

      stateMachine.dispose();
    });
  });

  describe("Requirement R3: Harmless Animation Pool & Canonical State Mapping", () => {
    it("defines all 6 harmless animations with valid canonical character states and durations", () => {
      const expectedAnimations: Record<string, { state: string; durationMs: number }> = {
        wave: { state: "celebrating", durationMs: 2000 },
        jump: { state: "playful", durationMs: 1800 },
        spin: { state: "playful", durationMs: 1800 },
        happy: { state: "pet", durationMs: 2000 },
        surprised: { state: "curious", durationMs: 2000 },
        tiny_dance: { state: "celebrating", durationMs: 2500 },
      };

      for (const [name, expected] of Object.entries(expectedAnimations)) {
        expect(HARMLESS_ANIMATIONS).toHaveProperty(name);
        const config = HARMLESS_ANIMATIONS[name];
        expect(config.state).toBe(expected.state);
        expect(config.durationMs).toBe(expected.durationMs);
        expect(STATE_PRIORITIES[config.state]).toBeGreaterThan(0);
      }
    });

    it("executes harmless animation requests through AnimationManager and restores idle", () => {
      const eventBus = new EventBus();
      const stateMachine = new MiloStateMachine({ initialState: "idle", eventBus });
      const animationManager = new AnimationManager(stateMachine, eventBus);

      // Request "wave" animation (mapped to celebrating, 2000ms)
      const waveConfig = HARMLESS_ANIMATIONS.wave;
      const result = animationManager.requestAnimation({
        id: "wave",
        state: waveConfig.state,
        durationMs: waveConfig.durationMs,
        priority: STATE_PRIORITIES[waveConfig.state],
        returnState: "idle",
      });

      expect(result.accepted).toBe(true);
      expect(stateMachine.currentState).toBe("celebrating");
      expect(animationManager.currentAnimation?.id).toBe("wave");

      // Advance by 2010ms -> animation completes, restores idle
      vi.advanceTimersByTime(2010);
      expect(animationManager.currentAnimation).toBeNull();
      expect(stateMachine.currentState).toBe("idle");

      animationManager.dispose();
      stateMachine.dispose();
    });
  });

  describe("Requirement R2: Single Click Native Context Menu", () => {
    it("creates native menu template with exact 5 items and zero AI/API calls", () => {
      const mockWindow = {
        isDestroyed: vi.fn(() => false),
        showInactive: vi.fn(),
      } as unknown as BrowserWindow;

      const mockCompanionWindow = {
        isDestroyed: vi.fn(() => false),
        hide: vi.fn(),
      } as unknown as BrowserWindow;

      const mockOverlay = {
        setPanelOpen: vi.fn(),
      } as unknown as OverlayController;

      const publish = vi.fn();

      const template = createCompanionContextMenuTemplate({
        window: mockWindow,
        companionWindow: mockCompanionWindow,
        overlay: mockOverlay,
        publish,
      });

      // Verify exact 5 items
      expect(template.length).toBe(5);
      const labels = template.map((item) => item.label);
      expect(labels).toEqual([
        "Open Milo",
        "Milo Room",
        "Customize",
        "Settings",
        "Hide Milo",
      ]);

      // Item 1: Open Milo
      template[0].click?.({} as any, mockCompanionWindow, {} as any);
      expect(mockOverlay.setPanelOpen).toHaveBeenCalledWith(true);
      expect(mockWindow.showInactive).toHaveBeenCalledTimes(1);
      expect(publish).toHaveBeenCalledTimes(1);

      // Item 2: Milo Room
      template[1].click?.({} as any, mockCompanionWindow, {} as any);
      expect(mockOverlay.setPanelOpen).toHaveBeenCalledWith(true);
      expect(mockWindow.showInactive).toHaveBeenCalledTimes(2);

      // Item 3: Customize
      template[2].click?.({} as any, mockCompanionWindow, {} as any);
      expect(mockOverlay.setPanelOpen).toHaveBeenCalledWith(true);

      // Item 4: Settings
      template[3].click?.({} as any, mockCompanionWindow, {} as any);
      expect(mockOverlay.setPanelOpen).toHaveBeenCalledWith(true);

      // Item 5: Hide Milo
      template[4].click?.({} as any, mockCompanionWindow, {} as any);
      expect(mockCompanionWindow.hide).toHaveBeenCalledTimes(1);
    });
  });

  describe("IPC Validation: triggerCharacterActionInputSchema", () => {
    it("validates valid triggerCharacterAction inputs", () => {
      expect(parseTriggerCharacterActionInput({ action: "drag_start" })).toEqual({
        action: "drag_start",
      });

      expect(
        parseTriggerCharacterActionInput({
          action: "drag_move",
          deltaX: 15,
          deltaY: -25,
        }),
      ).toEqual({
        action: "drag_move",
        deltaX: 15,
        deltaY: -25,
      });

      expect(parseTriggerCharacterActionInput({ action: "drag_end" })).toEqual({
        action: "drag_end",
      });

      expect(parseTriggerCharacterActionInput({ action: "look_around" })).toEqual({
        action: "look_around",
      });

      expect(
        parseTriggerCharacterActionInput({
          action: "play_animation",
          animationName: "tiny_dance",
        }),
      ).toEqual({
        action: "play_animation",
        animationName: "tiny_dance",
      });
    });

    it("rejects invalid delta values and out-of-range numbers", () => {
      expect(() =>
        parseTriggerCharacterActionInput({
          action: "drag_move",
          deltaX: 5000, // exceeds 2000
          deltaY: 0,
        }),
      ).toThrow(RequestValidationError);

      expect(() =>
        parseTriggerCharacterActionInput({
          action: "drag_move",
          deltaX: NaN,
          deltaY: 0,
        }),
      ).toThrow(RequestValidationError);

      expect(() =>
        parseTriggerCharacterActionInput({
          action: "drag_move",
          deltaX: Infinity,
          deltaY: 0,
        }),
      ).toThrow(RequestValidationError);
    });

    it("rejects unknown actions or extra unexpected properties", () => {
      expect(() =>
        parseTriggerCharacterActionInput({ action: "hack_system" }),
      ).toThrow(RequestValidationError);

      expect(() =>
        parseTriggerCharacterActionInput({
          action: "drag_start",
          extraMaliciousProp: true,
        }),
      ).toThrow(RequestValidationError);
    });
  });
});
