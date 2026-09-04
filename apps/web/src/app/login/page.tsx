import type { Metadata } from "next";
import Link from "next/link";
import { LockKeyhole, MailCheck } from "lucide-react";
import { MiloCat } from "@/components/milo-cat";
import { authErrorMessage } from "@/lib/auth-errors";
import { LoginForm } from "@/app/login/login-form";
import { env } from "@/lib/env";
import { isE2EMode } from "@/lib/runtime-mode";
import { sanitizeAuthDestination } from "@/lib/supabase/auth-redirect";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string; next?: string }>;
}) {
  const query = await searchParams;
  const errorMessage = authErrorMessage(query.error);
  const next = sanitizeAuthDestination(query.next);
  const appHostname = new URL(env.NEXT_PUBLIC_APP_URL).hostname;
  const isLocalPreview = appHostname === "localhost" || appHostname === "127.0.0.1";

  return (
    <main
      className="relative grid min-h-dvh place-items-center overflow-x-hidden px-4 py-8 outline-none sm:px-6 sm:py-12"
      id="main-content"
      tabIndex={-1}
    >
      <div aria-hidden="true" className="premium-grid pointer-events-none absolute inset-0 opacity-40" />

      <section className="card card-shadow relative grid w-full max-w-4xl overflow-hidden rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] lg:grid-cols-[0.9fr_1.1fr]">
        <aside className="order-2 relative overflow-hidden border-t border-[var(--line)] bg-[var(--brand-soft)] p-6 sm:p-9 lg:order-1 lg:border-r lg:border-t-0">
          <div className="relative lg:mt-16">
            <div className="badge badge-neutral mb-3 font-extrabold uppercase tracking-wider text-[var(--brand-strong)]">
              Private by design
            </div>
            <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Your next reply starts here.
            </h1>
            <p className="mt-3 max-w-sm text-sm leading-6 text-[var(--muted)] sm:text-base sm:leading-7">
              A passwordless sign-in keeps your account simple without weakening security.
            </p>
            <div className="mt-8 space-y-4 text-sm leading-6">
              <div className="flex gap-3">
                <MailCheck aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--brand)]" size={19} />
                <p>
                  <strong className="block text-[var(--foreground)]">One secure email</strong>
                  <span className="text-[var(--muted)]">Open the link to verify your address and continue.</span>
                </p>
              </div>
              <div className="flex gap-3">
                <LockKeyhole aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--brand)]" size={19} />
                <p>
                  <strong className="block text-[var(--foreground)]">No password stored</strong>
                  <span className="text-[var(--muted)]">The link is temporary and can only be used to sign in.</span>
                </p>
              </div>
            </div>
          </div>
        </aside>

        <div className="order-1 p-6 sm:p-9 lg:order-2 lg:p-12">
          <Link
            className="group mb-7 inline-flex min-h-11 items-center gap-2 rounded-full font-extrabold"
            href="/"
            aria-label="Milo home"
          >
            <MiloCat className="h-10 w-10 transition-transform group-hover:-rotate-3" />
            <span className="text-lg font-bold">Milo</span>
          </Link>
          <div className="badge badge-neutral mb-2 font-extrabold uppercase tracking-wider">
            Sign in to Milo
          </div>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">Email me a secure link</h2>
          <p className="mb-7 mt-2 text-sm leading-6 text-[var(--muted)]">
            Enter your email below. No password is required.
          </p>
          <LoginForm
            initialError={errorMessage}
            initiallySent={query.sent === "1"}
            isLocalPreview={isLocalPreview}
            next={next}
            previewMode={isE2EMode()}
          />
        </div>
      </section>
    </main>
  );
}
