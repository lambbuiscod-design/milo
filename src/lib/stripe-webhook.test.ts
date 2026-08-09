import { describe, expect, it } from "vitest";
import {
  getStripeEventReceiptState,
  isDuplicateStripeEventError,
  isRecordedStripeEventComplete,
  STRIPE_EVENT_IN_PROGRESS_STATUS,
  STRIPE_EVENT_PROCESSING_LEASE_MS,
} from "@/lib/stripe-webhook";

describe("Stripe webhook idempotency", () => {
  it("recognizes the Postgres unique-key error as a previously recorded event", () => {
    expect(isDuplicateStripeEventError({ code: "23505" })).toBe(true);
    expect(isDuplicateStripeEventError({ code: "42501" })).toBe(false);
    expect(isDuplicateStripeEventError(null)).toBe(false);
  });

  it("retries recorded events that never finished processing", () => {
    expect(isRecordedStripeEventComplete({ processed_at: null })).toBe(false);
    expect(isRecordedStripeEventComplete({ processed_at: "2026-08-01T12:00:00.000Z" })).toBe(true);
    expect(isRecordedStripeEventComplete(null)).toBe(false);
  });

  it("prevents concurrent processing while the event receipt lease is fresh", () => {
    expect(STRIPE_EVENT_IN_PROGRESS_STATUS).toBeGreaterThanOrEqual(400);
    const now = Date.parse("2026-08-01T12:04:00.000Z");
    expect(
      getStripeEventReceiptState(
        { received_at: "2026-08-01T12:00:00.000Z", processed_at: null },
        now,
      ),
    ).toBe("processing");
    expect(
      getStripeEventReceiptState(
        { received_at: "2026-08-01T12:00:00.000Z", processed_at: null },
        Date.parse("2026-08-01T12:00:00.000Z") + STRIPE_EVENT_PROCESSING_LEASE_MS,
      ),
    ).toBe("retry");
  });

  it("recognizes completed and malformed receipts safely", () => {
    expect(
      getStripeEventReceiptState({
        received_at: "2026-08-01T12:00:00.000Z",
        processed_at: "2026-08-01T12:00:01.000Z",
      }),
    ).toBe("processed");
    expect(getStripeEventReceiptState({ received_at: "invalid", processed_at: null })).toBe(
      "retry",
    );
    expect(getStripeEventReceiptState(null)).toBe("retry");
  });
});
