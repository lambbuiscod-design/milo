import { describe, expect, it } from "vitest";
import { clientAnalyticsEventSchema } from "@/lib/analytics-contract";

describe("privacy-safe client analytics contract", () => {
  it("accepts only browser-observable events with bounded properties", () => {
    expect(
      clientAnalyticsEventSchema.safeParse({
        event: "reply_copied",
        category: "safe",
      }).success,
    ).toBe(true);
    expect(
      clientAnalyticsEventSchema.safeParse({
        event: "paywall_viewed",
        surface: "analysis_limit",
      }).success,
    ).toBe(true);
  });

  it.each([
    "signup_completed",
    "analysis_started",
    "analysis_completed",
    "analysis_failed",
    "feedback_submitted",
    "checkout_started",
    "subscription_started",
    "subscription_cancelled",
  ])("rejects spoofed server-authoritative event %s", (event) => {
    expect(clientAnalyticsEventSchema.safeParse({ event }).success).toBe(false);
  });

  it("rejects content and identifying fields instead of persisting them", () => {
    for (const field of [
      "screenshot",
      "originalText",
      "replyText",
      "email",
      "ip",
      "stripePayload",
    ]) {
      expect(
        clientAnalyticsEventSchema.safeParse({
          event: "reply_copied",
          category: "playful",
          [field]: "sensitive",
        }).success,
      ).toBe(false);
    }
  });
});
