import "server-only";
import {
  shouldOfferBillingPortal,
  shouldOfferStripeUpgrade,
} from "@/lib/billing";
import { isE2EMode } from "@/lib/runtime-mode";
import { createAdminClient } from "@/lib/supabase/admin";

export type AccountBillingState = {
  canManage: boolean;
  canUpgrade: boolean;
  configured: boolean;
  hasLinkedCustomer: boolean;
  subscriptionStatuses: string[];
};

export async function getAccountBillingState(userId: string): Promise<AccountBillingState> {
  if (isE2EMode()) {
    const { getE2EUsageState } = await import("@/lib/e2e-mocks");
    const isPlus = getE2EUsageState(userId).plan === "plus";
    return {
      canManage: isPlus,
      canUpgrade: !isPlus,
      configured: true,
      hasLinkedCustomer: isPlus,
      subscriptionStatuses: isPlus ? ["active"] : [],
    };
  }

  const admin = createAdminClient();
  if (!admin) {
    return {
      canManage: false,
      canUpgrade: false,
      configured: false,
      hasLinkedCustomer: false,
      subscriptionStatuses: [],
    };
  }

  const [profileResult, subscriptionsResult] = await Promise.all([
    admin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", userId)
      .maybeSingle(),
    admin.from("subscriptions").select("status").eq("user_id", userId),
  ]);
  if (profileResult.error || !profileResult.data || subscriptionsResult.error) {
    throw new Error("Unable to verify the account billing state.");
  }

  const hasLinkedCustomer = Boolean(profileResult.data.stripe_customer_id);
  const subscriptionStatuses = (subscriptionsResult.data ?? []).map(({ status }) =>
    String(status),
  );
  return {
    canManage: shouldOfferBillingPortal(hasLinkedCustomer, subscriptionStatuses),
    canUpgrade: shouldOfferStripeUpgrade(subscriptionStatuses),
    configured: true,
    hasLinkedCustomer,
    subscriptionStatuses,
  };
}
