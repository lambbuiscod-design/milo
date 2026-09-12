import type { DockMode } from "./contracts";
import type { Point, Rectangle, Size } from "./position";

const DEFAULT_DOCK_MARGIN = 24;

export function resolveCompanionDockPosition(
  mode: DockMode,
  workArea: Rectangle,
  size: Size,
  margin = DEFAULT_DOCK_MARGIN,
): Point | null {
  if (mode === "free" || mode === "follow-window") return null;

  const safeMargin = Math.max(0, Math.round(margin));
  const left = workArea.x + safeMargin;
  const right = workArea.x + Math.max(safeMargin, workArea.width - size.width - safeMargin);
  const top = workArea.y + safeMargin;
  const bottom = workArea.y + Math.max(safeMargin, workArea.height - size.height - safeMargin);

  return {
    x: mode.endsWith("left") ? left : right,
    y: mode.startsWith("top") ? top : bottom,
  };
}
