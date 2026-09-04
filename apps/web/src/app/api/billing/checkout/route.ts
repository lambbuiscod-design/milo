import type Stripe from "stripe";
import { getMfaAuthState, type MiloUser } from "@/lib/auth";
import { recordAnalyticsEvent } from "@/lib/analytics";
import {
  hasExistingStripeSubscription,
  isExpectedMiloMonthlyPrice,
  isStripeResourceMissingError,
  nextBillingCustomerRevision,
  stripeCustomerIdempotencyKey,
} from "@/lib/billing";
import { env } from "@/lib/env";
import { isE2EMode } from "@/lib/runtime-mode";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { rejectCrossOriginMutation } from "@/lib/http-security";
import { operationalErrorType } from "@/lib/operational-error";

export const runtime = "nodejs";

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

type BillingProfile = {
  billing_customer_revision: number;
  deleted_at: string | null;
  stripe_customer_id: string | null;
};

function accountRedirect(query: string) {
  return Response.redirect(new URL(`/account?${query}`, env.NEXT_PUBLIC_APP_URL), 303);
}

async function getOrCreateCustomer(
  stripe: NonNullable<ReturnType<typeof getStripe>>,
  admin: AdminClient,
  user: MiloUser,
) {
  async function readProfile() {
    const { data, error } = await admin
      .from("profiles")
      .select("stripe_customer_id,billing_customer_revision,deleted_at")
      .eq("id", user.id)
      .maybeSingle();
    if (error || !data) throw new Error("BILLING_PROFILE_UNAVAILABLE");
    return data as BillingProfile;
  }

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const profile = await readProfile();
    if (profile.deleted_at) throw new Error("BILLING_PROFILE_DELETION_PENDING");

    if (profile.stripe_customer_id) {
      let customerMissing = false;
      try {
        const customer = await stripe.customers.retrieve(profile.stripe_customer_id);
        if (!customer.deleted) {
          return {
            customerId: customer.id,
            revision: profile.billing_customer_revision,
          };
        }
        customerMissing = true;
      } catch (error) {
        if (!isStripeResourceMissingError(error)) throw error;
        customerMissing = true;
      }

      if (customerMissing) {
        const nextRevision = nextBillingCustomerRevision(
          profile.billing_customer_revision,
        );
        const { error: clearError } = await admin
          .from("profiles")
          .update({
            billing_customer_revision: nextRevision,
            stripe_customer_id: null,
          })
          .eq("id", user.id)
          .eq("stripe_customer_id", profile.stripe_customer_id)
          .eq("billing_customer_revision", profile.billing_customer_revision)
          .is("deleted_at", null);
        if (clearError) throw new Error("BILLING_CUSTOMER_RECOVERY_FAILED");
        continue;
      }
    }

    const revision = profile.billing_customer_revision;
    const customer = await stripe.customers.create(
      {
        email: user.email ?? undefined,
        metadata: {
          billing_customer_revision: String(revision),
          milo_product: "plus",
          supabase_user_id: user.id,
        },
      },
      { idempotencyKey: stripeCustomerIdempotencyKey(user.id, revision) },
    );

    const { data: linkedProfile, error: linkError } = await admin
      .from("profiles")
      .update({ stripe_customer_id: customer.id })
      .eq("id", user.id)
      .eq("billing_customer_revision", revision)
      .is("stripe_customer_id", null)
      .is("deleted_at", null)
      .select("stripe_customer_id,billing_customer_revision")
      .maybeSingle();
    if (linkError) throw new Error("BILLING_CUSTOMER_LINK_FAILED");
    if (linkedProfile?.stripe_customer_id) {
      return {
        customerId: linkedProfile.stripe_customer_id as string,
        revision: linkedProfile.billing_customer_revision as number,
      };
    }
  }

  throw new Error("BILLING_CUSTOMER_RECOVERY_FAILED");
}

