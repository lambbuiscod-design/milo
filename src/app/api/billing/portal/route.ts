import type Stripe from "stripe";
import { getMfaAuthState } from "@/lib/auth";
import {
  isStripeResourceMissingError,
  nextBillingCustomerRevision,
} from "@/lib/billing";
import { env } from "@/lib/env";
import { rejectCrossOriginMutation } from "@/lib/http-security";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { operationalErrorType } from "@/lib/operational-error";

export const runtime = "nodejs";

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;
type StripeClient = NonNullable<ReturnType<typeof getStripe>>;

type BillingProfile = {
  billing_customer_revision: number;
  deleted_at: string | null;
  stripe_customer_id: string | null;
};

type StoredSubscription = {
  status: string;
  stripe_subscription_id: string;
};

function accountRedirect(query: string) {
  return Response.redirect(new URL(`/account?${query}`, env.NEXT_PUBLIC_APP_URL), 303);
}

function subscriptionCustomerId(subscription: Stripe.Subscription) {
  return typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer.id;
}

async function readBillingRecords(admin: AdminClient, userId: string) {
  const [profileResult, subscriptionResult] = await Promise.all([
    admin
      .from("profiles")
      .select("stripe_customer_id,billing_customer_revision,deleted_at")
      .eq("id", userId)
      .maybeSingle(),
    admin
      .from("subscriptions")
      .select("stripe_subscription_id,status")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  if (profileResult.error || !profileResult.data || subscriptionResult.error) {
    throw new Error("BILLING_RECORDS_UNAVAILABLE");
  }
  return {
    profile: profileResult.data as BillingProfile,
    subscription: subscriptionResult.data as StoredSubscription | null,
  };
}

async function advanceRevisionAndClearCustomer(
  admin: AdminClient,
  userId: string,
  profile: BillingProfile,
) {
  const nextRevision = nextBillingCustomerRevision(profile.billing_customer_revision);
  let query = admin
    .from("profiles")
    .update({
      billing_customer_revision: nextRevision,
      stripe_customer_id: null,
    })
    .eq("id", userId)
    .eq("billing_customer_revision", profile.billing_customer_revision)
    .is("deleted_at", null);
  query = profile.stripe_customer_id
    ? query.eq("stripe_customer_id", profile.stripe_customer_id)
    : query.is("stripe_customer_id", null);
  const { data, error } = await query
    .select("stripe_customer_id,billing_customer_revision,deleted_at")
    .maybeSingle();
  if (error) throw new Error("BILLING_CUSTOMER_RECOVERY_FAILED");
  if (data) return data as BillingProfile;

  const current = await readBillingRecords(admin, userId);
  if (current.profile.deleted_at) throw new Error("BILLING_PROFILE_DELETION_PENDING");
  return current.profile;
}

async function revokeMissingSubscription(
  admin: AdminClient,
  stripeSubscriptionId: string,
) {
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

async function retrieveCustomer(
  stripe: StripeClient,
  customerId: string,
) {
  try {
    const customer = await stripe.customers.retrieve(customerId);
    return customer.deleted ? null : customer;
  } catch (error) {
    if (isStripeResourceMissingError(error)) return null;
    throw error;
  }
}

async function recoverCustomerFromSubscription(
  stripe: StripeClient,
  admin: AdminClient,
  userId: string,
  profile: BillingProfile,
  stored: StoredSubscription,
) {
  let subscription: Stripe.Subscription;
  try {
    subscription = await stripe.subscriptions.retrieve(stored.stripe_subscription_id);
  } catch (error) {
    if (!isStripeResourceMissingError(error)) throw error;
    await revokeMissingSubscription(admin, stored.stripe_subscription_id);
    await advanceRevisionAndClearCustomer(admin, userId, profile);
    return null;
  }

  const customerId = subscriptionCustomerId(subscription);
  const customer = await retrieveCustomer(stripe, customerId);
  if (!customer) {
    await revokeMissingSubscription(admin, stored.stripe_subscription_id);
    await advanceRevisionAndClearCustomer(admin, userId, profile);
    return null;
  }

  const metadataRevision = Number(
    subscription.metadata.billing_customer_revision ?? "0",
  );
  if (
    !profile.stripe_customer_id &&
    Number.isInteger(metadataRevision) &&
    metadataRevision === profile.billing_customer_revision
  ) {
    const { error: linkError } = await admin
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", userId)
      .eq("billing_customer_revision", profile.billing_customer_revision)
      .is("stripe_customer_id", null)
      .is("deleted_at", null);
    if (linkError) throw linkError;
  }
  return customer;
}

export async function POST(request: Request) {
  const originError = rejectCrossOriginMutation(request);
  if (originError) return originError;

  const auth = await getMfaAuthState();
  if (auth.status === "unauthenticated") {
    return Response.redirect(new URL("/login?next=/account", env.NEXT_PUBLIC_APP_URL), 303);
  }
  if (auth.status === "ineligible") {
    return Response.redirect(
      new URL("/login?error=account_ineligible", env.NEXT_PUBLIC_APP_URL),
      303,
    );
  }
  if (auth.status !== "authorized") {
    const unavailable = auth.status === "unavailable" ? "&status=unavailable" : "";
    return Response.redirect(
      new URL(`/mfa?next=/account${unavailable}`, env.NEXT_PUBLIC_APP_URL),
      303,
    );
  }

  const stripe = getStripe();
  const admin = createAdminClient();
  if (!stripe || !admin) return accountRedirect("billing=unavailable");

  try {
    const { profile: initialProfile, subscription } = await readBillingRecords(
      admin,
      auth.user.id,
    );
    if (initialProfile.deleted_at) return accountRedirect("billing=unavailable");

    let profile = initialProfile;
    let customer = profile.stripe_customer_id
      ? await retrieveCustomer(stripe, profile.stripe_customer_id)
      : null;
    if (profile.stripe_customer_id && !customer) {
      profile = await advanceRevisionAndClearCustomer(admin, auth.user.id, profile);
    }
    if (!customer && subscription) {
      customer = await recoverCustomerFromSubscription(
        stripe,
        admin,
        auth.user.id,
        profile,
        subscription,
      );
    }
    if (!customer) return accountRedirect("billing=missing");

    const session = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      locale: "auto",
      return_url: `${env.NEXT_PUBLIC_APP_URL}/account`,
    });
    return Response.redirect(session.url, 303);
  } catch (error) {
    console.error("[billing/portal] failed", {
      type: operationalErrorType(error),
    });
    return accountRedirect("billing=unavailable");
  }
}
