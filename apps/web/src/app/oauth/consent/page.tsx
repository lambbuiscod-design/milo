import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { MiloCat } from "@/components/milo-cat";
import { env } from "@/lib/env";
import { requireAal2User } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  consentDestination,
  consentErrorMessage,
  isSafeMiloRedirectUrl,
  parseOAuthAuthorizationId,
  validateMiloAuthorizationDetails,
} from "@/lib/oauth-consent-contract";
import { ConsentForm } from "@/app/oauth/consent/consent-form";

export const metadata: Metadata = { title: "Authorize Milo" };

function ErrorPanel({ message }: { message: string }) {
  return (
    <section className="card card-shadow w-full max-w-xl rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-7 sm:p-10">
      <MiloCat className="h-12 w-12" />
      <div className="badge badge-neutral mt-6 font-extrabold uppercase tracking-wider text-[var(--brand-strong)]">
        Milo authorization
      </div>
      <h1 className="mt-2 text-2xl font-extrabold tracking-tight">We couldn&apos;t verify this request</h1>
      <p className="mt-3 leading-7 text-[var(--muted)]">{message}</p>
    </section>
  );
}

export default async function OAuthConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ authorization_id?: string; error?: string }>;
}) {
  const query = await searchParams;
  const authorizationId = parseOAuthAuthorizationId(query.authorization_id);
  if (!authorizationId) {
    return (
      <main className="grid min-h-dvh place-items-center px-4" id="main-content" tabIndex={-1}>
        <ErrorPanel message="This authorization request is invalid or expired." />
      </main>
    );
  }

  const user = await requireAal2User(consentDestination(authorizationId));
  const supabase = await createClient();
  if (!supabase || !env.MILO_DESKTOP_CLIENT_ID) {
    return (
      <main className="grid min-h-dvh place-items-center px-4" id="main-content" tabIndex={-1}>
        <ErrorPanel message="Milo sign-in is not configured yet. Please try again later." />
      </main>
    );
  }

  const detailsResult = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
  if (detailsResult.error || !detailsResult.data) {
    return (
      <main className="grid min-h-dvh place-items-center px-4" id="main-content" tabIndex={-1}>
        <ErrorPanel message="This authorization request is invalid or expired." />
      </main>
    );
  }

  if (!("authorization_id" in detailsResult.data)) {
    const redirectUrl = detailsResult.data.redirect_url;
    if (
      env.MILO_DESKTOP_REDIRECT_URI &&
      isSafeMiloRedirectUrl(redirectUrl, env.MILO_DESKTOP_REDIRECT_URI, env.MILO_DESKTOP_REDIRECT_URI)
    ) {
      redirect(redirectUrl);
    }
    return (
      <main className="grid min-h-dvh place-items-center px-4" id="main-content" tabIndex={-1}>
        <ErrorPanel message="This authorization callback is not registered for Milo." />
      </main>
    );
  }

  const validation = validateMiloAuthorizationDetails(
    detailsResult.data,
    env.MILO_DESKTOP_CLIENT_ID,
    user.id,
    env.MILO_DESKTOP_REDIRECT_URI,
  );
  if (!validation.ok) {
    return (
      <main className="grid min-h-dvh place-items-center px-4" id="main-content" tabIndex={-1}>
        <ErrorPanel message={consentErrorMessage(validation.code)} />
      </main>
    );
  }

  return (
    <main
      className="relative grid min-h-dvh place-items-center overflow-x-hidden px-4 py-8 sm:px-6 sm:py-12"
      id="main-content"
      tabIndex={-1}
    >
      <div aria-hidden="true" className="premium-grid pointer-events-none absolute inset-0 opacity-40" />
      <section className="card card-shadow relative w-full max-w-xl rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-7 sm:p-10">
        <div className="flex items-center gap-3">
          <MiloCat className="h-10 w-10 sm:h-12 sm:w-12" />
          <span className="font-display text-xl font-semibold">Milo</span>
        </div>
        <div className="badge badge-neutral mt-7 inline-flex items-center gap-1.5 font-extrabold uppercase tracking-wider text-[var(--brand-strong)]">
          <LockKeyhole aria-hidden="true" size={13} />
          <span>Secure authorization</span>
        </div>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
          Connect your Milo desktop companion
        </h1>
        <p className="mt-2.5 text-sm leading-6 text-[var(--muted)] sm:text-base">
          Review what the registered Milo desktop client can access before you continue.
        </p>
        <ConsentForm
          authorizationId={authorizationId}
          clientName={validation.details.client.name}
          scopes={validation.scopes}
        />
      </section>
    </main>
  );
}
