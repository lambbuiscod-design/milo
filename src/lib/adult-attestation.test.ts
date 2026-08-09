import { describe, expect, it } from "vitest";
import {
  ADULT_ATTESTATION_TTL_SECONDS,
  createAdultAttestation,
  verifyAdultAttestation,
} from "@/lib/adult-attestation";

const secret = "a".repeat(32);
const now = Date.UTC(2026, 7, 9, 12, 0, 0);

describe("adult attestation", () => {
  it("binds a short-lived proof to a normalized email without storing the email", () => {
    const token = createAdultAttestation(" Person@Example.com ", secret, now);
    expect(token).not.toContain("Person");
    expect(token).not.toContain("example.com");
    expect(verifyAdultAttestation(token, "person@example.com", secret, now)).toBe(true);
  });

  it("rejects another email, tampering, and expiration", () => {
    const token = createAdultAttestation("person@example.com", secret, now);
    expect(verifyAdultAttestation(token, "other@example.com", secret, now)).toBe(false);
    expect(verifyAdultAttestation(`${token}x`, "person@example.com", secret, now)).toBe(false);
    expect(
      verifyAdultAttestation(
        token,
        "person@example.com",
        secret,
        now + (ADULT_ATTESTATION_TTL_SECONDS + 1) * 1000,
      ),
    ).toBe(false);
  });
});
