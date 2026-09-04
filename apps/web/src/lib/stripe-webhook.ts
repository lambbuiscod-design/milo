export const STRIPE_EVENT_PROCESSING_LEASE_MS = 5 * 60 * 1000;
// Stripe retries non-2xx webhook responses. Never acknowledge an event while
// its first worker may still fail before recording completion.
export const STRIPE_EVENT_IN_PROGRESS_STATUS = 409;

type StripeEventReceipt = {
  processed_at?: string | null;
  received_at?: string | null;
};

export function isDuplicateStripeEventError(error: { code?: string } | null) {
  return error?.code === "23505";
}

export function isRecordedStripeEventComplete(row: { processed_at?: string | null } | null) {
  return Boolean(row?.processed_at);
}

export function getStripeEventReceiptState(
  row: StripeEventReceipt | null,
  nowMs = Date.now(),
  leaseMs = STRIPE_EVENT_PROCESSING_LEASE_MS,
): "processed" | "processing" | "retry" {
  if (isRecordedStripeEventComplete(row)) return "processed";

  const receivedAtMs = Date.parse(row?.received_at ?? "");
  if (!Number.isFinite(receivedAtMs)) return "retry";
  return nowMs - receivedAtMs < leaseMs ? "processing" : "retry";
}
