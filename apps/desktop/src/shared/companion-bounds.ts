import type { Point, Rectangle, Size } from "./position";

export const MIN_COMPANION_PEEK_PX = 25;
export const DEFAULT_COMPANION_SIZE: Size = Object.freeze({ width: 250, height: 300 });

export interface CompanionClampingBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

/**
 * Calculates screen clamping bounds allowing at least minPeek pixels to remain visible on-screen.
 */
export function calculateCompanionBounds(
  size: Size,
  workArea: Rectangle,
  minPeek = MIN_COMPANION_PEEK_PX,
): CompanionClampingBounds {
  const peekX = Math.max(0, Math.min(minPeek, size.width));
  const peekY = Math.max(0, Math.min(minPeek, size.height));

  const minX = Math.round(workArea.x - size.width + peekX);
  const maxX = Math.max(minX, Math.round(workArea.x + workArea.width - peekX));
  const minY = Math.round(workArea.y - size.height + peekY);
  const maxY = Math.max(minY, Math.round(workArea.y + workArea.height - peekY));

  return { minX, maxX, minY, maxY };
}

/**
 * Clamps companion window position to satisfy Requirement R4 (25px edge peeking).
 */
export function clampWithEdgePeeking(
  position: Point,
  size: Size,
  workArea: Rectangle,
  minPeek = MIN_COMPANION_PEEK_PX,
): Point {
  const { minX, maxX, minY, maxY } = calculateCompanionBounds(size, workArea, minPeek);
  const rawX = Number.isFinite(position.x) ? Math.round(position.x) : workArea.x;
  const rawY = Number.isFinite(position.y) ? Math.round(position.y) : workArea.y;

  return {
    x: Math.min(maxX, Math.max(minX, rawX)),
    y: Math.min(maxY, Math.max(minY, rawY)),
  };
}

/**
 * Calculates centered position on a display's workArea for fallback recovery (Requirement R3).
 */
export function calculateCenteredPosition(size: Size, workArea: Rectangle): Point {
  const targetX = Math.round(workArea.x + (workArea.width - size.width) / 2);
  const targetY = Math.round(workArea.y + (workArea.height - size.height) / 2);
  return clampWithEdgePeeking({ x: targetX, y: targetY }, size, workArea, MIN_COMPANION_PEEK_PX);
}
