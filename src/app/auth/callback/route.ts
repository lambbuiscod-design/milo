import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { sanitizeAuthDestination } from "@/lib/supabase/auth-redirect";
import { verifyAdultAttestation } from "@/lib/adult-attestation";
import { operationalErrorType } from "@/lib/operational-error";

function privateRedirect(destination: string) {
  const response = NextResponse.redirect(new URL(destination, env.NEXT_PUBLIC_APP_URL));
  response.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate, max-age=0");
  response.headers.set("Expires", "0");
  response.headers.set("Pragma", "no-cache");
  return response;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = sanitizeAuthDestination(url.searchParams.get("next"));
  const attestation = url.searchParams.get("adult_attestation") ?? undefined;
  if (code) {
    const supabase = await createClient();
    try {
      const { error } = (await supabase?.auth.exchangeCodeForSession(code)) ?? {
        error: new Error("Supabase is not configured"),
      };
      if (error || !supabase) return privateRedirect("/login?error=invalid_link");

      const { data: userData, error: userError } = await supabase.auth.getUser();
      const user = userData.user;
      const admin = createAdminClient();
      const attestationValid = Boolean(
        user?.email &&
        env.RATE_LIMIT_HASH_SECRET &&
        verifyAdultAttestation(
          attestation,
          user.email,
          env.RATE_LIMIT_HASH_SECRET,
        ),
      );

      if (user && !userError && admin && attestationValid) {
        const { error: metadataError } = await admin.auth.admin.updateUserById(
          user.id,
          {
            app_metadata: {
              ...user.app_metadata,
              adult_confirmed: true,
            },
          },
        );
        if (!metadataError) return privateRedirect(next);
      }

      // A direct provider request or a link opened without Milo's signed
      // first-party confirmation must not leave an eligible browser session.
      await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
      return privateRedirect("/login?error=account_ineligible");
    } catch (error) {
      console.error("[auth/callback] failed", {
        errorType: operationalErrorType(error),
      });
      return privateRedirect("/login?error=invalid_link");
    }
  }
  return privateRedirect("/login?error=invalid_link");
}
