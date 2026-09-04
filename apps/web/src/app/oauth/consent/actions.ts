"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { requireAal2User } from "@/lib/auth";
import {
  consentDestination,
  consentErrorMessage,
  isSafeMiloRedirectUrl,
  parseOAuthAuthorizationId,
  validateMiloAuthorizationDetails,
} from "@/lib/oauth-consent-contract";

export type ConsentActionState = {
  status: "idle" | "error";
  message: string | null;
};

const ERROR_STATE = (message: string): ConsentActionState => ({ status: "error", message });

export async function decideAuthorization(
  _previousState: ConsentActionState,
  formData: FormData,
): Promise<ConsentActionState> {
  const authorizationId = parseOAuthAuthorizationId(String(formData.get("authorization_id") ?? ""));
  const decision = formData.get("decision");
  if (!authorizationId || (decision !== "approve" && decision !== "deny")) {
    return ERROR_STATE("This authorization request is invalid or expired.");
  }

  // This preserves the authorization request through login and MFA. The
  // helper fails closed for ineligible, unauthenticated, or non-AAL2 users.
  const user = await requireAal2User(consentDestination(authorizationId));
  const supabase = await createClient();
  if (!supabase || !env.MILO_DESKTOP_CLIENT_ID) {
    return ERROR_STATE("Milo sign-in is not configured yet. Please try again later.");
  }

  const detailsResult = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
  if (detailsResult.error || !detailsResult.data || !("authorization_id" in detailsResult.data)) {
    return ERROR_STATE("This authorization request is invalid or expired.");
  }
  const validation = validateMiloAuthorizationDetails(
    detailsResult.data,
    env.MILO_DESKTOP_CLIENT_ID,
    user.id,
    env.MILO_DESKTOP_REDIRECT_URI,
  );
  if (!validation.ok) return ERROR_STATE(consentErrorMessage(validation.code));

  const result =
    decision === "approve"
      ? await supabase.auth.oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true })
      : await supabase.auth.oauth.denyAuthorization(authorizationId, { skipBrowserRedirect: true });
  const redirectUrl = result.data?.redirect_url;
  if (result.error || !redirectUrl || !isSafeMiloRedirectUrl(redirectUrl, validation.details.redirect_uri, env.MILO_DESKTOP_REDIRECT_URI)) {
    return ERROR_STATE("Milo could not complete this authorization request. Please try again.");
  }

  // The URL was returned by Supabase and checked against the registered
  // loopback callback before navigation. It contains only a one-time code or
  // an OAuth denial response; no token is rendered or logged by Milo.
  redirect(redirectUrl);
}
