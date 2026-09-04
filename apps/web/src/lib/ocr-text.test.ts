import { describe, expect, it } from "vitest";
import { isUsefulConversationText, normalizeOcrText } from "@/lib/ocr-text";

describe("OCR transcript boundaries", () => {
  it("removes controls, normalizes whitespace and preserves lines", () => {
    expect(normalizeOcrText("  Alex:\u0000  Hello   there \n\n\n Me: Hi  ")).toBe(
      "Alex: Hello there\n\nMe: Hi",
    );
  });

  it("caps transcript length before it reaches the provider", () => {
    expect(normalizeOcrText("a".repeat(20_000))).toHaveLength(12_000);
  });

  it("rejects empty or non-conversational OCR noise", () => {
    expect(isUsefulConversationText("... ---")).toBe(false);
    expect(isUsefulConversationText("Alex: Hello")).toBe(true);
  });
});
