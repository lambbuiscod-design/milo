import { describe, expect, it } from "vitest";
import { clampRoomItemPosition } from "../src/shared/room-layout";

describe("room item positioning", () => {
  it("clamps drag positions inside the room stage", () => {
    const stage = { width: 500, height: 200 };
    const item = { width: 54, height: 54 };
    expect(clampRoomItemPosition(-20, 400, stage, item)).toEqual({ x: 0, y: 146 });
    expect(clampRoomItemPosition(445.6, 72.4, stage, item)).toEqual({ x: 446, y: 72 });
  });

  it("stays safe when the stage is smaller than the item", () => {
    expect(clampRoomItemPosition(12, 12, { width: 20, height: 20 }, { width: 54, height: 54 })).toEqual({ x: 0, y: 0 });
  });
});
