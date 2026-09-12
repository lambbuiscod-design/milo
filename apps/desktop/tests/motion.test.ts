import { describe, expect, it } from "vitest";
import { shouldReduceMotion } from "../src/shared/motion";

describe("reduced motion preference", () => {
  it("respects an explicit setting before the Windows setting", () => {
    expect(shouldReduceMotion("reduced", false)).toBe(true);
    expect(shouldReduceMotion("minimal", false)).toBe(true);
    expect(shouldReduceMotion("full", true)).toBe(false);
  });

  it("follows Windows for the system setting", () => {
    expect(shouldReduceMotion("system", true)).toBe(true);
    expect(shouldReduceMotion("system", false)).toBe(false);
  });
});
