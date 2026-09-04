const AUTH_ERROR_MESSAGES = {
  invalid_email: "Enter a valid email address.",
  adult_required: "You must confirm that you are 18 or older.",
  auth_unconfigured: "Sign-in is temporarily unavailable.",
  magic_link_failed: "We could not send that link. Wait a moment and try again.",
  invalid_link: "This sign-in link is invalid or expired.",
  account_ineligible: "Use a verified email account and complete the 18+ confirmation.",
} as const;

export type AuthErrorCode = keyof typeof AUTH_ERROR_MESSAGES;

export function authErrorMessage(code: string | null | undefined) {
  return code && Object.hasOwn(AUTH_ERROR_MESSAGES, code)
    ? AUTH_ERROR_MESSAGES[code as AuthErrorCode]
    : null;
}
