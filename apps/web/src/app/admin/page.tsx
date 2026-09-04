import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  Activity,
  BarChart3,
  CheckCircle2,
  DollarSign,
  HeartHandshake,
  Percent,
  Shield,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { requireAal2User, requireUser } from "@/lib/auth";
import { MILO_MONTHLY_PRICE_EUR_CENTS } from "@/lib/billing";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Admin metrics" };
export const dynamic = "force-dynamic";

type AdminMetricRow = {
  registered_users: number | string;
  weekly_active_users: number | string;
  analyses_completed: number | string;
  analyses_failed: number | string;
  active_subscriptions: number | string;
  helpful_feedback: number | string;
  total_feedback: number | string;
  replies_copied: number | string;
  total_model_cost: number | string;
};

function numeric(value: number | string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

const metricIcons = [
  Users,
  Activity,
  CheckCircle2,
  Percent,
  TrendingUp,
  Shield,
  DollarSign,
  Sparkles,
  HeartHandshake,
  BarChart3,
];

export default async function AdminPage() {
  const user = await requireUser("/admin");
  const admins = env.ADMIN_EMAILS.split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  if (!user.email || !admins.includes(user.email.toLowerCase())) redirect("/dashboard");

  // Check the allowlist before requiring enrollment so a non-admin who guesses
  // this URL is never prompted to configure an operator security control.
  await requireAal2User("/admin");

  const admin = createAdminClient();
  if (!admin) {
    return (
      <main className="p-8 outline-none" id="main-content" tabIndex={-1}>
        <div className="alert alert-warning max-w-xl rounded-2xl p-4">
          <span>Supabase admin metrics are not configured.</span>
        </div>
      </main>
    );
  }

  const { data, error } = await admin
    .rpc("get_admin_metrics", {
      p_expected_stripe_price_id: env.STRIPE_PRICE_ID ?? null,
    })
    .single();
  if (error || !data) {
    console.error("[admin/metrics] aggregate query failed");
    return (
      <main className="p-8 outline-none" id="main-content" tabIndex={-1}>
        <div className="alert alert-error max-w-xl rounded-2xl p-4">
          <span>Aggregate metrics are temporarily unavailable.</span>
        </div>
      </main>
    );
  }

  const row = data as AdminMetricRow;
  const registeredCount = numeric(row.registered_users);
  const activeUserCount = numeric(row.weekly_active_users);
  const completedCount = numeric(row.analyses_completed);
  const failedCount = numeric(row.analyses_failed);
  const subscriberCount = numeric(row.active_subscriptions);
  const helpfulCount = numeric(row.helpful_feedback);
  const feedbackCount = numeric(row.total_feedback);
  const copiedCount = numeric(row.replies_copied);
  const totalCost = numeric(row.total_model_cost);

  const metrics = [
    ["Registered users", registeredCount],
    ["Weekly active users", activeUserCount],
    ["Analyses completed", completedCount],
    [
      "Analysis success rate",
      `${completedCount + failedCount ? Math.round((completedCount / (completedCount + failedCount)) * 100) : 0}%`,
    ],
    [
      "Free-to-paid conversion",
      `${registeredCount ? ((subscriberCount / registeredCount) * 100).toFixed(1) : "0.0"}%`,
    ],
    ["Active subscriptions", subscriberCount],
    ["Estimated MRR", `€${((subscriberCount * MILO_MONTHLY_PRICE_EUR_CENTS) / 100).toFixed(2)}`],
    ["Replies copied / analysis", completedCount ? (copiedCount / completedCount).toFixed(2) : "0.00"],
    ["Helpful feedback", `${feedbackCount ? Math.round((helpfulCount / feedbackCount) * 100) : 0}%`],
    ["Model cost / analysis", `$${completedCount ? (totalCost / completedCount).toFixed(4) : "0.0000"}`],
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 outline-none sm:px-8" id="main-content" tabIndex={-1}>
      <div className="badge badge-neutral mb-2 font-extrabold uppercase tracking-wider text-[var(--brand)]">
        Private aggregate metrics
      </div>
      <h1 className="font-display mt-1 text-3xl font-semibold sm:text-4xl">Milo health</h1>
      <p className="mt-2 text-sm text-[var(--muted)] sm:text-base">
        No screenshots, original conversations or generated replies are exposed here.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map(([label, value], index) => {
          const Icon = metricIcons[index % metricIcons.length];
          return (
            <article
              className="card card-shadow rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-6"
              key={label}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-[var(--muted)] sm:text-sm">{label}</p>
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand-strong)]">
                  <Icon size={16} aria-hidden="true" />
                </div>
              </div>
              <p className="mt-3 text-2xl font-black sm:text-3xl text-[var(--brand-strong)]">{value}</p>
            </article>
          );
        })}
      </div>
    </main>
  );
}
