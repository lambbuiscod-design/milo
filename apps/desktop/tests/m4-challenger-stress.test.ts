import { describe, expect, it, vi } from "vitest";
import {
  ClickDisambiguator,
  calculatePupilOffset,
  MAX_PUPIL_OFFSET_X,
  MAX_PUPIL_OFFSET_Y,
  CLICK_DELAY_MS,
  DOUBLE_CLICK_COOLDOWN_MS,
  DRAG_DISTANCE_THRESHOLD,
  HOLD_DURATION_THRESHOLD_MS,
} from "../src/shared/contracts";

/**
 * Headless Companion Pointer Interaction State Machine
 * Mirrors the exact logic in useCompanionInteraction (apps/desktop/src/renderer/companion.tsx)
 * to allow deterministic testing of drag thresholds, hold timers, and click disambiguation.
 */
class CompanionPointerTestDriver {
  isPointerDown = false;
  dragActive = false;
  dragThresholdPassed = false;
  startPos: { clientX: number; clientY: number } | null = null;
  lastPos: { clientX: number; clientY: number } | null = null;
  holdTimer: ReturnType<typeof setTimeout> | null = null;

  readonly actionsTriggered: string[] = [];
  readonly contextMenusOpened: number[] = [];
  readonly doubleClicksTriggered: string[] = [];

  readonly disambiguator: ClickDisambiguator;

  constructor() {
    this.disambiguator = new ClickDisambiguator({
      onSingleClick: () => {
        this.contextMenusOpened.push(Date.now());
      },
      onDoubleClick: (animationName) => {
        this.doubleClicksTriggered.push(animationName);
        this.actionsTriggered.push(`play_animation:${animationName}`);
      },
    });
  }

  pointerDown(x: number, y: number): void {
    this.isPointerDown = true;
    this.dragActive = false;
    this.dragThresholdPassed = false;
    this.startPos = { clientX: x, clientY: y };
    this.lastPos = { clientX: x, clientY: y };

    if (this.holdTimer !== null) {
      clearTimeout(this.holdTimer);
    }
    this.holdTimer = setTimeout(() => {
      if (this.isPointerDown && !this.dragActive) {
        this.dragActive = true;
        this.dragThresholdPassed = true;
        this.disambiguator.cancelPendingClick();
        this.actionsTriggered.push("drag_start");
      }
    }, HOLD_DURATION_THRESHOLD_MS);
  }

  pointerMove(x: number, y: number): void {
    if (this.isPointerDown && !this.dragActive) {
      const start = this.startPos;
      if (start) {
        const dist = Math.hypot(x - start.clientX, y - start.clientY);
        if (dist > DRAG_DISTANCE_THRESHOLD) {
          if (this.holdTimer !== null) {
            clearTimeout(this.holdTimer);
            this.holdTimer = null;
          }
          this.dragActive = true;
          this.dragThresholdPassed = true;
          this.disambiguator.cancelPendingClick();
          this.actionsTriggered.push("drag_start");
        }
      }
    }

    if (this.dragActive) {
      const last = this.lastPos ?? { clientX: x, clientY: y };
      const deltaX = x - last.clientX;
      const deltaY = y - last.clientY;
      this.lastPos = { clientX: x, clientY: y };
      if (deltaX !== 0 || deltaY !== 0) {
        this.actionsTriggered.push(`drag_move:${deltaX},${deltaY}`);
      }
    }
  }

  pointerUp(): void {
    if (this.holdTimer !== null) {
      clearTimeout(this.holdTimer);
      this.holdTimer = null;
    }

    if (this.dragActive) {
      this.dragActive = false;
      this.actionsTriggered.push("drag_end");
    } else if (!this.dragThresholdPassed) {
      this.disambiguator.registerClick();
    }

    this.isPointerDown = false;
    this.startPos = null;
    this.lastPos = null;
  }

  dispose(): void {
    if (this.holdTimer !== null) {
      clearTimeout(this.holdTimer);
      this.holdTimer = null;
    }
    this.disambiguator.dispose();
  }
}

