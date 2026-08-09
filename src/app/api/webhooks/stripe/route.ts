import type Stripe from "stripe";
import {
  isStripeResourceMissingError,
  isTerminalStripeSubscriptionStatus,
  shouldReplaceStoredSubscription,
} from "@/lib/billing";
import { env } from "@/lib/env";
import { getStripe } from "@/lib/stripe";
import {
  getStripeEventReceiptState,
  isDuplicateStripeEventError,
  STRIPE_EVENT_IN_PROGRESS_STATUS,
} from "@/lib/stripe-webhook";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  readTextWithinLimit,
  requestBodyErrorResponse,
} from "@/lib/http-security";
import { operationalErrorType } from "@/lib/operational-error";

export const runtime = "nodejs";

const SUBSCRIPTION_EVENT_TYPES = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;
type StripeClient = NonNullable<ReturnType<typeof getStripe>>;

function stripeCustomerId(subscription: Stripe.Subscription) {
  return typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer.id;
}

function stripePriceId(item: Stripe.SubscriptionItem) {
  return typeof item.price === "string" ? item.price : item.price.id;
}

function isUuid(value: string | undefined): value is string {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      ),
  );
}

function billingCustomerRevision(subscription: Stripe.Subscription) {
  const revision = Number(subscription.metadata.billing_customer_revision ?? "0");
  if (!Number.isInteger(revision) || revision < 0) {
    throw new Error("STRIPE_CUSTOMER_REVISION_INVALID");
  }
  return revision;
}

async function linkCustomerToUser(
  admin: AdminClient,
  userId: string,
  customerId: string,
  customerRevision: number,
) {
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id,stripe_customer_id,billing_customer_revision,deleted_at")
    .eq("id", userId)
    .maybeSingle();
  if (profileError || !profile) throw new Error("STRIPE_USER_PROFILE_NOT_FOUND");
  if (profile.deleted_at) throw new Error("STRIPE_USER_PROFILE_DELETING");
  if (profile.billing_customer_revision !== customerRevision) {
    throw new Error("STRIPE_CUSTOMER_REVISION_STALE");
  }
  if (profile.stripe_customer_id && profile.stripe_customer_id !== customerId) {
    throw new Error("STRIPE_CUSTOMER_REPLACED");
  }
  if (profile.stripe_customer_id === customerId) return;

  const { data: linked, error: linkError } = await admin
    .from("profiles")
    .update({ stripe_customer_id: customerId })
    .eq("id", userId)
    .eq("billing_customer_revision", customerRevision)
    .is("stripe_customer_id", null)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (linkError) throw new Error("STRIPE_CUSTOMER_LINK_FAILED");
  if (linked) return;

  const { data: concurrentlyLinked, error: concurrentError } = await admin
    .from("profiles")
    .select("stripe_customer_id,billing_customer_revision,deleted_at")
    .eq("id", userId)
    .maybeSingle();
  if (
    concurrentError ||
    concurrentlyLinked?.deleted_at ||
    concurrentlyLinked?.billing_customer_revision !== customerRevision ||
    concurrentlyLinked?.stripe_customer_id !== customerId
  ) {
    throw new Error("STRIPE_CUSTOMER_LINK_FAILED");
  }
}

async function resolveUserId(
  admin: AdminClient,
  subscription: Stripe.Subscription,
  existingUserId?: string,
) {
  const customerId = stripeCustomerId(subscription);
  const metadataUserId = isUuid(subscription.metadata.supabase_user_id)
    ? subscription.metadata.supabase_user_id
    : undefined;
  const { data: customerProfile, error: customerProfileError } = await admin
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (customerProfileError) throw customerProfileError;

  const candidates = [existingUserId, customerProfile?.id as string | undefined, metadataUserId].filter(
    Boolean,
  ) as string[];
  const userId = candidates[0];
  if (!userId) throw new Error("STRIPE_USER_NOT_LINKED");
  if (candidates.some((candidate) => candidate !== userId)) {
    throw new Error("STRIPE_CUSTOMER_USER_CONFLICT");
  }

  await linkCustomerToUser(
    admin,
    userId,
    customerId,
    billingCustomerRevision(subscription),
  );
  return userId;
}

