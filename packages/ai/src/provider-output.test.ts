import { describe, expect, it } from "vitest";
import { attachReplyCategories } from "./provider-output";

describe("attachReplyCategories", () => {
  it("assigns the three public categories by the required provider order", () => {
    const result = attachReplyCategories({
      conversation_status: "clear",
      replies: [
        { text: "Safe", why_it_works: "Steady" },
        { text: "Confident", why_it_works: "Direct" },
        { text: "Playful", why_it_works: "Light" },
      ],
    }) as { replies: Array<{ category: string }> };

    expect(result.replies.map((reply) => reply.category)).toEqual(["safe", "confident", "playful"]);
  });

  it("overwrites unreliable model labels instead of trusting them", () => {
    const result = attachReplyCategories({
      replies: [
        { category: "playful", text: "One", why_it_works: "One" },
        { category: "playful", text: "Two", why_it_works: "Two" },
        { category: "safe", text: "Three", why_it_works: "Three" },
      ],
    }) as { replies: Array<{ category: string }> };

    expect(result.replies.map((reply) => reply.category)).toEqual(["safe", "confident", "playful"]);
  });

  it("leaves malformed top-level values for Zod to reject", () => {
    expect(attachReplyCategories(null)).toBeNull();
    expect(attachReplyCategories({ replies: "invalid" })).toEqual({ replies: "invalid" });
  });
});
