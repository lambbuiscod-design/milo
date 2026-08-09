import { describe, expect, it } from "vitest";
import { canAnalyze, FREE_LIFETIME_ALLOWANCE, PAID_MONTHLY_ALLOWANCE, remainingAnalyses } from "@/lib/entitlements";

describe("entitlements", () => {
  it("allows exactly five successful free analyses", () => {
    expect(remainingAnalyses({ subscriptionStatus: "none", used: 0 })).toBe(FREE_LIFETIME_ALLOWANCE);
    expect(canAnalyze({ subscriptionStatus: "none", used: 4 })).toBe(true);
    expect(canAnalyze({ subscriptionStatus: "none", used: 5 })).toBe(false);
  });
  it("allows 150 analyses in an active paid period", () => {
    expect(remainingAnalyses({ subscriptionStatus: "active", used: 0 })).toBe(PAID_MONTHLY_ALLOWANCE);
    expect(canAnalyze({ subscriptionStatus: "active", used: 149 })).toBe(true);
    expect(canAnalyze({ subscriptionStatus: "active", used: 150 })).toBe(false);
  });
  it("does not treat past-due or canceled subscriptions as paid", () => {
    expect(remainingAnalyses({ subscriptionStatus: "past_due", used: 2 })).toBe(3);
    expect(remainingAnalyses({ subscriptionStatus: "canceled", used: 5 })).toBe(0);
  });
});
