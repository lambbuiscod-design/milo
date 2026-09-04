import type { NudgePositionInput, PanelPlacement } from "./contracts";

export type Point = Readonly<{ x: number; y: number }>;
export type Size = Readonly<{ width: number; height: number }>;
export type Rectangle = Readonly<Point & Size>;

function finite(value: number): number {
  return Number.isFinite(value) ? Math.round(value) : 0;
}

export function clampPosition(position: Point, size: Size, workArea: Rectangle): Point {
  const minX = finite(workArea.x);
  const minY = finite(workArea.y);
  const maxX = Math.max(minX, finite(workArea.x + workArea.width - size.width));
  const maxY = Math.max(minY, finite(workArea.y + workArea.height - size.height));
  return {
    x: Math.min(maxX, Math.max(minX, finite(position.x))),
    y: Math.min(maxY, Math.max(minY, finite(position.y))),
  };
}

export function defaultOverlayPosition(size: Size, workArea: Rectangle, margin = 24): Point {
  return clampPosition(
    {
      x: workArea.x + workArea.width - size.width - margin,
      y: workArea.y + workArea.height - size.height - margin,
    },
    size,
    workArea,
  );
}

export function nudgePosition(position: Point, input: NudgePositionInput): Point {
  const delta = {
    up: { x: 0, y: -input.step },
    right: { x: input.step, y: 0 },
    down: { x: 0, y: input.step },
    left: { x: -input.step, y: 0 },
  }[input.direction];
  return { x: position.x + delta.x, y: position.y + delta.y };
}

export function fitExpandedSize(preferred: Size, workArea: Rectangle): Size {
  return {
    width: Math.max(1, Math.min(preferred.width, workArea.width)),
    height: Math.max(1, Math.min(preferred.height, workArea.height)),
  };
}

export function resolvePanelBounds(
  anchor: Rectangle,
  expandedSize: Size,
  workArea: Rectangle,
): { bounds: Rectangle; placement: PanelPlacement } {
  const opensRight = anchor.x + expandedSize.width <= workArea.x + workArea.width;
  const opensDown = anchor.y + expandedSize.height <= workArea.y + workArea.height;
  const placement: PanelPlacement = `${opensRight ? "right" : "left"}-${
    opensDown ? "down" : "up"
  }`;
  const candidate = {
    x: opensRight ? anchor.x : anchor.x + anchor.width - expandedSize.width,
    y: opensDown ? anchor.y : anchor.y + anchor.height - expandedSize.height,
  };
  const position = clampPosition(candidate, expandedSize, workArea);
  return {
    placement,
    bounds: { ...position, ...expandedSize },
  };
}

export function anchorFromExpandedBounds(
  bounds: Rectangle,
  collapsedSize: Size,
  placement: PanelPlacement,
): Point {
  return {
    x: placement.startsWith("left") ? bounds.x + bounds.width - collapsedSize.width : bounds.x,
    y: placement.endsWith("up") ? bounds.y + bounds.height - collapsedSize.height : bounds.y,
  };
}

