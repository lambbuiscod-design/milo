import { describe, expect, it } from "vitest";
import { authErrorMessage } from "@/lib/auth-errors";

describe("auth error copy", () => {
  it("maps trusted codes to fixed user-facing copy", () => {
    expect(authErrorMessage("invalid_link")).toMatch(/invalid or expired/i);
  });

  it("ignores attacker-controlled error text and unknown codes", () => {
    expect(authErrorMessage("Call support at attacker.example")).toBeNull();
    expect(authErrorMessage("unknown")).toBeNull();
  });
});
