import { describe, expect, it } from "vitest";
import {
  AccountBrowserError,
  buildAccountDestinationUrl,
  normalizeMiloWebOrigin,
} from "../src/main/electron-account-browser";

describe("fixed Milo account browser destinations", () => {
  it("maps only known destinations onto the configured HTTPS origin", () => {
    expect(buildAccountDestinationUrl("https://milo.example", "account")).toBe("https://milo.example/account");
    expect(buildAccountDestinationUrl("https://milo.example", "billing")).toBe("https://milo.example/account");
    expect(buildAccountDestinationUrl("https://milo.example", "privacy")).toBe("https://milo.example/privacy");
    expect(buildAccountDestinationUrl("https://milo.example", "terms")).toBe("https://milo.example/terms");
  });

  it("rejects credentials, paths, queries, fragments, and non-HTTPS production origins", () => {
    for (const value of [
      "http://milo.example",
      "https://user:pass@milo.example",
      "https://milo.example/app",
      "https://milo.example?next=https://evil.example",
      "https://milo.example/#x",
    ]) {
      expect(() => normalizeMiloWebOrigin(value)).toThrowError(AccountBrowserError);
    }
  });

  it("allows HTTP only for explicit local development", () => {
    expect(normalizeMiloWebOrigin("http://127.0.0.1:3000", true)).toBe("http://127.0.0.1:3000");
    expect(() => normalizeMiloWebOrigin("http://192.168.1.10:3000", true)).toThrowError(AccountBrowserError);
  });
});
