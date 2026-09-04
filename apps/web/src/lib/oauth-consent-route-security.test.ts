import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd(), "src");

describe("OAuth consent route security contract", () => {
  it("uses Supabase's official consent methods and AAL2 gate", () => {
    const page = readFileSync(resolve(root, "app/oauth/consent/page.tsx"), "utf8");
    const actions = readFileSync(resolve(root, "app/oauth/consent/actions.ts"), "utf8");
    expect(page).toContain("requireAal2User");
    expect(page).toContain("getAuthorizationDetails");
    expect(actions).toContain("approveAuthorization");
    expect(actions).toContain("denyAuthorization");
    expect(actions).toContain("skipBrowserRedirect: true");
    expect(actions).toContain("isSafeMiloRedirectUrl");
  });

  it("does not add a raw callback or token to the consent UI", () => {
    const page = readFileSync(resolve(root, "app/oauth/consent/page.tsx"), "utf8");
    const actions = readFileSync(resolve(root, "app/oauth/consent/actions.ts"), "utf8");
    expect(page).not.toMatch(/access_token|refresh_token|console\.(log|error)/);
    expect(actions).not.toMatch(/access_token|refresh_token|console\.(log|error)/);
    expect(actions).toContain("consentDestination(authorizationId)");
  });
});
