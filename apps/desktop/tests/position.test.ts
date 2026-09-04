import { describe, expect, it } from "vitest";
import {
  anchorFromExpandedBounds,
  clampPosition,
  fitExpandedSize,
  resolvePanelBounds,
} from "../src/shared/position";

describe("monitor-safe overlay geometry", () => {
  it("clamps negative-coordinate and oversized positions inside a work area", () => {
    const workArea = { x: -1920, y: 0, width: 1920, height: 1040 };
    expect(clampPosition({ x: -3000, y: -40 }, { width: 168, height: 174 }, workArea)).toEqual({
      x: -1920,
      y: 0,
    });
    expect(clampPosition({ x: 500, y: 2000 }, { width: 168, height: 174 }, workArea)).toEqual({
      x: -168,
      y: 866,
    });
  });

  it("fits the expanded panel in small device-independent work areas", () => {
    expect(fitExpandedSize({ width: 372, height: 540 }, { x: 0, y: 0, width: 960, height: 500 })).toEqual({
      width: 372,
      height: 500,
    });
  });

  it("opens left and up near the bottom-right edge and preserves the cat anchor", () => {
    const anchor = { x: 1720, y: 860, width: 168, height: 174 };
    const resolved = resolvePanelBounds(anchor, { width: 372, height: 540 }, { x: 0, y: 0, width: 1920, height: 1040 });
    expect(resolved.placement).toBe("left-up");
    expect(resolved.bounds).toEqual({ x: 1516, y: 494, width: 372, height: 540 });
    expect(anchorFromExpandedBounds(resolved.bounds, { width: 168, height: 174 }, resolved.placement)).toEqual({
      x: 1720,
      y: 860,
    });
  });

  it.each([1, 1.25, 1.5, 1.75, 2])(
    "keeps the complete panel inside a monitor work area at %sx Windows scale",
    (scale) => {
      const workArea = {
        x: scale >= 1.5 ? -Math.round(1920 / scale) : 100,
        y: 40,
        width: Math.round(1920 / scale),
        height: Math.round(1000 / scale),
      };
      const size = fitExpandedSize({ width: 372, height: 540 }, workArea);
      const anchor = {
        x: workArea.x + workArea.width - 168,
        y: workArea.y + workArea.height - 174,
        width: 168,
        height: 174,
      };
      const { bounds } = resolvePanelBounds(anchor, size, workArea);

      expect(bounds.x).toBeGreaterThanOrEqual(workArea.x);
      expect(bounds.y).toBeGreaterThanOrEqual(workArea.y);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(workArea.x + workArea.width);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(workArea.y + workArea.height);
    },
  );
});
