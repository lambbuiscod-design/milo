import type { AuthenticatorAssuranceLevels } from "@supabase/supabase-js";

export type MfaAssurance = {
  currentLevel: AuthenticatorAssuranceLevels | null;
  nextLevel: AuthenticatorAssuranceLevels | null;
};

export type PublicTotpFactor = {
  id: string;
  friendly_name?: string;
  created_at: string;
  status: "verified";
};

/**
 * Supabase reports nextLevel=aal2 only when the user has a verified factor.
 * An enrolled user must therefore step up whenever the current JWT is not aal2.
 */
export function requiresMfaChallenge(assurance: MfaAssurance) {
  return assurance.nextLevel === "aal2" && assurance.currentLevel !== "aal2";
}

export function normalizeTotpCode(value: string) {
  return value.replace(/\D/g, "").slice(0, 6);
}

export function isCompleteTotpCode(value: string) {
  return /^\d{6}$/.test(value);
}

export function safeFactorLabel(factor: Pick<PublicTotpFactor, "friendly_name">, index: number) {
  const label = factor.friendly_name?.trim();
  return label ? label.slice(0, 80) : `Authenticator ${index + 1}`;
}
