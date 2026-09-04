const DEFAULT_AUTH_DESTINATION = "/dashboard";
const LOCAL_ORIGIN = "https://milo.invalid";

/**
 * Returns a same-origin path suitable for an authentication redirect.
 * Backslashes and encoded path separators are rejected because browsers can
 * normalize them into scheme-relative URLs.
 */
export function sanitizeAuthDestination(
  value: string | null | undefined,
  fallback = DEFAULT_AUTH_DESTINATION,
) {
  const candidate = value?.trim();
  if (
    !candidate ||
    candidate.length > 1024 ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\") ||
    /%(?:2f|5c|25)/i.test(candidate) ||
    /[\u0000-\u001f\u007f]/.test(candidate)
  ) {
    return fallback;
  }

  try {
    const parsed = new URL(candidate, LOCAL_ORIGIN);
    if (parsed.origin !== LOCAL_ORIGIN) return fallback;
    const normalized = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    if (
      !parsed.pathname.startsWith("/") ||
      parsed.pathname.startsWith("//") ||
      parsed.pathname.includes("\\") ||
      /%(?:2f|5c|25)/i.test(normalized) ||
      /[\u0000-\u001f\u007f]/.test(normalized)
    ) {
      return fallback;
    }
    const finalUrl = new URL(normalized, LOCAL_ORIGIN);
    return finalUrl.origin === LOCAL_ORIGIN ? normalized : fallback;
  } catch {
    return fallback;
  }
}
