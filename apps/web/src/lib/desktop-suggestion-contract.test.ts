// @vitest-environment node
import { describe, expect, it } from "vitest";
import { desktopSuggestionRequestSchema, desktopSuggestionResponseSchema } from "@/lib/desktop-suggestion-contract";

const request = {
  requestId: "00000000-0000-4000-8000-000000000042",
  clientVersion: "0.1.0",
  tone: "warm",
  relationshipStage: "dating",
  messages: [
    { role: "other", text: "Are you free this weekend?" },
    { role: "self", text: "I think so — Saturday works." },
  ],
} as const;

describe("desktop suggestion contract", () => {
  it("accepts only bounded normalized messages", () => {
    expect(desktopSuggestionRequestSchema.parse(request)).toEqual(request);
    expect(() => desktopSuggestionRequestSchema.parse({ ...request, image: "data:image/png;base64,secret" })).toThrow();
    expect(() => desktopSuggestionRequestSchema.parse({ ...request, messages: [{ role: "other", text: "x", name: "private" }] })).toThrow();
    expect(() => desktopSuggestionRequestSchema.parse({ ...request, messages: [{ role: "other", text: "hello\u0000there" }] })).toThrow();
    expect(() => desktopSuggestionRequestSchema.parse({ ...request, messages: [] })).toThrow();
    expect(() => desktopSuggestionRequestSchema.parse({ ...request, messages: Array.from({ length: 9 }, () => ({ role: "other", text: "message" })) })).toThrow();
    expect(() => desktopSuggestionRequestSchema.parse({ ...request, messages: [{ role: "other", text: "x".repeat(1_000) }, { role: "self", text: "x".repeat(1_000) }, { role: "other", text: "x".repeat(1_000) }, { role: "self", text: "x".repeat(1_001) }] })).toThrow();
  });

  it("requires exactly one reply for each category and blocks unsafe text", () => {
    const base = {
      requestId: request.requestId,
      conversationStatus: "clear",
      detectedLanguage: "English",
      briefContext: "A friendly exchange.",
      warning: null,
      replies: [
        { category: "safe", text: "That sounds good.", whyItWorks: "Warm and direct." },
        { category: "confident", text: "Saturday works for me.", whyItWorks: "It proposes a clear next step." },
        { category: "playful", text: "Only if dessert is involved.", whyItWorks: "It adds light personality." },
      ],
      remaining: 4,
    } as const;
    expect(desktopSuggestionResponseSchema.parse(base)).toEqual(base);
    expect(() => desktopSuggestionResponseSchema.parse({ ...base, replies: [...base.replies, base.replies[0]] })).toThrow();
    expect(() => desktopSuggestionResponseSchema.parse({ ...base, conversationStatus: "unsafe", replies: base.replies })).toThrow();
  });
});
