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
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-4 py-10 outline-none sm:px-6" id="main-content" tabIndex={-1}>
      <div className="pointer-events-none absolute -left-24 top-16 h-72 w-72 rounded-full bg-[var(--brand)]/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-10 h-72 w-72 rounded-full bg-pink-300/15 blur-3xl" />
      <section className="card-shadow relative w-full max-w-lg rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-8" aria-labelledby="mfa-title">
        <div className="flex items-center justify-between gap-4">
          <Link className="flex items-center gap-2 font-extrabold" href="/" aria-label="Milo home"><MiloCat className="h-12 w-12" /> Milo</Link>
          <span className="rounded-full bg-[var(--brand-soft)] px-3 py-1.5 text-xs font-black uppercase tracking-[.1em] text-[var(--brand-strong)]">Protected</span>
        </div>
        <p className="mt-8 text-xs font-black uppercase tracking-[.16em] text-[var(--brand-strong)]">One final step</p>
        <h1 className="font-display mt-2 text-4xl font-semibold tracking-[-.03em]" id="mfa-title">Confirm it&apos;s really you.</h1>
        <p className="mt-3 leading-7 text-[var(--muted)]">Open your authenticator app and enter its current Milo code.</p>
        <div className="mt-7">
          <MfaChallengeForm initialUnavailable={auth.status === "unavailable" || query.status === "unavailable"} next={next} />
        </div>
      </section>
    </main>
  );
}
