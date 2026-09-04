import { shell } from "electron";
import type { AccountDestination } from "../shared/contracts";

const DESTINATION_PATHS: Readonly<Record<AccountDestination, string>> = Object.freeze({
  account: "/account",
  billing: "/account",
  privacy: "/privacy",
  terms: "/terms",
});

export class AccountBrowserError extends Error {
  constructor() {
    super("Milo rejected an invalid account destination.");
    this.name = "AccountBrowserError";
  }
}

export function normalizeMiloWebOrigin(value: string, allowInsecureLocalhost = false): string {
  try {
    const url = new URL(value);
    const insecureLocal = allowInsecureLocalhost && url.protocol === "http:" &&
      (url.hostname === "127.0.0.1" || url.hostname === "localhost");
    if (
      (url.protocol !== "https:" && !insecureLocal) ||
      url.pathname !== "/" || url.search || url.hash || url.username || url.password
    ) {
      throw new AccountBrowserError();
    }
    return url.origin;
  } catch (error) {
    if (error instanceof AccountBrowserError) throw error;
    throw new AccountBrowserError();
  }
}

export function buildAccountDestinationUrl(
  configuredOrigin: string,
  destination: AccountDestination,
  allowInsecureLocalhost = false,
): string {
  const origin = normalizeMiloWebOrigin(configuredOrigin, allowInsecureLocalhost);
  const path = DESTINATION_PATHS[destination];
  if (path === undefined) throw new AccountBrowserError();
  return new URL(path, origin).toString();
}

export function createAccountBrowserOpener(
  configuredOrigin: string,
  allowInsecureLocalhost = false,
): (destination: AccountDestination) => Promise<void> {
  const origin = normalizeMiloWebOrigin(configuredOrigin, allowInsecureLocalhost);
  return async (destination) => {
    await shell.openExternal(buildAccountDestinationUrl(origin, destination, allowInsecureLocalhost));
  };
}
