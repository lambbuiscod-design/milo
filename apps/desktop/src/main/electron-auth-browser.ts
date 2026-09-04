import { shell } from "electron";
import { validateAuthBrowserUrl } from "./auth-session";

/**
 * Creates a system-browser opener that only accepts URLs on the configured
 * Supabase HTTPS origin. AuthSession also constructs the fixed authorize path,
 * so an accidental caller cannot turn this into a general-purpose URL opener.
 */
export function createAuthBrowserOpener(configuredOrigin: string): (url: string) => Promise<void> {
  return async (url: string) => {
    await shell.openExternal(validateAuthBrowserUrl(configuredOrigin, url));
  };
}
