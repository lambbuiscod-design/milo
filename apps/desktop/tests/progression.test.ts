import { describe, expect, it } from "vitest";
import { requiredLevelForReward, rewardsUnlockedThroughLevel } from "../src/shared/progression";

describe("local progression rewards", () => {
  it("unlocks deterministic rewards by level", () => {
    expect(rewardsUnlockedThroughLevel(1)).toEqual(["fur-charcoal", "animation-calm", "room-plant"]);
    expect(rewardsUnlockedThroughLevel(2)).toContain("fur-slate");
    expect(rewardsUnlockedThroughLevel(2)).not.toContain("room-lamp");
  });

  it("reports requirements without treating unknown content as a reward", () => {
    expect(requiredLevelForReward("animation-sleepy")).toBe(6);
    expect(requiredLevelForReward("private-transcript")).toBeNull();
  });
});
