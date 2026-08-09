// @vitest-environment node

import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");

function source(path: string) {
  return readFileSync(resolve(root, path), "utf8");
}

describe("analytics authority boundaries", () => {
  it("accepts client events only through the strict, rate-limited endpoint", () => {
    const route = source("src/app/api/events/route.ts");
    expect(route).toContain("clientAnalyticsEventSchema.safeParse");
    expect(route).toContain("consumeDistributedRateLimit");
    expect(route).toContain('.eq("user_id", user.id)');
    expect(route).toContain('.eq("status", "completed")');
    expect(route).toContain("usage.remaining > 0");
  });

  it("records authoritative analysis, feedback and subscription transitions in Postgres", () => {
    const migration = source(
      "supabase/migrations/20260802090540_privacy_safe_analytics.sql",
    );
    for (const event of [
      "analysis_started",
      "analysis_failed",
      "feedback_submitted",
      "subscription_started",
      "subscription_cancelled",
    ]) {
      expect(migration).toContain(`'${event}'`);
    }
    expect(migration).toContain("on conflict do nothing");
    expect(migration).toContain("delete from public.analytics_events;");
    expect(migration).toContain("properties - 'category' = '{}'::jsonb");
    expect(migration).toContain("properties - 'surface' = '{}'::jsonb");
    expect(migration).not.toContain("jsonb_object_length");
    expect(migration).toContain("new.cancel_at_period_end");
    expect(migration).not.toContain("reply_text");
    expect(migration).not.toContain("optional_context");
  });

  it("validates the advertised Stripe price before creating billing state", () => {
    const checkout = source("src/app/api/billing/checkout/route.ts");
    const priceCheck = checkout.indexOf("stripe.prices.retrieve(priceId)");
    const customerCreation = checkout.indexOf("await getOrCreateCustomer(");
    expect(priceCheck).toBeGreaterThan(-1);
    expect(checkout).toContain("isExpectedMiloMonthlyPrice(configuredPrice)");
    expect(customerCreation).toBeGreaterThan(-1);
    expect(priceCheck).toBeLessThan(customerCreation);
    expect(checkout).toContain('eventName: "checkout_started"');
  });

  it("records the actual exhausted-plan view before client navigation", () => {
    const coach = source("src/components/coach-workspace.tsx");
    expect(coach).toContain('event: "paywall_viewed"');
    expect(coach).toContain('surface: "analysis_limit"');
    expect(coach).toContain("keepalive: true");
    expect(coach.indexOf('fetch("/api/events"')).toBeLessThan(
      coach.indexOf('window.location.assign("/account?upgrade=1")'),
    );
  });

  it("orders analytics after the remotely applied MFA repair migration", () => {
    const migrations = readdirSync(resolve(root, "supabase/migrations"))
      .filter((file) => file.endsWith(".sql"))
      .sort();
    expect(migrations.indexOf("20260802090540_privacy_safe_analytics.sql")).toBeGreaterThan(
      migrations.indexOf("20260802083145_repair_mfa_rls_factor_lookup.sql"),
    );
  });
});
