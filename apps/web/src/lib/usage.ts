import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isE2EMode } from "@/lib/runtime-mode";
import { FREE_LIFETIME_ALLOWANCE, PAID_MONTHLY_ALLOWANCE } from "@/lib/entitlements";
import { env } from "@/lib/env";

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

export async function getUsageForUser(userId: string) {
  if (isE2EMode()) {
    const { getE2EUsageState } = await import("@/lib/e2e-mocks");
    return getE2EUsageState(userId);
  }
  const admin = createAdminClient();
  if (!admin) return { plan: "unconfigured" as const, allowance: FREE_LIFETIME_ALLOWANCE, used: 0, remaining: FREE_LIFETIME_ALLOWANCE };

  const now = new Date().toISOString();
  const subscriptionRequest = env.STRIPE_PRICE_ID
    ? admin
        .from("subscriptions")
        .select("status,current_period_start,current_period_end,stripe_price_id")
        .eq("user_id", userId)
        .eq("stripe_price_id", env.STRIPE_PRICE_ID)
        .in("status", ["active", "trialing"])
        .lte("current_period_start", now)
        .gt("current_period_end", now)
        .maybeSingle()
    : Promise.resolve({ data: null, error: null });

  const [subscriptionResult, freeUsageResult] = await Promise.all([
    subscriptionRequest,
    admin
      .from("usage_periods")
      .select("used")
      .eq("user_id", userId)
      .eq("period_start", "1970-01-01T00:00:00.000Z")
      .maybeSingle(),
  ]);

  if (subscriptionResult.error || freeUsageResult.error) {
    throw new Error("Unable to verify the user's analysis allowance.");
  }

  const subscription = subscriptionResult.data;

  if (
    subscription &&
    env.STRIPE_PRICE_ID &&
    subscription.stripe_price_id === env.STRIPE_PRICE_ID &&
    ACTIVE_STATUSES.has(subscription.status) &&
    subscription.current_period_start <= now &&
    subscription.current_period_end > now
  ) {
    const { data: period, error: periodError } = await admin
      .from("usage_periods")
      .select("used")
      .eq("user_id", userId)
      .eq("period_start", subscription.current_period_start)
      .maybeSingle();
    if (periodError) throw new Error("Unable to verify the user's paid usage period.");
    const used = period?.used ?? 0;
    return { plan: "plus" as const, allowance: PAID_MONTHLY_ALLOWANCE, used, remaining: Math.max(0, PAID_MONTHLY_ALLOWANCE - used) };
  }

  const used = freeUsageResult.data?.used ?? 0;
  return { plan: "free" as const, allowance: FREE_LIFETIME_ALLOWANCE, used, remaining: Math.max(0, FREE_LIFETIME_ALLOWANCE - used) };
}