describe("Milestone 4 Challenger Stress Tests: Timing, Disambiguation, and Cooldown", () => {
  describe("Adversarial Stress Test 1: Rapid-Fire Click Bursts (100 clicks @ 10ms intervals)", () => {
    it("cooldown blocks all spam and executes only 1 animation per 1500ms window", () => {
      vi.useFakeTimers();
      const onSingleClick = vi.fn();
      const onDoubleClick = vi.fn();
      const disambiguator = new ClickDisambiguator({
        onSingleClick,
        onDoubleClick,
        clickDelayMs: CLICK_DELAY_MS,
        doubleClickCooldownMs: DOUBLE_CLICK_COOLDOWN_MS,
      });

      // Burst 1: 100 rapid clicks at 10ms intervals (t = 0 to t = 990ms)
      const results: string[] = [];
      for (let i = 0; i < 100; i++) {
        const timestamp = i * 10;
        const res = disambiguator.registerClick(timestamp);
        results.push(res);
      }

      // Check results distribution
      // Click 0 (t=0): single_queued
      // Click 1 (t=10): double_triggered (1st double click)
      // Clicks 2..99: even clicks queue single, odd clicks clear timer and get blocked by cooldown
      expect(results[0]).toBe("single_queued");
      expect(results[1]).toBe("double_triggered");
      const cooldownBlocked = results.filter((r) => r === "double_cooldown_blocked");
      expect(cooldownBlocked.length).toBe(49);
      expect(onDoubleClick).toHaveBeenCalledTimes(1);

      // Advance by 1000ms (to t = 1990ms, beyond the 100 clicks and past click delay)
      vi.advanceTimersByTime(1000);

      // Single click should NOT have executed because click 99 was blocked and canceled click 98's timer
      expect(onSingleClick).toHaveBeenCalledTimes(0);
      expect(onDoubleClick).toHaveBeenCalledTimes(1);

      // Second burst in a new cooldown window: t = 2000ms (> 1500ms since t = 10ms)
      // Another 100 rapid clicks at 10ms intervals (t = 2000ms to t = 2990ms)
      for (let i = 0; i < 100; i++) {
        const timestamp = 2000 + i * 10;
        disambiguator.registerClick(timestamp);
      }

      // In this new 1500ms window, exactly 1 more double click animation executes
      expect(onDoubleClick).toHaveBeenCalledTimes(2);

      // Advance timers by 2000ms
      vi.advanceTimersByTime(2000);
      expect(onSingleClick).toHaveBeenCalledTimes(0);
      expect(onDoubleClick).toHaveBeenCalledTimes(2);

      disambiguator.dispose();
      vi.useRealTimers();
    });

    it("continuous rapid clicking across 3000ms triggers exactly 2 animations across two 1500ms windows", () => {
      vi.useFakeTimers();
      const onSingleClick = vi.fn();
      const onDoubleClick = vi.fn();
      const disambiguator = new ClickDisambiguator({
        onSingleClick,
        onDoubleClick,
        clickDelayMs: 250,
        doubleClickCooldownMs: 1500,
      });

      // 300 clicks at 10ms intervals: t = 0 to 2990ms
      for (let i = 0; i < 300; i++) {
        disambiguator.registerClick(i * 10);
      }

      // First animation at t = 10ms
      // Second animation at t = 1510ms or 1520ms (first pair where dt >= 1500ms)
      // Total animations must be exactly 2
      expect(onDoubleClick).toHaveBeenCalledTimes(2);
      expect(onSingleClick).toHaveBeenCalledTimes(0);

      disambiguator.dispose();
      vi.useRealTimers();
    });
  });

  describe("Adversarial Stress Test 2: Click Disambiguation Boundary Timing (240ms, 250ms, 260ms, 300ms)", () => {
    it("at 240ms: fires double-click and completely cancels single-click", () => {
      vi.useFakeTimers();
      const onSingleClick = vi.fn();
      const onDoubleClick = vi.fn();
      const disambiguator = new ClickDisambiguator({
        onSingleClick,
        onDoubleClick,
        clickDelayMs: 250,
      });

      // First click at t=0
      expect(disambiguator.registerClick(0)).toBe("single_queued");
      vi.advanceTimersByTime(240);
      expect(onSingleClick).not.toHaveBeenCalled();

      // Second click at t=240ms (< 250ms delay)
      expect(disambiguator.registerClick(240)).toBe("double_triggered");
      expect(onDoubleClick).toHaveBeenCalledTimes(1);

      // Advance well past 250ms to verify single click was canceled
      vi.advanceTimersByTime(500);
      expect(onSingleClick).not.toHaveBeenCalled();
      expect(onDoubleClick).toHaveBeenCalledTimes(1);

      disambiguator.dispose();
      vi.useRealTimers();
    });

    it("at 250ms: boundary arrival fires 1st single-click, and 2nd click registers as fresh single-click", () => {
      vi.useFakeTimers();
      const onSingleClick = vi.fn();
      const onDoubleClick = vi.fn();
      const disambiguator = new ClickDisambiguator({
        onSingleClick,
        onDoubleClick,
        clickDelayMs: 250,
      });

      // First click at t=0
      expect(disambiguator.registerClick(0)).toBe("single_queued");

      // Advance by exactly 250ms -> 1st single click timer expires and fires
      vi.advanceTimersByTime(250);
      expect(onSingleClick).toHaveBeenCalledTimes(1);
      expect(onDoubleClick).not.toHaveBeenCalled();

      // Second click arrives at t=250ms
      expect(disambiguator.registerClick(250)).toBe("single_queued");
      expect(onDoubleClick).not.toHaveBeenCalled();

      // Advance by another 250ms -> 2nd single click timer expires and fires
      vi.advanceTimersByTime(250);
      expect(onSingleClick).toHaveBeenCalledTimes(2);
      expect(onDoubleClick).not.toHaveBeenCalled();

      disambiguator.dispose();
      vi.useRealTimers();
    });

    it("at 260ms: fires 1st single-click at 250ms, then 2nd click at 260ms fires 2nd single-click at 510ms", () => {
      vi.useFakeTimers();
      const onSingleClick = vi.fn();
      const onDoubleClick = vi.fn();
      const disambiguator = new ClickDisambiguator({
        onSingleClick,
        onDoubleClick,
        clickDelayMs: 250,
      });

      // First click at t=0
      disambiguator.registerClick(0);
      vi.advanceTimersByTime(250);
      expect(onSingleClick).toHaveBeenCalledTimes(1);

      // Advance 10ms to t=260ms
      vi.advanceTimersByTime(10);
      expect(disambiguator.registerClick(260)).toBe("single_queued");

      // Advance 250ms more to t=510ms
      vi.advanceTimersByTime(250);
      expect(onSingleClick).toHaveBeenCalledTimes(2);
      expect(onDoubleClick).not.toHaveBeenCalled();

      disambiguator.dispose();
      vi.useRealTimers();
    });

    it("at 300ms: fires 1st single-click at 250ms, then 2nd click at 300ms fires 2nd single-click at 550ms", () => {
      vi.useFakeTimers();
      const onSingleClick = vi.fn();
      const onDoubleClick = vi.fn();
      const disambiguator = new ClickDisambiguator({
        onSingleClick,
        onDoubleClick,
        clickDelayMs: 250,
      });

      // First click at t=0
      disambiguator.registerClick(0);
      vi.advanceTimersByTime(250);
      expect(onSingleClick).toHaveBeenCalledTimes(1);

      // Advance 50ms to t=300ms
      vi.advanceTimersByTime(50);
      expect(disambiguator.registerClick(300)).toBe("single_queued");

      // Advance 250ms to t=550ms
      vi.advanceTimersByTime(250);
      expect(onSingleClick).toHaveBeenCalledTimes(2);
      expect(onDoubleClick).not.toHaveBeenCalled();

      disambiguator.dispose();
      vi.useRealTimers();
    });
  });

  describe("Adversarial Stress Test 3: Drag Cancellation Threshold (1px, 4px, 5px, 6px)", () => {
    it("movements of 1px, 4px, 5px allow click events (<= 5px threshold)", () => {
      vi.useFakeTimers();

      const testThresholdMovement = (dx: number, dy: number) => {
        const driver = new CompanionPointerTestDriver();
        driver.pointerDown(100, 100);
        driver.pointerMove(100 + dx, 100 + dy);
        driver.pointerUp();

        // Check drag_start was NOT called
        expect(driver.actionsTriggered).not.toContain("drag_start");

        // Advance timers by 300ms for single click
        vi.advanceTimersByTime(300);
        expect(driver.contextMenusOpened.length).toBe(1);
        driver.dispose();
      };

      // 1px movement -> click allowed
      testThresholdMovement(1, 0);

      // 4px movement -> click allowed
      testThresholdMovement(4, 0);

      // 5px movement (hypot(3, 4) = 5.0) -> boundary <= 5px -> click allowed
      testThresholdMovement(3, 4);

      vi.useRealTimers();
    });

    it("movement of 6px (> 5px threshold) triggers drag_start and suppresses all click events", () => {
      vi.useFakeTimers();
      const driver = new CompanionPointerTestDriver();

      driver.pointerDown(100, 100);
      driver.pointerMove(106, 100); // 6px movement > 5px threshold

      expect(driver.actionsTriggered).toContain("drag_start");
      expect(driver.dragActive).toBe(true);

      driver.pointerUp();
      expect(driver.actionsTriggered).toContain("drag_end");

      // Advance timers by 500ms
      vi.advanceTimersByTime(500);

      // Verify ZERO context menu and ZERO animations were triggered
      expect(driver.contextMenusOpened.length).toBe(0);
      expect(driver.doubleClicksTriggered.length).toBe(0);

      driver.dispose();
      vi.useRealTimers();
    });

    it("movement of 6px returning to start position before release still suppresses click", () => {
      vi.useFakeTimers();
      const driver = new CompanionPointerTestDriver();

      driver.pointerDown(100, 100);
      driver.pointerMove(106, 100); // Exceeds threshold
      expect(driver.actionsTriggered).toContain("drag_start");

      // Move back to initial coordinates (100, 100)
      driver.pointerMove(100, 100);
      driver.pointerUp();

      expect(driver.actionsTriggered).toContain("drag_end");

      // Advance past disambiguation timer
      vi.advanceTimersByTime(500);
      expect(driver.contextMenusOpened.length).toBe(0);

      driver.dispose();
      vi.useRealTimers();
    });

    it("hold duration > 160ms with 0px movement activates drag and suppresses click", () => {
      vi.useFakeTimers();
      const driver = new CompanionPointerTestDriver();

      driver.pointerDown(100, 100);

      // Hold for 170ms (> HOLD_DURATION_THRESHOLD_MS of 160ms)
      vi.advanceTimersByTime(170);

      expect(driver.actionsTriggered).toContain("drag_start");
      expect(driver.dragActive).toBe(true);

      driver.pointerUp();
      expect(driver.actionsTriggered).toContain("drag_end");

      vi.advanceTimersByTime(500);
      expect(driver.contextMenusOpened.length).toBe(0);

      driver.dispose();
      vi.useRealTimers();
    });
  });

  describe("Adversarial Stress Test 4: Gaze Vector Tracking Extreme Values (-10,000, +10,000, NaN, Infinity)", () => {
    it("handles extreme coordinates -10,000 and +10,000 clamping strictly to ±3.5px X and ±2.5px Y", () => {
      const farNegative = calculatePupilOffset({ x: -10000, y: -10000 });
      expect(farNegative.x).toBe(-MAX_PUPIL_OFFSET_X);
      expect(farNegative.y).toBe(-MAX_PUPIL_OFFSET_Y);
      expect(farNegative.x).toBeGreaterThanOrEqual(-3.5);
      expect(farNegative.x).toBeLessThanOrEqual(3.5);
      expect(farNegative.y).toBeGreaterThanOrEqual(-2.5);
      expect(farNegative.y).toBeLessThanOrEqual(2.5);

      const farPositive = calculatePupilOffset({ x: 10000, y: 10000 });
      expect(farPositive.x).toBe(MAX_PUPIL_OFFSET_X);
      expect(farPositive.y).toBe(MAX_PUPIL_OFFSET_Y);
      expect(farPositive.x).toBeGreaterThanOrEqual(-3.5);
      expect(farPositive.x).toBeLessThanOrEqual(3.5);
      expect(farPositive.y).toBeGreaterThanOrEqual(-2.5);
      expect(farPositive.y).toBeLessThanOrEqual(2.5);
    });

    it("handles Infinity and -Infinity without throwing and clamps strictly to ±3.5px X and ±2.5px Y", () => {
      expect(() => calculatePupilOffset({ x: Infinity, y: Infinity })).not.toThrow();
      const posInf = calculatePupilOffset({ x: Infinity, y: Infinity });
      expect(posInf.x).toBe(MAX_PUPIL_OFFSET_X);
      expect(posInf.y).toBe(MAX_PUPIL_OFFSET_Y);

      expect(() => calculatePupilOffset({ x: -Infinity, y: -Infinity })).not.toThrow();
      const negInf = calculatePupilOffset({ x: -Infinity, y: -Infinity });
      expect(negInf.x).toBe(-MAX_PUPIL_OFFSET_X);
      expect(negInf.y).toBe(-MAX_PUPIL_OFFSET_Y);
    });

    it("evaluates behavior on NaN input coordinates: does not throw, produces NaN", () => {
      // Must not throw an unhandled exception
      expect(() => calculatePupilOffset({ x: NaN, y: NaN })).not.toThrow();
      const nanOffset = calculatePupilOffset({ x: NaN, y: NaN });

      // Document empirical finding: calculatePupilOffset returns NaN when given NaN coordinates
      expect(Number.isNaN(nanOffset.x)).toBe(true);
      expect(Number.isNaN(nanOffset.y)).toBe(true);
    });
  });
});
