import { describe, expect, it } from "vitest";
import {
  MAX_CONTEXT_CHARACTERS,
  MAX_CONTEXT_MESSAGES,
  normalizeRecentContext,
} from "../src/main/context-normalizer";

describe("ephemeral conversation context normalizer", () => {
  it("normalizes whitespace and removes empty or repeated adjacent lines", () => {
    expect(normalizeRecentContext("  Hi\r\nHi\n\u0000  Are   you free?  \n")).toEqual({
      text: "Hi\nAre you free?",
      messageCount: 2,
      truncated: true,
      participantNamesRemoved: false,
    });
  });

  it("keeps only the most recent bounded messages", () => {
    const input = Array.from({ length: MAX_CONTEXT_MESSAGES + 3 }, (_, index) => `message ${index + 1}`).join("\n");
    const result = normalizeRecentContext(input);

    expect(result.messageCount).toBe(MAX_CONTEXT_MESSAGES);
    expect(result.text.startsWith("message 4\n")).toBe(true);
    expect(result.text.endsWith(`message ${MAX_CONTEXT_MESSAGES + 3}`)).toBe(true);
    expect(result.truncated).toBe(true);
    expect(result.participantNamesRemoved).toBe(false);
  });

  it("enforces the total character boundary while preserving the newest text", () => {
    const newest = "z".repeat(600);
    const input = Array.from({ length: MAX_CONTEXT_MESSAGES }, (_, index) =>
      index === MAX_CONTEXT_MESSAGES - 1 ? newest : String(index).repeat(600),
    ).join("\n");
    const result = normalizeRecentContext(input);

    expect(result.text.length).toBeLessThanOrEqual(MAX_CONTEXT_CHARACTERS);
    expect(result.text.endsWith(newest)).toBe(true);
    expect(result.truncated).toBe(true);
    expect(result.participantNamesRemoved).toBe(false);
  });

  it("returns an empty safe context for unusable extraction", () => {
    expect(normalizeRecentContext("\u0000\n \t \r\n")).toEqual({
      text: "",
      messageCount: 0,
      truncated: false,
      participantNamesRemoved: false,
    });
  });

  it("can redact participant names locally and bound the requested recent-message count", () => {
    const result = normalizeRecentContext(
      "Alice: First\nBob: Second\nCarol: Third\nDave: Fourth\nEve: Fifth",
      { removeParticipantNames: true, maxMessages: 4 },
    );
    expect(result).toEqual({
      text: "Participant: Second\nParticipant: Third\nParticipant: Fourth\nParticipant: Fifth",
      messageCount: 4,
      truncated: true,
      participantNamesRemoved: true,
    });
  });
});
