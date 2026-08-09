import { createHmac, timingSafeEqual } from "node:crypto";

export const ADULT_ATTESTATION_TTL_SECONDS = 15 * 60;
const TOKEN_VERSION = "v1";

function normalizedEmail(email: string) {
  return email.trim().toLowerCase();
}

function signature(email: string, expiresAt: number, secret: string) {
  return createHmac("sha256", secret)
    .update(`${TOKEN_VERSION}\n${expiresAt}\n${normalizedEmail(email)}`)
    .digest("base64url");
}

/**
 * Produces a short-lived proof that the first-party Milo form received an 18+
 * confirmation for this email. The email itself is deliberately not stored in
 * the cookie.
 */
export function createAdultAttestation(
  email: string,
  secret: string,
  nowMs = Date.now(),
) {
  const expiresAt = Math.floor(nowMs / 1000) + ADULT_ATTESTATION_TTL_SECONDS;
  return `${TOKEN_VERSION}.${expiresAt}.${signature(email, expiresAt, secret)}`;
}

export function verifyAdultAttestation(
  token: string | undefined,
  email: string,
  secret: string,
  nowMs = Date.now(),
) {
  if (!token || !email || !secret) return false;
  const [version, expiresText, suppliedSignature, extra] = token.split(".");
  if (extra !== undefined || version !== TOKEN_VERSION || !/^\d{10}$/.test(expiresText ?? "")) {
    return false;
  }

  const expiresAt = Number(expiresText);
  const nowSeconds = Math.floor(nowMs / 1000);
  if (
    !Number.isSafeInteger(expiresAt) ||
    expiresAt < nowSeconds ||
    expiresAt > nowSeconds + ADULT_ATTESTATION_TTL_SECONDS
  ) {
    return false;
  }

  const expected = Buffer.from(signature(email, expiresAt, secret), "utf8");
  const supplied = Buffer.from(suppliedSignature ?? "", "utf8");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
