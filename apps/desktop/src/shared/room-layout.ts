import type { Point, Size } from "./position";

export function clampRoomItemPosition(x: number, y: number, stage: Size, item: Size): Point {
  const maxX = Math.max(0, stage.width - item.width);
  const maxY = Math.max(0, stage.height - item.height);
  return {
    x: Math.round(Math.max(0, Math.min(maxX, x))),
    y: Math.round(Math.max(0, Math.min(maxY, y))),
  };
}
