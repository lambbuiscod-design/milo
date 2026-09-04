import { describe, expect, it } from "vitest";
import {
  getStripeSubscriptionIdsToCancel,
  hasExistingStripeSubscription,
  isExpectedMiloMonthlyPrice,
  isStripeResourceMissingError,
  isTerminalStripeSubscriptionStatus,
  nextBillingCustomerRevision,
  shouldOfferBillingPortal,
  shouldOfferStripeUpgrade,
  shouldReplaceStoredSubscription,
  stripeCustomerIdempotencyKey,
} from "@/lib/billing";

describe("Stripe checkout eligibility", () => {
  it("accepts only the advertised active €5.99 monthly EUR price", () => {
    const expected = {
      active: true,
      currency: "eur",
      type: "recurring",
      unit_amount: 599,
      recurring: { interval: "month", interval_count: 1 },
    };
    expect(isExpectedMiloMonthlyPrice(expected)).toBe(true);
    expect(isExpectedMiloMonthlyPrice({ ...expected, unit_amount: 699 })).toBe(false);
    expect(isExpectedMiloMonthlyPrice({ ...expected, currency: "usd" })).toBe(false);
    expect(
      isExpectedMiloMonthlyPrice({
        ...expected,
        recurring: { interval: "year", interval_count: 1 },
      }),
    ).toBe(false);
    expect(isExpectedMiloMonthlyPrice({ ...expected, active: false })).toBe(false);
  });

  it("blocks a second checkout for non-terminal subscriptions", () => {
    expect(hasExistingStripeSubscription(["active"])).toBe(true);
    expect(hasExistingStripeSubscription(["trialing"])).toBe(true);
    expect(hasExistingStripeSubscription(["past_due"])).toBe(true);
  });

  it("allows resubscription after terminal states", () => {
    expect(hasExistingStripeSubscription([])).toBe(false);
    expect(hasExistingStripeSubscription(["canceled", "incomplete_expired"])).toBe(false);
  });

  it("keeps billing recovery available independently of paid entitlement", () => {
    expect(shouldOfferBillingPortal(true, [])).toBe(true);
    expect(shouldOfferBillingPortal(false, ["past_due"])).toBe(true);
    expect(shouldOfferBillingPortal(false, ["unpaid"])).toBe(true);
    expect(shouldOfferBillingPortal(false, ["incomplete"])).toBe(true);
    expect(shouldOfferBillingPortal(false, ["paused"])).toBe(true);
    expect(shouldOfferBillingPortal(false, ["canceled"])).toBe(false);

    expect(shouldOfferStripeUpgrade([])).toBe(true);
    expect(shouldOfferStripeUpgrade(["canceled"])).toBe(true);
    expect(shouldOfferStripeUpgrade(["past_due"])).toBe(false);
    expect(shouldOfferStripeUpgrade(["active"])).toBe(false);
  });

  it("uses a persisted revision to rotate stable Stripe Customer keys", () => {
    expect(nextBillingCustomerRevision(0)).toBe(1);
    expect(stripeCustomerIdempotencyKey("user-123", 0)).toBe(
      "milo-customer-v2:user-123:0",
    );
    expect(stripeCustomerIdempotencyKey("user-123", 1)).not.toBe(
      stripeCustomerIdempotencyKey("user-123", 0),
    );
    expect(() => nextBillingCustomerRevision(-1)).toThrow(
      "BILLING_CUSTOMER_REVISION_INVALID",
    );
    expect(() => nextBillingCustomerRevision(2_147_483_647)).toThrow(
      "BILLING_CUSTOMER_REVISION_INVALID",
    );
  });

  it("recognizes Stripe resource_missing errors without relying on classes", () => {
    expect(isStripeResourceMissingError({ code: "resource_missing" })).toBe(true);
    expect(isStripeResourceMissingError({ raw: { code: "resource_missing" } })).toBe(true);
    expect(isStripeResourceMissingError({ code: "rate_limit" })).toBe(false);
    expect(isStripeResourceMissingError(null)).toBe(false);
  });

  it("cancels every potentially billable status during account deletion", () => {
    const subscriptions = [
      { id: "sub_trial", status: "trialing" },
      { id: "sub_active", status: "active" },
      { id: "sub_due", status: "past_due" },
      { id: "sub_unpaid", status: "unpaid" },
      { id: "sub_incomplete", status: "incomplete" },
      { id: "sub_paused", status: "paused" },
      { id: "sub_canceled", status: "canceled" },
      { id: "sub_expired", status: "incomplete_expired" },
    ];

    expect(getStripeSubscriptionIdsToCancel(subscriptions)).toEqual([
      "sub_trial",
      "sub_active",
      "sub_due",
      "sub_unpaid",
      "sub_incomplete",
      "sub_paused",
    ]);
    expect(isTerminalStripeSubscriptionStatus("canceled")).toBe(true);
    expect(isTerminalStripeSubscriptionStatus("active")).toBe(false);
  });

  it("does not let a delayed old cancellation replace a current subscription", () => {
    expect(
      shouldReplaceStoredSubscription(
        { stripe_subscription_id: "sub_new", status: "active" },
        { id: "sub_old", status: "canceled" },
      ),
    ).toBe(false);
    expect(
      shouldReplaceStoredSubscription(
        { stripe_subscription_id: "sub_old", status: "canceled" },
        { id: "sub_new", status: "active" },
      ),
    ).toBe(true);
    expect(
      shouldReplaceStoredSubscription(
        { stripe_subscription_id: "sub_same", status: "active" },
        { id: "sub_same", status: "canceled" },
      ),
    ).toBe(true);
    expect(
      shouldReplaceStoredSubscription(
        { stripe_subscription_id: "sub_first", status: "active" },
        { id: "sub_duplicate", status: "active" },
      ),
    ).toBe(false);
  });
});
