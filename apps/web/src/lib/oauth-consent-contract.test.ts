import { describe, expect, it } from "vitest";
import {
  consentDestination,
  isSafeMiloRedirectUri,
  isSafeMiloRedirectUrl,
  parseOAuthAuthorizationId,
  validateMiloAuthorizationDetails,
} from "@/lib/oauth-consent-contract";

const id = "7f2c58f4-9bf5-4f75-8f85-3d94e4f8aa19";
const callback = "http://127.0.0.1:43821/oauth/callback";
const details = {
  authorization_id: id,
  redirect_uri: callback,
  client: { id: "milo-desktop", name: "Milo Desktop", uri: "", logo_uri: "" },
  user: { id: "00000000-0000-4000-8000-000000000001", email: "adult@example.com" },
  scope: "openid email profile",
};

describe("OAuth consent boundaries", () => {
  it("bounds and preserves only a safe authorization destination", () => {
    expect(parseOAuthAuthorizationId(id)).toBe(id);
    expect(parseOAuthAuthorizationId("../../etc/passwd")).toBeNull();
    expect(parseOAuthAuthorizationId("a".repeat(129))).toBeNull();
    expect(consentDestination(id)).toBe(`/oauth/consent?authorization_id=${id}`);
    expect(consentDestination("../../etc/passwd")).toBe("/oauth/consent?error=invalid_request");
  });

  it("allows only a registered loopback callback and generated OAuth query", () => {
    expect(isSafeMiloRedirectUri(callback, callback)).toBe(true);
    expect(isSafeMiloRedirectUri("https://evil.example/callback", callback)).toBe(false);
    expect(isSafeMiloRedirectUri("http://127.0.0.1:43821/oauth/callback?next=https://evil.example", callback)).toBe(false);
    expect(isSafeMiloRedirectUrl(`${callback}?code=one&state=two`, callback, callback)).toBe(true);
    expect(isSafeMiloRedirectUrl(`${callback}?code=one&next=https://evil.example`, callback, callback)).toBe(false);
    expect(isSafeMiloRedirectUrl("https://evil.example/callback?code=one", callback, callback)).toBe(false);
  });

  it("requires the configured client, current user, safe scopes and callback", () => {
    expect(validateMiloAuthorizationDetails(details, "milo-desktop", details.user.id, callback).ok).toBe(true);
    expect(validateMiloAuthorizationDetails(details, undefined, details.user.id, callback)).toMatchObject({ ok: false, code: "client_not_configured" });
    expect(validateMiloAuthorizationDetails(details, "other-client", details.user.id, callback)).toMatchObject({ ok: false, code: "client_mismatch" });
    expect(validateMiloAuthorizationDetails(details, "milo-desktop", "00000000-0000-4000-8000-000000000002", callback)).toMatchObject({ ok: false, code: "user_mismatch" });
    expect(validateMiloAuthorizationDetails({ ...details, scope: "openid admin" }, "milo-desktop", details.user.id, callback)).toMatchObject({ ok: false, code: "scope_not_allowed" });
  });
});
