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

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ billing?: string; checkout?: string; upgrade?: string; mfa?: string }> }) {
  const user = await requireUser("/account"); const [usage, billing, query] = await Promise.all([getUsageForUser(user.id), getAccountBillingState(user.id), searchParams]);
  const usagePercent = Math.min(100, (usage.used / usage.allowance) * 100);
  const usageLabel = usage.plan === "plus" ? "Monthly analyses used" : "Lifetime free analyses used";
  return <AppShell email={user.email ?? "Signed in"}><div className="mx-auto max-w-4xl px-4 py-8 sm:px-8 sm:py-12"><p className="text-sm font-extrabold uppercase tracking-[.16em] text-[var(--brand)]">Your account</p><h1 className="font-display mt-1 text-4xl font-semibold sm:text-5xl">Plan, privacy and control.</h1>
    {query.checkout === "success" ? <p className="mt-6 rounded-2xl bg-emerald-50 p-4 font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">Payment received. Your Milo Plus access will appear as soon as Stripe confirms it.</p> : null}
    {query.checkout === "cancelled" ? <p className="mt-6 rounded-2xl bg-slate-100 p-4 font-semibold text-slate-800 dark:bg-slate-900 dark:text-slate-200">Checkout was cancelled. Nothing was charged, and you can upgrade whenever you are ready.</p> : null}
    {query.billing === "existing" ? <p className="mt-6 rounded-2xl bg-amber-50 p-4 font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-100">A Milo subscription already exists for this billing account. Use Manage subscription or wait for Stripe to finish confirming it.</p> : null}
    {query.billing === "missing" ? <p className="mt-6 rounded-2xl bg-amber-50 p-4 font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-100">We could not find a Stripe billing profile for this account. Start an upgrade first, or contact support if you already subscribed.</p> : null}
    {query.billing === "unavailable" ? <p className="mt-6 rounded-2xl bg-red-50 p-4 font-semibold text-red-800 dark:bg-red-950 dark:text-red-200">Billing is temporarily unavailable. No charge was made. Please try again in a moment.</p> : null}
    {query.upgrade ? <p className="mt-6 rounded-2xl bg-indigo-50 p-4 font-semibold text-indigo-900 dark:bg-indigo-950 dark:text-indigo-100">You reached your current allowance. Upgrade to continue with 150 analyses each month.</p> : null}
    {query.mfa === "enabled" ? <p className="mt-6 rounded-2xl bg-emerald-50 p-4 font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">Two-step verification is enabled. This session is now protected by your authenticator.</p> : null}
    {query.mfa === "required" ? <p className="mt-6 rounded-2xl bg-amber-50 p-4 font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-100">Administrator access requires two-step verification. Add and verify an authenticator below, then open the admin page again.</p> : null}
    {query.mfa === "removed" ? <p className="mt-6 rounded-2xl bg-amber-50 p-4 font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-100">Authenticator removed. Your session assurance was refreshed immediately.</p> : null}
    <section className="card-shadow mt-8 rounded-[1.75rem] border border-[var(--line)] bg-[var(--surface)] p-6 sm:p-8"><div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center"><div><p className="font-extrabold text-[var(--brand)]">{usage.plan === "plus" ? "Milo Plus" : "Milo Free"}</p><p className="mt-2 text-3xl font-black">{usage.used} <span className="text-base font-normal text-[var(--muted)]">of {usage.allowance} used</span></p><div aria-label={usageLabel} aria-valuemax={usage.allowance} aria-valuemin={0} aria-valuenow={usage.used} className="mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-[var(--line)]" role="progressbar"><div className="h-full rounded-full bg-[var(--brand-fill)]" style={{ width: `${usagePercent}%` }} /></div><p className="mt-2 text-xs font-semibold text-[var(--muted)]">{usage.plan === "plus" ? "Resets with your paid billing period." : "Five successful analyses are free for the lifetime of this account."}</p></div><CreditCard className="hidden text-[var(--brand)] sm:block" size={58} /></div>
      <ul className="mt-7 space-y-2 text-sm">{["No screenshot or original-chat storage", "Editable replies; no automatic sending", "Cancel paid access through Stripe"].map((item) => <li className="flex gap-2" key={item}><Check className="text-[var(--success)]" size={18} />{item}</li>)}</ul>
      <div className="mt-7 flex flex-col gap-3 sm:flex-row">{billing.canManage ? <form action="/api/billing/portal" method="post"><button className="min-h-12 rounded-full bg-[var(--brand-fill)] px-6 font-extrabold text-white" type="submit">Manage billing</button></form> : null}{billing.canUpgrade ? <form action="/api/billing/checkout" method="post"><button className="min-h-12 rounded-full border border-[var(--brand)] px-6 font-extrabold text-[var(--brand)]" type="submit">Upgrade for €5.99/month</button></form> : null}{!billing.configured ? <p className="text-sm font-semibold text-[var(--muted)]">Billing controls are temporarily unavailable.</p> : null}</div>
    </section>
    <MfaSecurityPanel demoMode={isE2EMode()} />
    <section className="mt-6 rounded-[1.75rem] border border-[var(--line)] bg-[var(--surface)] p-6 sm:p-8"><h2 className="flex items-center gap-2 text-xl font-extrabold"><ShieldCheck className="text-[var(--success)]" /> Privacy controls</h2><p className="mt-3 leading-7 text-[var(--muted)]">Milo stores generated replies and minimal usage metadata so your allowance and feedback work. It never stores uploaded screenshots or extracted original conversations.</p></section>
    <section className="mt-6 rounded-[1.75rem] border border-red-200 bg-[var(--surface)] p-6 sm:p-8"><h2 className="flex items-center gap-2 text-xl font-extrabold text-red-700 dark:text-red-300"><Trash2 /> Delete account</h2><p className="mt-3 leading-7 text-[var(--muted)]">This cancels active paid access and permanently removes your Milo account data.</p><DeleteAccountForm /></section>
  </div></AppShell>;
}
