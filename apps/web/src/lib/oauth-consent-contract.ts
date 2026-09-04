import { z } from "zod";

/**
 * Supabase treats this value as an opaque authorization identifier. Keep it
 * bounded and URL-safe before it is ever used as a path parameter or carried
 * through the login flow.
 */
export const oauthAuthorizationIdSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{8,128}$/, "Invalid OAuth authorization id");

export const MILO_OAUTH_SCOPES = ["openid", "email", "profile"] as const;
const ALLOWED_SCOPE_SET = new Set<string>(MILO_OAUTH_SCOPES);

export type MiloOAuthAuthorizationDetails = {
  authorization_id: string;
  redirect_uri: string;
  client: {
    id: string;
    name: string;
    uri: string;
    logo_uri: string;
  };
  user: { id: string; email: string };
  scope: string;
};

const oauthAuthorizationDetailsSchema = z
  .object({
    authorization_id: oauthAuthorizationIdSchema,
    redirect_uri: z.string().url().max(2048),
    client: z
      .object({
        id: z.string().min(1).max(128),
        name: z.string().min(1).max(160),
        uri: z.string().max(2048),
        logo_uri: z.string().max(2048),
      })
      .strict(),
    user: z
      .object({ id: z.string().uuid(), email: z.string().max(320) })
      .strict(),
    scope: z.string().min(1).max(512),
  })
  .strict();

export type OAuthConsentErrorCode =
  | "invalid_request"
  | "client_not_configured"
  | "client_mismatch"
  | "user_mismatch"
  | "scope_not_allowed"
  | "redirect_not_allowed";

export type OAuthConsentValidation =
  | { ok: true; details: MiloOAuthAuthorizationDetails; scopes: string[] }
  | { ok: false; code: OAuthConsentErrorCode };

export function parseOAuthAuthorizationId(value: string | null | undefined) {
  const result = oauthAuthorizationIdSchema.safeParse(value ?? "");
  return result.success ? result.data : null;
}

export function consentDestination(authorizationId: string) {
  const safeId = parseOAuthAuthorizationId(authorizationId);
  return safeId
    ? `/oauth/consent?authorization_id=${encodeURIComponent(safeId)}`
    : "/oauth/consent?error=invalid_request";
}

function parseMiloLoopbackUri(value: string) {
  try {
    const uri = new URL(value);
    if (
      uri.protocol !== "http:" ||
      !["127.0.0.1", "localhost"].includes(uri.hostname) ||
      !uri.port ||
      uri.username ||
      uri.password ||
      uri.search ||
      uri.hash ||
      uri.pathname === "/"
    ) {
      return null;
    }
    return uri;
  } catch {
    return null;
  }
}

/** Only the registered native loopback callback is a valid redirect target. */
export function isSafeMiloRedirectUri(value: string, configuredRedirectUri?: string) {
  const uri = parseMiloLoopbackUri(value);
  if (!uri) return false;
  if (configuredRedirectUri && value !== configuredRedirectUri) return false;
  return true;
}

/**
 * Consent responses include a generated code and state. Preserve only
 * Supabase's callback query parameters and the exact registered callback
 * origin/path; never navigate to an arbitrary URL supplied by a request.
 */
export function isSafeMiloRedirectUrl(value: string, redirectUri: string, configuredRedirectUri?: string) {
  if (!isSafeMiloRedirectUri(redirectUri, configuredRedirectUri)) return false;
  try {
    const target = new URL(value);
    const base = new URL(redirectUri);
    if (
      target.protocol !== base.protocol ||
      target.host !== base.host ||
      target.pathname !== base.pathname ||
      target.username ||
      target.password ||
      target.hash
    ) {
      return false;
    }
    for (const key of target.searchParams.keys()) {
      if (!["code", "state", "error", "error_code", "error_description", "error_uri"].includes(key)) return false;
    }
    return target.searchParams.has("code") || target.searchParams.get("error") === "access_denied";
  } catch {
    return false;
  }
}

export function validateMiloAuthorizationDetails(
  value: unknown,
  expectedClientId: string | undefined,
  expectedUserId: string,
  configuredRedirectUri?: string,
): OAuthConsentValidation {
  const parsed = oauthAuthorizationDetailsSchema.safeParse(value);
  if (!parsed.success) return { ok: false, code: "invalid_request" };
  if (!expectedClientId) return { ok: false, code: "client_not_configured" };
  if (parsed.data.client.id !== expectedClientId) return { ok: false, code: "client_mismatch" };
  if (parsed.data.user.id !== expectedUserId) return { ok: false, code: "user_mismatch" };

  const scopes = parsed.data.scope.trim().split(/\s+/);
  if (
    scopes.length === 0 ||
    new Set(scopes).size !== scopes.length ||
    scopes.some((scope) => !ALLOWED_SCOPE_SET.has(scope))
  ) {
    return { ok: false, code: "scope_not_allowed" };
  }
  if (!isSafeMiloRedirectUri(parsed.data.redirect_uri, configuredRedirectUri)) {
    return { ok: false, code: "redirect_not_allowed" };
  }
  return { ok: true, details: parsed.data, scopes };
}

export function consentErrorMessage(code: OAuthConsentErrorCode) {
  switch (code) {
    case "client_not_configured":
      return "Milo sign-in is not configured yet. Please try again later.";
    case "client_mismatch":
    case "redirect_not_allowed":
      return "This authorization request is not registered for Milo.";
    case "user_mismatch":
      return "This authorization request belongs to a different account.";
    case "scope_not_allowed":
      return "This client requested access Milo does not provide.";
    default:
      return "This authorization request is invalid or expired.";
  }
}
