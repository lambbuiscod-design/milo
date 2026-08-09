import type { Metadata } from "next";
import Link from "next/link";
import { LockKeyhole, MailCheck } from "lucide-react";
import { MiloCat } from "@/components/milo-cat";
import { authErrorMessage } from "@/lib/auth-errors";
import { LoginForm } from "@/app/login/login-form";
import { env } from "@/lib/env";
import { isE2EMode } from "@/lib/runtime-mode";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; sent?: string; next?: string }> }) {
  const query = await searchParams;
  const errorMessage = authErrorMessage(query.error);
  const appHostname = new URL(env.NEXT_PUBLIC_APP_URL).hostname;
  const isLocalPreview = appHostname === "localhost" || appHostname === "127.0.0.1";
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-8 outline-none sm:px-6 sm:py-12" id="main-content" tabIndex={-1}>
      <div aria-hidden="true" className="premium-grid pointer-events-none absolute inset-0 opacity-50" />
      <section className="card-shadow relative grid w-full max-w-4xl overflow-hidden rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] lg:grid-cols-[0.9fr_1.1fr]">
        <aside className="order-2 relative overflow-hidden border-t border-[var(--line)] bg-[var(--brand-soft)] p-6 sm:p-9 lg:order-1 lg:border-r lg:border-t-0">
          <div aria-hidden="true" className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[var(--accent)] opacity-25 blur-3xl" />
          <div className="relative lg:mt-20">
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[var(--brand-strong)]">Private by design</p>
            <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Your next reply starts here.</h1>
            <p className="mt-4 max-w-sm text-base leading-7 text-[var(--muted)]">A passwordless sign-in keeps your account simple without weakening security.</p>
            <div className="mt-8 space-y-4 text-sm leading-6">
              <div className="flex gap-3"><MailCheck aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--brand)]" size={20} /><p><strong className="block text-[var(--foreground)]">One secure email</strong><span className="text-[var(--muted)]">Open the link to verify your address and continue.</span></p></div>
              <div className="flex gap-3"><LockKeyhole aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--brand)]" size={20} /><p><strong className="block text-[var(--foreground)]">No password stored</strong><span className="text-[var(--muted)]">The link is temporary and can only be used to sign in.</span></p></div>
            </div>
          </div>
        </aside>

        <div className="order-1 p-6 sm:p-9 lg:order-2 lg:p-12">
          <Link className="mb-7 inline-flex min-h-11 items-center gap-2 rounded-full font-extrabold" href="/" aria-label="Milo home">
            <MiloCat className="h-11 w-11" /> Milo
          </Link>
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[var(--brand-strong)]">Sign in to Milo</p>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight">Email me a secure link</h2>
          <p className="mb-7 mt-2 leading-7 text-[var(--muted)]">Enter your email below. No password is required.</p>
          <LoginForm
            initialError={errorMessage}
            initiallySent={query.sent === "1"}
            isLocalPreview={isLocalPreview}
            next={query.next ?? "/dashboard"}
            previewMode={isE2EMode()}
          />
        </div>
      </section>
    </main>
  );
}
