import { describe, expect, it } from "vitest";
import { isEligibleMiloAuthUser } from "@/lib/auth-eligibility";

const eligible = {
  email: "adult@example.test",
  email_confirmed_at: "2026-08-02T10:00:00.000Z",
  is_anonymous: false,
  app_metadata: { provider: "email", adult_confirmed: true },
};

describe("Milo auth eligibility", () => {
  it("accepts a verified adult-attested email identity", () => {
    expect(isEligibleMiloAuthUser(eligible)).toBe(true);
  });

  it.each([
    { ...eligible, is_anonymous: true },
    { ...eligible, email: null },
    { ...eligible, email_confirmed_at: null },
    { ...eligible, app_metadata: { provider: "anonymous" } },
    { ...eligible, app_metadata: { provider: "google" } },
    { ...eligible, app_metadata: { provider: "email" } },
  ])("rejects an ineligible or drifted identity", (identity) => {
    expect(isEligibleMiloAuthUser(identity)).toBe(false);
  });

  it("never trusts editable user metadata for eligibility", () => {
    const forgedUserMetadata = {
      ...eligible,
      app_metadata: { provider: "email" },
      user_metadata: { adult_confirmed: true },
    };
    expect(isEligibleMiloAuthUser(forgedUserMetadata)).toBe(false);
  });
});
