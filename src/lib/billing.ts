const TERMINAL_SUBSCRIPTION_STATUSES = new Set(["canceled", "incomplete_expired"]);
const MAX_POSTGRES_INTEGER = 2_147_483_647;

export const MILO_MONTHLY_PRICE_EUR_CENTS = 599;

export function isExpectedMiloMonthlyPrice(price: {
  active: boolean;
  currency: string;
  type: string;
  unit_amount?: number | null;
  recurring?: { interval: string; interval_count: number } | null;
}) {
  return (
    price.active &&
    price.currency.toLowerCase() === "eur" &&
    price.type === "recurring" &&
    price.unit_amount === MILO_MONTHLY_PRICE_EUR_CENTS &&
    price.recurring?.interval === "month" &&
    price.recurring.interval_count === 1
  );
}

export function isTerminalStripeSubscriptionStatus(status: string) {
  return TERMINAL_SUBSCRIPTION_STATUSES.has(status);
}

export function hasExistingStripeSubscription(statuses: string[]) {
  return statuses.some((status) => !isTerminalStripeSubscriptionStatus(status));
}

export function shouldOfferBillingPortal(
  hasLinkedCustomer: boolean,
  subscriptionStatuses: string[],
) {
  return hasLinkedCustomer || hasExistingStripeSubscription(subscriptionStatuses);
}

export function shouldOfferStripeUpgrade(subscriptionStatuses: string[]) {
  return !hasExistingStripeSubscription(subscriptionStatuses);
}

export function nextBillingCustomerRevision(currentRevision: number) {
  if (
    !Number.isInteger(currentRevision) ||
    currentRevision < 0 ||
    currentRevision >= MAX_POSTGRES_INTEGER
  ) {
    throw new Error("BILLING_CUSTOMER_REVISION_INVALID");
  }
  return currentRevision + 1;
}

export function stripeCustomerIdempotencyKey(userId: string, revision: number) {
  if (!Number.isInteger(revision) || revision < 0) {
    throw new Error("BILLING_CUSTOMER_REVISION_INVALID");
  }
  return `milo-customer-v2:${userId}:${revision}`;
}

export function isStripeResourceMissingError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    code?: unknown;
    raw?: { code?: unknown };
  };
  return candidate.code === "resource_missing" || candidate.raw?.code === "resource_missing";
}

export function getStripeSubscriptionIdsToCancel(
  subscriptions: Array<{ id: string; status: string }>,
) {
  return subscriptions
    .filter((subscription) => !isTerminalStripeSubscriptionStatus(subscription.status))
    .map((subscription) => subscription.id);
}

export function shouldReplaceStoredSubscription(
  stored: { stripe_subscription_id: string; status: string } | null,
  incoming: { id: string; status: string },
) {
  if (!stored || stored.stripe_subscription_id === incoming.id) return true;

  // For different IDs, only move from a terminal subscription to a current,
  // potentially billable one. This prevents delayed events for an old
  // subscription and duplicate active subscriptions from oscillating the row.
  return (
    isTerminalStripeSubscriptionStatus(stored.status) &&
    !isTerminalStripeSubscriptionStatus(incoming.status)
  );
}
