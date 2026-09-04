export type MiloAuthIdentity = {
  email?: string | null;
  email_confirmed_at?: string | null;
  is_anonymous?: boolean;
  app_metadata?: Record<string, unknown> | null;
};

/**
 * Defense in depth against Auth dashboard drift: Milo accepts only a verified
 * non-anonymous email identity that completed the adult self-attestation in
 * the first-party onboarding flow.
 */
export function isEligibleMiloAuthUser(user: MiloAuthIdentity) {
  const provider = user.app_metadata?.provider;
  return (
    user.is_anonymous !== true &&
    typeof user.email === "string" &&
    user.email.trim().length > 0 &&
    typeof user.email_confirmed_at === "string" &&
    user.email_confirmed_at.length > 0 &&
    provider === "email" &&
    user.app_metadata?.adult_confirmed === true
  );
}
