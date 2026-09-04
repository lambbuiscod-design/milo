export const FREE_LIFETIME_ALLOWANCE = 5;
export const PAID_MONTHLY_ALLOWANCE = 150;

export type SubscriptionState = "active" | "trialing" | "past_due" | "canceled" | "none";

export function isPaidSubscription(status: SubscriptionState) {
  return status === "active" || status === "trialing";
}

export function remainingAnalyses(input: {
  subscriptionStatus: SubscriptionState;
  used: number;
}) {
  const allowance = isPaidSubscription(input.subscriptionStatus)
    ? PAID_MONTHLY_ALLOWANCE
    : FREE_LIFETIME_ALLOWANCE;
  return Math.max(0, allowance - Math.max(0, input.used));
}

export function canAnalyze(input: { subscriptionStatus: SubscriptionState; used: number }) {
  return remainingAnalyses(input) > 0;
}
