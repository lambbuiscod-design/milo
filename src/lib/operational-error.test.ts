import { describe, expect, it } from "vitest";
import { operationalErrorType } from "@/lib/operational-error";

describe("operational error classification", () => {
  it("preserves explicit machine codes and safe error names", () => {
    expect(operationalErrorType(new Error("BILLING_PROFILE_UNAVAILABLE"))).toBe(
      "BILLING_PROFILE_UNAVAILABLE",
    );
    const provider = new Error("sensitive provider details");
    provider.name = "StripeConnectionError";
    expect(operationalErrorType(provider)).toBe("StripeConnectionError");
  });

  it("never returns arbitrary messages", () => {
    expect(operationalErrorType(new Error("card 4242 failed"))).toBe("Error");
    expect(operationalErrorType({ message: "secret" })).toBe("UnknownError");
  });
});
