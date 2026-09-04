import "server-only";

import { createClient as createSupabaseClient, type User } from "@supabase/supabase-js";
import { isE2EMode } from "@/lib/runtime-mode";
import { isEligibleMiloAuthUser } from "@/lib/auth-eligibility";
import { env, hasSupabaseConfig } from "@/lib/env";

export type DesktopAuthResult =
  | { status: "authorized"; user: { id: string; email?: string }; accessToken: string }
  | { status: "unauthenticated" | "invalid_client" | "mfa_required" | "ineligible" | "unavailable" };

const MAX_ACCESS_TOKEN_LENGTH = 4_096;

/** Authenticate the public desktop client without creating a browser session. */
export async function authenticateDesktopRequest(request: Request): Promise<DesktopAuthResult> {
  const clientId = request.headers.get("x-milo-client-id")?.trim();
  if (!env.MILO_DESKTOP_CLIENT_ID || clientId !== env.MILO_DESKTOP_CLIENT_ID) {
    return { status: "invalid_client" };
  }

  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Bearer ([^\s]+)$/.exec(authorization);
  const accessToken = match?.[1] ?? "";
  if (!accessToken || accessToken.length > MAX_ACCESS_TOKEN_LENGTH) {
    return { status: "unauthenticated" };
  }

  if (isE2EMode() && accessToken === "milo-e2e-access-token") {
    return { status: "authorized", user: { id: "00000000-0000-4000-8000-000000000001", email: "tester@milo.local" }, accessToken };
  }

  if (!hasSupabaseConfig()) return { status: "unavailable" };
  const supabase = createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  let user: User;
  let claims: Record<string, unknown> = {};
  try {
    const [{ data, error }, claimsResult] = await Promise.all([
      supabase.auth.getUser(accessToken),
      supabase.auth.getClaims(accessToken),
    ]);
    if (error || !data.user) return { status: "unauthenticated" };
    if (claimsResult.error || !claimsResult.data?.claims) return { status: "unauthenticated" };
    user = data.user;
    claims = claimsResult.data.claims as Record<string, unknown>;
  } catch {
    return { status: "unavailable" };
  }

  if (!isEligibleMiloAuthUser(user)) return { status: "ineligible" };
  if (claims.client_id !== env.MILO_DESKTOP_CLIENT_ID) return { status: "invalid_client" };
  if (claims.aal !== "aal2") return { status: "mfa_required" };
  return { status: "authorized", user: { id: user.id, email: user.email }, accessToken };
}

export function desktopAuthFailure(status: Exclude<DesktopAuthResult["status"], "authorized">) {
  const respond = (body: Record<string, string>, statusCode: number) => Response.json(body, {
    status: statusCode,
    headers: { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache" },
  });
  if (status === "mfa_required") return respond({ error: "Complete two-step verification to use Milo desktop suggestions.", code: "MFA_REQUIRED" }, 403);
  if (status === "ineligible") return respond({ error: "This account is not eligible to use Milo.", code: "ACCOUNT_INELIGIBLE" }, 403);
  if (status === "unavailable") return respond({ error: "Milo desktop authentication is temporarily unavailable.", code: "AUTH_UNAVAILABLE" }, 503);
  if (status === "invalid_client") return respond({ error: "This Milo desktop client is not authorized.", code: "INVALID_CLIENT" }, 401);
  return respond({ error: "Sign in to use Milo desktop suggestions.", code: "UNAUTHORIZED" }, 401);
}
