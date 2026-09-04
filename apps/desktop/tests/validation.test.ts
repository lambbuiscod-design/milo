import { describe, expect, it } from "vitest";
import {
  RequestValidationError,
  parseAskMiloInput,
  parseContextPreview,
  parseContextPreviewInput,
  parseNudgePositionInput,
  parseNoPayload,
  parseSettingsPatch,
} from "../src/shared/validation";

describe("strict desktop IPC validation", () => {
  it("permits only the content-free selected-window ask trigger", () => {
    expect(parseAskMiloInput({ mode: "selected_window" })).toEqual({ mode: "selected_window" });
    expect(() => parseAskMiloInput({ mode: "selected_window", transcript: "secret" })).toThrow(RequestValidationError);
    expect(() => parseAskMiloInput({ messages: ["hello"] })).toThrow(RequestValidationError);
  });

  it("bounds the explicit local context preview request", () => {
    expect(parseContextPreviewInput({ removeParticipantNames: true, maxMessages: 4 })).toEqual({
      removeParticipantNames: true,
      maxMessages: 4,
    });
    expect(() => parseContextPreviewInput({ removeParticipantNames: true, maxMessages: 5 })).toThrow(RequestValidationError);
    expect(() => parseContextPreviewInput({ removeParticipantNames: true, maxMessages: 8, text: "private" })).toThrow(RequestValidationError);
  });

  it("accepts only bounded normalized preview output", () => {
    expect(parseContextPreview({
      text: "Participant: hello",
      messageCount: 1,
      truncated: false,
      participantNamesRemoved: true,
      maxMessages: 8,
    })).toMatchObject({ participantNamesRemoved: true, maxMessages: 8 });
    expect(() => parseContextPreview({
      text: "private",
      messageCount: 1,
      truncated: false,
      participantNamesRemoved: true,
      maxMessages: 8,
      rawConversation: "private",
    })).toThrow(RequestValidationError);
  });

  it("rejects unknown or content-bearing settings keys", () => {
    expect(parseSettingsPatch({ theme: "dark", motion: "reduced" })).toEqual({
      theme: "dark",
      motion: "reduced",
    });
    expect(() => parseSettingsPatch({ theme: "dark", windowTitle: "private" })).toThrow(RequestValidationError);
    expect(() => parseSettingsPatch({ conversation: "private" })).toThrow(RequestValidationError);
  });

  it("bounds and enums keyboard movement", () => {
    expect(parseNudgePositionInput({ direction: "left", step: 40 })).toEqual({ direction: "left", step: 40 });
    expect(() => parseNudgePositionInput({ direction: "left", step: 1000 })).toThrow(RequestValidationError);
    expect(() => parseNudgePositionInput({ direction: "diagonal", step: 10 })).toThrow(RequestValidationError);
  });

  it("accepts a truly empty payload but rejects oversized payloads", () => {
    expect(parseNoPayload(undefined)).toBeUndefined();
    expect(() => parseSettingsPatch({ theme: "x".repeat(5_000) })).toThrow(RequestValidationError);
  });
});
