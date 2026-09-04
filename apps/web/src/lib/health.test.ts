import { describe, expect, it } from "vitest";
import { isRuntimeReady, type RuntimeReadiness } from "@/lib/health";

const ready: RuntimeReadiness = {
  openRouterKey: true,
  rateLimitSecret: true,
  stripePrice: true,
  stripeSecret: true,
  stripeWebhookSecret: true,
  supabaseAdmin: true,
  supabasePublic: true,
};

describe("runtime readiness", () => {
  it("requires every production dependency without exposing its value", () => {
    expect(isRuntimeReady(ready)).toBe(true);
    expect(isRuntimeReady({ ...ready, supabaseAdmin: false })).toBe(false);
    expect(isRuntimeReady({ ...ready, stripeWebhookSecret: false })).toBe(false);
  });
});
