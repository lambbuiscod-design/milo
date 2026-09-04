import { describe, expect, it } from "vitest";
import { analysisResultSchema } from "./analysis";

const replies = [
  { category: "safe", text: "Warm reply", why_it_works: "Clear" },
  { category: "confident", text: "Confident reply", why_it_works: "Direct" },
  { category: "playful", text: "Playful reply", why_it_works: "Light" },
];

describe("structured reply validation", () => {
  it("accepts exactly one reply in every required category", () => {
    expect(analysisResultSchema.parse({ conversation_status: "clear", detected_language: "English", brief_context: "Positive chat", warning: null, replies }).replies).toHaveLength(3);
  });
  it("rejects duplicate categories", () => {
    expect(() => analysisResultSchema.parse({ conversation_status: "clear", detected_language: "English", brief_context: "", warning: null, replies: [replies[0], replies[0], replies[2]] })).toThrow(/exactly one/i);
  });
  it("requires empty ordinary replies for an unsafe result", () => {
    expect(() => analysisResultSchema.parse({ conversation_status: "unsafe", detected_language: "English", brief_context: "Risk", warning: "Get help", replies })).toThrow(/unsafe/i);
    expect(analysisResultSchema.parse({ conversation_status: "unsafe", detected_language: "English", brief_context: "Risk", warning: "Get help", replies: replies.map((reply) => ({ ...reply, text: "" })) }).conversation_status).toBe("unsafe");
  });
  it("rejects replies longer than 280 characters", () => {
    expect(() => analysisResultSchema.parse({ conversation_status: "clear", detected_language: "English", brief_context: "", warning: null, replies: [{ ...replies[0], text: "a".repeat(281) }, replies[1], replies[2]] })).toThrow();
  });
});