async function revokeKnownSubscription(admin: AdminClient, stripeSubscriptionId: string) {
  const { error } = await admin
    .from("subscriptions")
    .update({
      cancel_at_period_end: false,
      status: "canceled",
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", stripeSubscriptionId);
  if (error) throw error;
}

async function retrieveSubscriptionOrRevoke(
  stripe: StripeClient,
  admin: AdminClient,
  stripeSubscriptionId: string,
) {
  try {
    return await stripe.subscriptions.retrieve(stripeSubscriptionId);
  } catch (error) {
    if (!isStripeResourceMissingError(error)) throw error;
    // The Stripe object is gone, so no paid entitlement can still exist.
    // Revoke any known local row and acknowledge delayed post-deletion events.
    await revokeKnownSubscription(admin, stripeSubscriptionId);
    return null;
  }
}

async function persistSubscription(
  admin: AdminClient,
  subscription: Stripe.Subscription,
  item: Stripe.SubscriptionItem,
  userId: string,
) {
  const { error } = await admin.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_subscription_id: subscription.id,
      stripe_price_id: stripePriceId(item),
      status: subscription.status,
      current_period_start: new Date(item.current_period_start * 1000).toISOString(),
      current_period_end: new Date(item.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}

async function syncSubscription(
  stripe: StripeClient,
  admin: AdminClient,
  subscription: Stripe.Subscription,
) {
  const expectedItem = subscription.items.data.find(
    (item) => stripePriceId(item) === env.STRIPE_PRICE_ID,
  );
  const { data: knownSubscription, error: knownSubscriptionError } = await admin
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_subscription_id", subscription.id)
    .maybeSingle();
  if (knownSubscriptionError) throw knownSubscriptionError;

  const isMiloSubscription =
    Boolean(expectedItem) ||
    subscription.metadata.milo_product === "plus" ||
    Boolean(knownSubscription);
  if (!isMiloSubscription) return;

  const item = expectedItem ?? subscription.items.data[0];
  if (!item) throw new Error("STRIPE_SUBSCRIPTION_ITEM_MISSING");
  let userId: string;
  try {
    userId = await resolveUserId(
      admin,
      subscription,
      knownSubscription?.user_id as string | undefined,
    );
  } catch (error) {
    // Account deletion removes the profile immediately after synchronously
    // cancelling Stripe. A delayed terminal webhook for that deleted customer
    // is complete by definition and must not retry forever.
    const terminalNoOpErrors = new Set([
      "STRIPE_CUSTOMER_REPLACED",
      "STRIPE_CUSTOMER_REVISION_STALE",
      "STRIPE_USER_NOT_LINKED",
      "STRIPE_USER_PROFILE_DELETING",
      "STRIPE_USER_PROFILE_NOT_FOUND",
    ]);
    if (
      error instanceof Error &&
      terminalNoOpErrors.has(error.message) &&
      isTerminalStripeSubscriptionStatus(subscription.status)
    ) {
      return;
    }
    throw error;
  }
  const { data: stored, error: storedError } = await admin
    .from("subscriptions")
    .select("stripe_subscription_id,status")
    .eq("user_id", userId)
    .maybeSingle();
  if (storedError) throw storedError;

  let effectiveStored = stored as {
    stripe_subscription_id: string;
    status: string;
  } | null;
  if (effectiveStored && effectiveStored.stripe_subscription_id !== subscription.id) {
    // Stripe does not guarantee event order. Refresh the currently stored
    // subscription so an old event cannot win merely because it arrived last.
    const currentStoredSubscription = await retrieveSubscriptionOrRevoke(
      stripe,
      admin,
      effectiveStored.stripe_subscription_id,
    );
    if (!currentStoredSubscription) {
      effectiveStored = {
        stripe_subscription_id: effectiveStored.stripe_subscription_id,
        status: "canceled",
      };
    } else {
      const currentStoredItem =
        currentStoredSubscription.items.data.find(
          (storedItem) => stripePriceId(storedItem) === env.STRIPE_PRICE_ID,
        ) ?? currentStoredSubscription.items.data[0];
      if (!currentStoredItem) throw new Error("STRIPE_SUBSCRIPTION_ITEM_MISSING");
      await persistSubscription(
        admin,
        currentStoredSubscription,
        currentStoredItem,
        userId,
      );
      effectiveStored = {
        stripe_subscription_id: currentStoredSubscription.id,
        status: currentStoredSubscription.status,
      };
    }
  }

  if (!shouldReplaceStoredSubscription(effectiveStored, subscription)) return;
  await persistSubscription(admin, subscription, item, userId);
}

async function claimStripeEvent(admin: AdminClient, event: Stripe.Event) {
  const { error: insertError } = await admin
    .from("stripe_events")
    .insert({ id: event.id, event_type: event.type });
  if (!insertError) return "claimed" as const;
  if (!isDuplicateStripeEventError(insertError)) throw insertError;

  const { data: receipt, error: receiptError } = await admin
    .from("stripe_events")
    .select("received_at,processed_at")
    .eq("id", event.id)
    .maybeSingle();
  if (receiptError || !receipt) throw receiptError ?? new Error("STRIPE_RECEIPT_MISSING");

  const state = getStripeEventReceiptState(receipt);
  if (state !== "retry") return state;

  // Atomically renew an expired processing lease. Concurrent retries use the
  // exact prior timestamp as a compare-and-swap condition, so only one wins.
  const claimedAt = new Date().toISOString();
  const { data: renewed, error: renewError } = await admin
    .from("stripe_events")
    .update({ received_at: claimedAt })
    .eq("id", event.id)
    .eq("received_at", receipt.received_at)
    .is("processed_at", null)
    .select("id")
    .maybeSingle();
  if (renewError) throw renewError;
  return renewed ? ("claimed" as const) : ("processing" as const);
}

async function processStripeEvent(
  stripe: StripeClient,
  admin: AdminClient,
  event: Stripe.Event,
) {
  if (SUBSCRIPTION_EVENT_TYPES.has(event.type)) {
    const snapshot = event.data.object as Stripe.Subscription;
    const subscription = await retrieveSubscriptionOrRevoke(stripe, admin, snapshot.id);
    if (!subscription) return;
    await syncSubscription(stripe, admin, subscription);
    return;
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.mode !== "subscription" || !session.subscription) return;
    const subscriptionId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription.id;
    const subscription = await retrieveSubscriptionOrRevoke(
      stripe,
      admin,
      subscriptionId,
    );
    if (!subscription) return;
    await syncSubscription(stripe, admin, subscription);
  }
}

export async function POST(request: Request) {
  const stripe = getStripe();
  const admin = createAdminClient();
  if (!stripe || !admin || !env.STRIPE_WEBHOOK_SECRET) {
    return Response.json({ error: "Stripe webhook is not configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "Missing signature" }, { status: 400 });

  let event: Stripe.Event;
  let rawBody: string;
  try {
    rawBody = await readTextWithinLimit(request, 1_000_000);
  } catch (error) {
    return requestBodyErrorResponse(error, "Webhook payload is too large") ??
      Response.json({ error: "Invalid webhook payload" }, { status: 400 });
  }
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    const claim = await claimStripeEvent(admin, event);
    if (claim === "processed") {
      return Response.json({ received: true, duplicate: true });
    }
    if (claim === "processing") {
      // Stripe considers every 2xx response permanently delivered. Return a
      // retryable status while another worker owns the short processing lease;
      // the next delivery will observe either a completed receipt or reclaim a
      // stale lease after a crashed worker.
      return Response.json(
        { received: false, processing: true },
        { status: STRIPE_EVENT_IN_PROGRESS_STATUS },
      );
    }

    await processStripeEvent(stripe, admin, event);
    const { data: completed, error: completedError } = await admin
      .from("stripe_events")
      .update({ processed_at: new Date().toISOString() })
      .eq("id", event.id)
      .is("processed_at", null)
      .select("id")
      .maybeSingle();
    if (completedError || !completed) {
      throw completedError ?? new Error("STRIPE_RECEIPT_COMPLETE_FAILED");
    }
    return Response.json({ received: true });
  } catch (error) {
    console.error("[stripe/webhook] failed", {
      eventId: event.id,
      type: event.type,
      errorType: operationalErrorType(error),
    });
    return Response.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
