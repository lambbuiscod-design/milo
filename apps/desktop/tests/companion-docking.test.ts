import { describe, expect, it } from "vitest";
import { resolveCompanionDockPosition } from "../src/shared/companion-docking";

describe("companion docking", () => {
  const workArea = { x: -1920, y: 40, width: 1920, height: 1040 };
  const size = { width: 250, height: 300 };

  it.each([
    ["top-left", { x: -1896, y: 64 }],
    ["top-right", { x: -274, y: 64 }],
    ["bottom-left", { x: -1896, y: 756 }],
    ["bottom-right", { x: -274, y: 756 }],
  ] as const)("resolves %s within the selected display work area", (mode, expected) => {
    expect(resolveCompanionDockPosition(mode, workArea, size)).toEqual(expected);
  });

  it("does not move free or legacy follow-window positions", () => {
    expect(resolveCompanionDockPosition("free", workArea, size)).toBeNull();
    expect(resolveCompanionDockPosition("follow-window", workArea, size)).toBeNull();
  });
});
