import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = resolve(import.meta.dirname, "../..");
const repositoryRoot = resolve(webRoot, "../..");
const source = (path: string) => readFileSync(resolve(webRoot, path), "utf8");
const repositorySource = (path: string) =>
  readFileSync(resolve(repositoryRoot, path), "utf8");

describe("billing recovery boundaries", () => {
  it("persists a constrained Customer generation after prior migrations", () => {
    const migrations = readdirSync(resolve(repositoryRoot, "supabase/migrations")).sort();
    const migrationName = migrations.find((name) =>
      name.endsWith("_billing_customer_revision.sql"),
    );
    expect(migrationName).toBe("20260808211808_billing_customer_revision.sql");
    expect(migrations.indexOf(migrationName!)).toBeGreaterThan(
      migrations.indexOf("20260802090822_never_persist_optional_context.sql"),
    );

    const migration = repositorySource(`supabase/migrations/${migrationName}`);
    expect(migration).toContain(
      "billing_customer_revision integer not null default 0",
    );
    expect(migration).toContain("billing_customer_revision >= 0");
  });

  it("keeps account deletion retryable until Auth deletion succeeds", () => {
    const route = source("src/app/api/account/delete/route.ts");
    expect(route).toContain("getStripeSubscriptionIdsToCancel");
    expect(route).toContain("stripe.customers.del(customerId)");
    expect(route).toContain("isStripeResourceMissingError");
    expect(route).toContain("billing_customer_revision: nextRevision");
    expect(route).toContain("stripe_customer_id: null");
    expect(route.indexOf("deleteUser(user.id)")).toBeLessThan(
      route.indexOf('signOut({ scope: "global" })'),
    );
  });

  it("rotates missing Customers and never relinks a stale webhook generation", () => {
    const checkout = source("src/app/api/billing/checkout/route.ts");
    const webhook = source("src/app/api/webhooks/stripe/route.ts");
    expect(checkout).toContain("stripeCustomerIdempotencyKey(user.id, revision)");
    expect(checkout).toContain("billing_customer_revision: String(customerRevision)");
    expect(webhook).toContain("STRIPE_CUSTOMER_REVISION_STALE");
    expect(webhook).toContain("retrieveSubscriptionOrRevoke");
    expect(webhook).toContain("revokeKnownSubscription");
  });

  it("renders billing recovery independently from active entitlement", () => {
    const account = source("src/app/account/page.tsx");
    expect(account).toContain("getAccountBillingState(user.id)");
    expect(account).toContain("billing.canManage");
    expect(account).toContain("billing.canUpgrade");
    expect(account).not.toContain('usage.plan === "plus" ? <form action="/api/billing/portal"');
  });
});