function sessionContainsPrice(session: Stripe.Checkout.Session, priceId: string) {
  return Boolean(
    session.line_items?.data.some((lineItem) => {
      if (!lineItem.price) return false;
      return typeof lineItem.price === "string"
        ? lineItem.price === priceId
        : lineItem.price.id === priceId;
    }),
  );
}

async function recordCheckoutStarted(
  admin: AdminClient,
  userId: string,
  stripeSessionId: string,
) {
  try {
    await recordAnalyticsEvent(admin, {
      userId,
      eventName: "checkout_started",
      dedupeSource: `stripe-session:${stripeSessionId}`,
    });
  } catch (error) {
    console.error("[billing/checkout] analytics failed", {
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
  }
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
  const user = auth.user;

  if (isE2EMode()) {
    const { activateE2EPlus } = await import("@/lib/e2e-mocks");
    activateE2EPlus(user.id);
    return accountRedirect("checkout=success");
  }

  const stripe = getStripe();
  const admin = createAdminClient();
  const priceId = env.STRIPE_PRICE_ID;
  if (!stripe || !admin || !priceId) return accountRedirect("billing=unavailable");

  try {
    const configuredPrice = await stripe.prices.retrieve(priceId);
    if (!isExpectedMiloMonthlyPrice(configuredPrice)) {
      throw new Error("BILLING_PRICE_CONFIGURATION_INVALID");
    }

    const { customerId, revision: customerRevision } = await getOrCreateCustomer(
      stripe,
      admin,
      user,
    );
    const [subscriptions, sessions] = await Promise.all([
      stripe.subscriptions.list({ customer: customerId, status: "all", limit: 100 }),
      stripe.checkout.sessions.list({
        customer: customerId,
        limit: 100,
        expand: ["data.line_items"],
      }),
    ]);

    if (hasExistingStripeSubscription(subscriptions.data.map(({ status }) => status))) {
      return accountRedirect("billing=existing");
    }

    const miloSessions = sessions.data.filter(
      (session) =>
        session.client_reference_id === user.id ||
        session.metadata?.supabase_user_id === user.id,
    );
    const reusableSession = miloSessions.find(
      (session) =>
        session.status === "open" &&
        session.mode === "subscription" &&
        Boolean(session.url) &&
        sessionContainsPrice(session, priceId),
    );
    if (reusableSession?.url) {
      await recordCheckoutStarted(admin, user.id, reusableSession.id);
      return Response.redirect(reusableSession.url, 303);
    }

    // Chaining the key to the latest attempt gives concurrent requests the
    // same Session while allowing a new Session after an old one expires.
    const latestAttemptId = miloSessions[0]?.id ?? "initial";
    const session = await stripe.checkout.sessions.create(
      {
        mode: "subscription",
        customer: customerId,
        client_reference_id: user.id,
        line_items: [{ price: priceId, quantity: 1 }],
        allow_promotion_codes: true,
        success_url: `${env.NEXT_PUBLIC_APP_URL}/account?checkout=success`,
        cancel_url: `${env.NEXT_PUBLIC_APP_URL}/account?checkout=cancelled`,
        subscription_data: {
          metadata: {
            billing_customer_revision: String(customerRevision),
            milo_product: "plus",
            supabase_user_id: user.id,
          },
        },
        metadata: {
          billing_customer_revision: String(customerRevision),
          milo_product: "plus",
          price_id: priceId,
          supabase_user_id: user.id,
        },
      },
      { idempotencyKey: `milo-checkout-v1:${user.id}:${latestAttemptId}` },
    );

    if (!session.url) throw new Error("CHECKOUT_URL_MISSING");
    await recordCheckoutStarted(admin, user.id, session.id);
    return Response.redirect(session.url, 303);
  } catch (error) {
    console.error("[billing/checkout] failed", {
      type: operationalErrorType(error),
    });
    return accountRedirect("billing=unavailable");
  }
}
