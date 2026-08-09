// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("MFA route enforcement", () => {
  it("checks AAL before every cookie-authenticated product API", () => {
    const routes = [
      "src/app/api/analyze/route.ts",
      "src/app/api/feedback/route.ts",
      "src/app/api/events/route.ts",
      "src/app/api/billing/checkout/route.ts",
      "src/app/api/billing/portal/route.ts",
      "src/app/api/account/delete/route.ts",
    ];

    for (const route of routes) {
      const code = source(route);
      expect(code, route).toContain("getMfaAuthState");
      expect(code, route).toMatch(/auth\.status\s*!==\s*"authorized"|auth\.status\s*===\s*"unauthenticated"/);
    }
  });

  it("redirects protected pages to the TOTP challenge", () => {
    const auth = source("src/lib/auth.ts");
    expect(auth).toContain("requiresMfaChallenge");
    expect(auth).toContain("/mfa?next=");
    expect(auth).toContain("state.status === \"mfa_required\"");
    expect(auth).toContain("state.status === \"ineligible\"");
    expect(auth).toContain("isEligibleMiloAuthUser(userData.user)");
  });

  it("requires an authenticator-backed session for the admin surface", () => {
    const auth = source("src/lib/auth.ts");
    const admin = source("src/app/admin/page.tsx");
    expect(auth).toContain("export async function requireAal2User");
    expect(auth).toContain("if (!state.isAal2)");
    expect(admin).toContain('requireAal2User("/admin")');
  });
});
