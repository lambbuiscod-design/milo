export const MILO_E2E_AUTH_COOKIE = "milo-e2e-auth";

export function isE2EMode() {
  return process.env.NODE_ENV !== "production" && process.env.MILO_E2E_MODE === "true";
}
