import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MfaChallengeForm } from "@/components/mfa-challenge-form";
import { MiloCat } from "@/components/milo-cat";
import { getMfaAuthState } from "@/lib/auth";
import { sanitizeAuthDestination } from "@/lib/supabase/auth-redirect";

export const metadata: Metadata = {
  title: "Two-step verification",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function MfaPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; status?: string }>;
}) {
  const query = await searchParams;
  const sanitized = sanitizeAuthDestination(query.next);
  const next = sanitized.startsWith("/mfa") ? "/dashboard" : sanitized;
  const auth = await getMfaAuthState();

  if (auth.status === "unauthenticated") {
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }
  if (auth.status === "ineligible") {
    redirect("/login?error=account_ineligible");
  }
  if (auth.status === "authorized") redirect(next);

  return (
    <main
      className="relative grid min-h-screen place-items-center overflow-x-hidden px-4 py-10 outline-none sm:px-6"
      id="main-content"
      tabIndex={-1}
    >
      <div aria-hidden="true" className="premium-grid pointer-events-none absolute inset-0 opacity-40" />

      <section
        className="card card-shadow relative w-full max-w-lg rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-8"
        aria-labelledby="mfa-title"
      >
        <div className="flex items-center justify-between gap-4">
          <Link className="group flex items-center gap-2 font-extrabold" href="/" aria-label="Milo home">
            <MiloCat className="h-10 w-10 transition-transform group-hover:-rotate-3" />
            <span className="text-lg font-bold">Milo</span>
          </Link>
          <span className="badge badge-neutral font-extrabold uppercase tracking-wider text-[var(--brand-strong)]">
            Protected
          </span>
        </div>

        <div className="mt-8">
          <div className="badge badge-sm badge-neutral font-extrabold uppercase tracking-wider">
            One final step
          </div>
          <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight sm:text-4xl" id="mfa-title">
            Confirm it&apos;s really you.
          </h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Open your authenticator app and enter its current Milo code.
          </p>
        </div>

        <div className="mt-6">
          <MfaChallengeForm
            initialUnavailable={auth.status === "unavailable" || query.status === "unavailable"}
            next={next}
          />
        </div>
      </section>
    </main>
  );
}
