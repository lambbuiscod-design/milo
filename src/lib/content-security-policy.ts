const NONCE_PATTERN = /^[A-Za-z0-9+/_=-]{16,128}$/;

export function buildContentSecurityPolicy(nonce: string, isDevelopment: boolean) {
  if (!NONCE_PATTERN.test(nonce)) throw new Error("Invalid CSP nonce.");

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    "script-src-attr 'none'",
    // Next.js and Tailwind emit runtime style elements that do not all receive
    // the request nonce. Script execution remains nonce-locked; inline CSS is
    // allowed so production hydration does not discard the application UI.
    "style-src 'self' 'unsafe-inline'",
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self' data:",
    `connect-src 'self' https://*.supabase.co wss://*.supabase.co${isDevelopment ? " ws://localhost:* ws://127.0.0.1:*" : ""}`,
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}
