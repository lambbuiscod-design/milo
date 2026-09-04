import type { Metadata } from "next";
import { Check, CreditCard, ShieldCheck, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { DeleteAccountForm } from "@/components/delete-account-form";
import { MfaSecurityPanel } from "@/components/mfa-security-panel";
import { requireUser } from "@/lib/auth";
import { getUsageForUser } from "@/lib/usage";
import { isE2EMode } from "@/lib/runtime-mode";
import { getAccountBillingState } from "@/lib/account-billing";

export const metadata: Metadata = { title: "Plan and account" };
export const dynamic = "force-dynamic";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ billing?: string; checkout?: string; upgrade?: string; mfa?: string }>;
}) {
  const user = await requireUser("/account");
  const [usage, billing, query] = await Promise.all([
    getUsageForUser(user.id),
    getAccountBillingState(user.id),
    searchParams,
  ]);
  const usagePercent = Math.min(100, (usage.used / usage.allowance) * 100);
  const usageLabel = usage.plan === "plus" ? "Monthly analyses used" : "Lifetime free analyses used";

  return (
    <AppShell email={user.email ?? "Signed in"}>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-8 sm:py-12">
        <div className="badge badge-neutral mb-2 font-extrabold uppercase tracking-wider text-[var(--brand)]">
          Your account
        </div>
        <h1 className="font-display mt-1 text-3xl font-semibold sm:text-5xl">Plan, privacy and control.</h1>

        {query.checkout === "success" ? (
          <div className="alert alert-success mt-6 rounded-2xl p-4 text-sm font-semibold" role="status">
            <span>Payment received. Your Milo Plus access will appear as soon as Stripe confirms it.</span>
          </div>
        ) : null}
        {query.checkout === "cancelled" ? (
          <div className="alert alert-info mt-6 rounded-2xl p-4 text-sm font-semibold" role="status">
            <span>Checkout was cancelled. Nothing was charged, and you can upgrade whenever you are ready.</span>
          </div>
        ) : null}
        {query.billing === "existing" ? (
          <div className="alert alert-warning mt-6 rounded-2xl p-4 text-sm font-semibold" role="status">
            <span>A Milo subscription already exists for this billing account. Use Manage subscription or wait for Stripe to finish confirming it.</span>
          </div>
        ) : null}
        {query.billing === "missing" ? (
          <div className="alert alert-warning mt-6 rounded-2xl p-4 text-sm font-semibold" role="status">
            <span>We could not find a Stripe billing profile for this account. Start an upgrade first, or contact support if you already subscribed.</span>
          </div>
        ) : null}
        {query.billing === "unavailable" ? (
          <div className="alert alert-error mt-6 rounded-2xl p-4 text-sm font-semibold" role="alert">
            <span>Billing is temporarily unavailable. No charge was made. Please try again in a moment.</span>
          </div>
        ) : null}
        {query.upgrade ? (
          <div className="alert alert-info mt-6 rounded-2xl p-4 text-sm font-semibold" role="status">
            <span>You reached your current allowance. Upgrade to continue with 150 analyses each month.</span>
          </div>
        ) : null}
        {query.mfa === "enabled" ? (
          <div className="alert alert-success mt-6 rounded-2xl p-4 text-sm font-semibold" role="status">
            <span>Two-step verification is enabled. This session is now protected by your authenticator.</span>
          </div>
        ) : null}
        {query.mfa === "required" ? (
          <div className="alert alert-warning mt-6 rounded-2xl p-4 text-sm font-semibold" role="status">
            <span>Administrator access requires two-step verification. Add and verify an authenticator below, then open the admin page again.</span>
          </div>
        ) : null}
        {query.mfa === "removed" ? (
          <div className="alert alert-warning mt-6 rounded-2xl p-4 text-sm font-semibold" role="status">
            <span>Authenticator removed. Your session assurance was refreshed immediately.</span>
          </div>
        ) : null}

        {/* Plan Card */}
        <section className="card card-shadow mt-8 rounded-[1.75rem] border border-[var(--line)] bg-[var(--surface)] p-6 sm:p-8">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
            <div>
              <p className="font-extrabold text-[var(--brand)]">
                {usage.plan === "plus" ? "Milo Plus" : "Milo Free"}
              </p>
              <p className="mt-2 text-3xl font-black">
                {usage.used}{" "}
                <span className="text-base font-normal text-[var(--muted)]">of {usage.allowance} used</span>
              </p>

              {/* Hard Accessibility Invariant: role="progressbar", aria-label={usageLabel}, aria-valuenow, aria-valuemax */}
              <div
                aria-label={usageLabel}
                aria-valuemax={usage.allowance}
                aria-valuemin={0}
                aria-valuenow={usage.used}
                className="mt-3 h-2.5 w-full max-w-xs overflow-hidden rounded-full bg-[var(--line)]"
                role="progressbar"
              >
                <div
                  className="h-full rounded-full bg-[var(--brand-fill)] transition-all duration-300"
                  style={{ width: `${usagePercent}%` }}
                />
              </div>

              <p className="mt-2 text-xs font-semibold text-[var(--muted)]">
                {usage.plan === "plus"
                  ? "Resets with your paid billing period."
                  : "Five successful analyses are free for the lifetime of this account."}
              </p>
            </div>
            <CreditCard className="hidden text-[var(--brand)] sm:block opacity-80" size={54} />
          </div>

          <ul className="mt-7 space-y-2.5 text-sm">
            {[
              "No screenshot or original-chat storage",
              "Editable replies; no automatic sending",
              "Cancel paid access through Stripe",
            ].map((item) => (
              <li className="flex items-center gap-2.5" key={item}>
                <Check className="text-[var(--success)]" size={17} />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            {billing.canManage ? (
              <form action="/api/billing/portal" method="post">
                <button
                  className="btn btn-primary min-h-12 rounded-full px-6 font-extrabold text-white"
                  type="submit"
                >
                  Manage billing
                </button>
              </form>
            ) : null}
            {billing.canUpgrade ? (
              <form action="/api/billing/checkout" method="post">
                <button
                  className="btn btn-outline min-h-12 rounded-full border-[var(--brand)] px-6 font-extrabold text-[var(--brand)] hover:bg-[var(--brand)] hover:text-white"
                  type="submit"
                >
                  Upgrade for €5.99/month
                </button>
              </form>
            ) : null}
            {!billing.configured ? (
              <p className="text-sm font-semibold text-[var(--muted)]">Billing controls are temporarily unavailable.</p>
            ) : null}
          </div>
        </section>

        {/* MFA Section */}
        <MfaSecurityPanel demoMode={isE2EMode()} />

        {/* Privacy Section */}
        <section className="card card-shadow mt-6 rounded-[1.75rem] border border-[var(--line)] bg-[var(--surface)] p-6 sm:p-8">
          <h2 className="flex items-center gap-2 text-lg font-extrabold sm:text-xl">
            <ShieldCheck className="text-[var(--success)]" size={20} />
            <span>Privacy controls</span>
          </h2>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)] sm:text-base">
            Milo stores generated replies and minimal usage metadata so your allowance and feedback work. It never stores uploaded screenshots or extracted original conversations.
          </p>
        </section>

        {/* Delete Account Section */}
        <section className="card card-shadow mt-6 rounded-[1.75rem] border border-red-200 bg-[var(--surface)] p-6 dark:border-red-900/60 sm:p-8">
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-red-700 dark:text-red-300 sm:text-xl">
            <Trash2 size={20} />
            <span>Delete account</span>
          </h2>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)] sm:text-base">
            This cancels active paid access and permanently removes your Milo account data.
          </p>
          <DeleteAccountForm />
        </section>
      </div>
    </AppShell>
  );
}
