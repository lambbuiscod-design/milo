import { describe, expect, it } from "vitest";
import {
  isCompleteTotpCode,
  normalizeTotpCode,
  requiresMfaChallenge,
  safeFactorLabel,
} from "@/lib/supabase/mfa";

describe("MFA assurance", () => {
  it("requires step-up only when a verified factor can reach AAL2", () => {
    expect(requiresMfaChallenge({ currentLevel: "aal1", nextLevel: "aal2" })).toBe(true);
    expect(requiresMfaChallenge({ currentLevel: null, nextLevel: "aal2" })).toBe(true);
    expect(requiresMfaChallenge({ currentLevel: "aal2", nextLevel: "aal2" })).toBe(false);
    expect(requiresMfaChallenge({ currentLevel: "aal1", nextLevel: "aal1" })).toBe(false);
    expect(requiresMfaChallenge({ currentLevel: "aal2", nextLevel: "aal1" })).toBe(false);
  });
});

describe("TOTP input", () => {
  it("keeps only the first six digits", () => {
    expect(normalizeTotpCode(" 12-34a5678 ")).toBe("123456");
  });

  it("accepts exactly six digits", () => {
    expect(isCompleteTotpCode("123456")).toBe(true);
    expect(isCompleteTotpCode("12345")).toBe(false);
    expect(isCompleteTotpCode("12345a")).toBe(false);
  });
});

describe("factor labels", () => {
  it("uses a safe fallback and limits provider-controlled labels", () => {
    expect(safeFactorLabel({}, 1)).toBe("Authenticator 2");
    expect(safeFactorLabel({ friendly_name: `  ${"a".repeat(100)}  ` }, 0)).toHaveLength(80);
  });
});
