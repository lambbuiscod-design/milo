import { cookies } from "next/headers";
import { getMfaAuthState } from "@/lib/auth";
import {
  getStripeSubscriptionIdsToCancel,
  isStripeResourceMissingError,
  nextBillingCustomerRevision,
} from "@/lib/billing";
import { env } from "@/lib/env";
import { rejectCrossOriginMutation } from "@/lib/http-security";
import { isE2EMode, MILO_E2E_AUTH_COOKIE } from "@/lib/runtime-mode";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { operationalErrorType } from "@/lib/operational-error";

export const runtime = "nodejs";

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;
type StripeClient = NonNullable<ReturnType<typeof getStripe>>;

type DeletionProfile = {
  billing_customer_revision: number;
  deleted_at: string | null;
  stripe_customer_id: string | null;
};

async function readDeletionProfile(admin: AdminClient, userId: string) {
  const { data, error } = await admin
    .from("profiles")
    .select("stripe_customer_id,billing_customer_revision,deleted_at")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) throw new Error("ACCOUNT_PROFILE_UNAVAILABLE");
  return data as DeletionProfile;
}

async function markDeletionPending(
  admin: AdminClient,
  userId: string,
  profile: DeletionProfile,
) {
  if (profile.deleted_at) return profile;

  const update = profile.stripe_customer_id
    ? { deleted_at: new Date().toISOString() }
    : {
        billing_customer_revision: nextBillingCustomerRevision(
          profile.billing_customer_revision,
        ),
        deleted_at: new Date().toISOString(),
      };
  let query = admin
    .from("profiles")
    .update(update)
    .eq("id", userId)
    .eq("billing_customer_revision", profile.billing_customer_revision)
    .is("deleted_at", null);
  query = profile.stripe_customer_id
    ? query.eq("stripe_customer_id", profile.stripe_customer_id)
    : query.is("stripe_customer_id", null);

  const { data, error } = await query
    .select("stripe_customer_id,billing_customer_revision,deleted_at")
    .maybeSingle();
  if (error) throw new Error("ACCOUNT_DELETION_MARK_FAILED");
  return data ? (data as DeletionProfile) : readDeletionProfile(admin, userId);
}

async function deleteStripeCustomerAndSubscriptions(
  stripe: StripeClient,
  customerId: string,
) {
  const subscriptions: Array<{ id: string; status: string }> = [];
  try {
    for await (const subscription of stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 100,
    })) {
      subscriptions.push({ id: subscription.id, status: subscription.status });
    }
  } catch (error) {
    if (!isStripeResourceMissingError(error)) throw error;
    // A missing Customer cannot have a billable Subscription. Continue the
    // local saga so an ambiguous prior delete never strands the profile.
    return;
  }

  for (const subscriptionId of getStripeSubscriptionIdsToCancel(subscriptions)) {
    try {
      await stripe.subscriptions.cancel(subscriptionId);
    } catch (error) {
      if (!isStripeResourceMissingError(error)) throw error;
    }
  }

  try {
    await stripe.customers.del(customerId);
  } catch (error) {
    if (!isStripeResourceMissingError(error)) throw error;
  }
}

async function revokeLocalSubscriptions(admin: AdminClient, userId: string) {
  const { data: subscriptions, error: readError } = await admin
    .from("subscriptions")
    .select("id,status")
    .eq("user_id", userId);
  if (readError) throw readError;
  const ids = getStripeSubscriptionIdsToCancel(subscriptions ?? []);
  if (ids.length === 0) return;

  const { error: updateError } = await admin
    .from("subscriptions")
    .update({
      cancel_at_period_end: false,
      status: "canceled",
      updated_at: new Date().toISOString(),
    })
    .in("id", ids);
  if (updateError) throw updateError;
}

async function clearCustomerAndAdvanceRevision(
  admin: AdminClient,
  userId: string,
  profile: DeletionProfile,
) {
  if (!profile.stripe_customer_id) return profile;
  const nextRevision = nextBillingCustomerRevision(profile.billing_customer_revision);
  const { data, error } = await admin
    .from("profiles")
    .update({
      billing_customer_revision: nextRevision,
      stripe_customer_id: null,
    })
    .eq("id", userId)
    .eq("stripe_customer_id", profile.stripe_customer_id)
    .eq("billing_customer_revision", profile.billing_customer_revision)
    .select("stripe_customer_id,billing_customer_revision,deleted_at")
    .maybeSingle();
  if (error) throw new Error("ACCOUNT_BILLING_UNLINK_FAILED");
  if (data) return data as DeletionProfile;

  const current = await readDeletionProfile(admin, userId);
  if (
    current.deleted_at &&
    !current.stripe_customer_id &&
    current.billing_customer_revision >= nextRevision
  ) {
    return current;
  }
  throw new Error("ACCOUNT_BILLING_UNLINK_FAILED");
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
  if (isE2EMode()) {
    const { resetE2EUsage } = await import("@/lib/e2e-mocks");
    resetE2EUsage(auth.user.id);
    const cookieStore = await cookies();
    cookieStore.delete(MILO_E2E_AUTH_COOKIE);
    return Response.redirect(new URL("/?deleted=1", env.NEXT_PUBLIC_APP_URL), 303);
  }

  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) {
    return Response.json({ error: "Account deletion is not configured" }, { status: 503 });
  }

  const user = auth.user;
  try {
    let profile = await readDeletionProfile(admin, user.id);
    profile = await markDeletionPending(admin, user.id, profile);

    if (profile.stripe_customer_id) {
      const stripe = getStripe();
      if (!stripe) {
        return Response.json(
          {
            error:
              "Billing cancellation is temporarily unavailable, so your account was not deleted.",
          },
          { status: 503 },
        );
      }
      await deleteStripeCustomerAndSubscriptions(stripe, profile.stripe_customer_id);
      await revokeLocalSubscriptions(admin, user.id);
      profile = await clearCustomerAndAdvanceRevision(admin, user.id, profile);
    } else {
      await revokeLocalSubscriptions(admin, user.id);
    }

    if (profile.stripe_customer_id) throw new Error("ACCOUNT_BILLING_UNLINK_FAILED");
  } catch (error) {
    console.error("[account/delete] saga failed", {
      errorType: operationalErrorType(error),
    });
    return Response.json(
      {
        error:
          "Could not safely finish billing cancellation, so your account was not deleted. Try again or contact support.",
      },
      { status: 502 },
    );
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    return Response.json(
      { error: "Could not delete the account. Billing is cancelled; retry to finish deletion." },
      { status: 500 },
    );
  }

  // Never destroy the retrying user's session before Auth deletion succeeds.
  const { error: signOutError } = await supabase.auth.signOut({ scope: "global" });
  if (signOutError) {
    console.error("[account/delete] post-delete sign-out failed", {
      errorType: signOutError.name,
    });
  }
  return Response.redirect(new URL("/?deleted=1", env.NEXT_PUBLIC_APP_URL), 303);
}
