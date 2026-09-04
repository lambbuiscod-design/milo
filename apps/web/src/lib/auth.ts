import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isE2EMode, MILO_E2E_AUTH_COOKIE } from "@/lib/runtime-mode";
import { requiresMfaChallenge } from "@/lib/supabase/mfa";
import { sanitizeAuthDestination } from "@/lib/supabase/auth-redirect";
import { isEligibleMiloAuthUser } from "@/lib/auth-eligibility";

export type MiloUser = { id: string; email?: string };

export type MfaAuthState =
  | { status: "authorized"; user: MiloUser; isAal2: boolean }
  | { status: "mfa_required"; user: MiloUser }
  | { status: "unavailable"; user: MiloUser }
  | { status: "ineligible"; user: MiloUser }
  | { status: "unauthenticated"; user: null };

const E2E_USER: MiloUser = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "tester@milo.local",
};

export async function getCurrentUser() {
  if (isE2EMode()) {
    const cookieStore = await cookies();
    return cookieStore.get(MILO_E2E_AUTH_COOKIE)?.value === "1" ? E2E_USER : null;
  }
  const supabase = await createClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user || !isEligibleMiloAuthUser(data.user)) return null;
  return data.user;
}

export async function getMfaAuthState(): Promise<MfaAuthState> {
  if (isE2EMode()) {
    const cookieStore = await cookies();
    return cookieStore.get(MILO_E2E_AUTH_COOKIE)?.value === "1"
      ? { status: "authorized", user: E2E_USER, isAal2: true }
      : { status: "unauthenticated", user: null };
  }

  const supabase = await createClient();
  if (!supabase) return { status: "unauthenticated", user: null };

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return { status: "unauthenticated", user: null };

  const user: MiloUser = { id: userData.user.id, email: userData.user.email };
  if (!isEligibleMiloAuthUser(userData.user)) return { status: "ineligible", user };
  const { data: assurance, error: assuranceError } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  if (assuranceError || !assurance) return { status: "unavailable", user };
  if (requiresMfaChallenge(assurance)) return { status: "mfa_required", user };
  return { status: "authorized", user, isAal2: assurance.currentLevel === "aal2" };
}

export function mfaApiFailure(state: Exclude<MfaAuthState, { status: "authorized" }>) {
  if (state.status === "unauthenticated") {
    return Response.json({ error: "Sign in to continue.", code: "UNAUTHORIZED" }, { status: 401 });
  }
  if (state.status === "mfa_required") {
    return Response.json(
      { error: "Complete two-step verification to continue.", code: "MFA_REQUIRED" },
      { status: 403 },
    );
  }
  if (state.status === "ineligible") {
    return Response.json(
      { error: "This account is not eligible to use Milo.", code: "ACCOUNT_INELIGIBLE" },
      { status: 403 },
    );
  }
  return Response.json(
    { error: "Two-step verification is temporarily unavailable.", code: "MFA_UNAVAILABLE" },
    { status: 503 },
  );
}

export async function requireUser(next = "/dashboard") {
  const destination = sanitizeAuthDestination(next);
  const state = await getMfaAuthState();
  if (state.status === "unauthenticated") {
    redirect(`/login?next=${encodeURIComponent(destination)}`);
  }
  if (state.status === "ineligible") {
    redirect("/login?error=account_ineligible");
  }
  if (state.status === "mfa_required" || state.status === "unavailable") {
    const unavailable = state.status === "unavailable" ? "&status=unavailable" : "";
    redirect(`/mfa?next=${encodeURIComponent(destination)}${unavailable}`);
  }
  return state.user;
}

/**
 * Sensitive operator surfaces require an authenticator-backed session even
 * when the account has not opted into MFA yet. The account page remains
 * reachable so an administrator can enroll a factor.
 */
export async function requireAal2User(next = "/admin") {
  const destination = sanitizeAuthDestination(next);
  const state = await getMfaAuthState();
  if (state.status === "unauthenticated") {
    redirect(`/login?next=${encodeURIComponent(destination)}`);
  }
  if (state.status === "ineligible") {
    redirect("/login?error=account_ineligible");
  }
  if (state.status === "mfa_required" || state.status === "unavailable") {
    const unavailable = state.status === "unavailable" ? "&status=unavailable" : "";
    redirect(`/mfa?next=${encodeURIComponent(destination)}${unavailable}`);
  }
  if (!state.isAal2) {
    redirect("/account?mfa=required");
  }
  return state.user;
}
