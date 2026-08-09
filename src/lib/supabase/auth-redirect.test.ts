import { describe, expect, it } from "vitest";
import { sanitizeAuthDestination } from "@/lib/supabase/auth-redirect";

describe("sanitizeAuthDestination", () => {
  it("preserves valid same-origin paths, queries and fragments", () => {
    expect(sanitizeAuthDestination("/dashboard?tone=warm#upload")).toBe(
      "/dashboard?tone=warm#upload",
    );
    expect(sanitizeAuthDestination("/account")).toBe("/account");
  });

  it.each([
    "https://attacker.example/steal",
    "//attacker.example/steal",
    "/\\attacker.example/steal",
    "/%5cattacker.example/steal",
    "/%2fattacker.example/steal",
    "/%2e%2e//attacker.example/steal",
    "/.%2e//attacker.example/steal",
    "/%252e%252e%252fattacker.example/steal",
    "dashboard",
    "\u0000/dashboard",
  ])("rejects an unsafe redirect destination: %s", (destination) => {
    expect(sanitizeAuthDestination(destination)).toBe("/dashboard");
  });
});
