import { createHash } from "node:crypto";

export type ContextObservation = Readonly<{
  changed: boolean;
  hasUnacknowledgedChange: boolean;
}>;

/**
 * Content-free, in-memory change detection for normalized local context.
 * A new fingerprint must be observed twice to avoid reacting to transient UI
 * Automation/OCR churn. No conversation text is retained by this object.
 */
export class ContextChangeDetector {
  #baseline: string | null = null;
  #candidate: string | null = null;
  #candidateObservations = 0;
  #unacknowledged = false;

  observe(normalizedText: string): ContextObservation {
    if (normalizedText.length === 0) return this.#result(false);
    const fingerprint = createHash("sha256").update(normalizedText, "utf8").digest("hex");

    if (this.#baseline === null) {
      this.#baseline = fingerprint;
      this.#candidate = null;
      this.#candidateObservations = 0;
      return this.#result(false);
    }
    if (fingerprint === this.#baseline) {
      this.#candidate = null;
      this.#candidateObservations = 0;
      return this.#result(false);
    }

    if (fingerprint !== this.#candidate) {
      this.#candidate = fingerprint;
      this.#candidateObservations = 1;
      return this.#result(false);
    }

    this.#candidateObservations += 1;
    if (this.#candidateObservations < 2) return this.#result(false);

    this.#baseline = fingerprint;
    this.#candidate = null;
    this.#candidateObservations = 0;
    this.#unacknowledged = true;
    return this.#result(true);
  }

  acknowledge(): void {
    this.#unacknowledged = false;
  }

  clear(): void {
    this.#baseline = null;
    this.#candidate = null;
    this.#candidateObservations = 0;
    this.#unacknowledged = false;
  }

  #result(changed: boolean): ContextObservation {
    return { changed, hasUnacknowledgedChange: this.#unacknowledged };
  }
}
