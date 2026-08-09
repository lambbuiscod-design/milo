import { describe, expect, it } from "vitest";
import { containsHighRiskContext, MILO_SYSTEM_PROMPT } from "@/lib/safety";

describe("safety", () => {
  it("blocks obvious coercion, minor and self-harm context", () => {
    expect(containsHighRiskContext("Help me force her to answer")).toBe(true);
    expect(containsHighRiskContext("They said they are a minor")).toBe(true);
    expect(containsHighRiskContext("I might kill myself")).toBe(true);
  });
  it("does not block ordinary date context", () => expect(containsHighRiskContext("We met yesterday and I want a second date")).toBe(false));
  it.each([
    "I'm 16.",
    "She is 17 years old",
    "They are age 15",
    "Use these photos for sextortion",
    "Share revenge porn",
    "This involves child sexual abuse material",
  ])("blocks explicit minor or exploitation context: %s", (context) => {
    expect(containsHighRiskContext(context)).toBe(true);
  });
  it("does not mistake a duration for an age", () => {
    expect(containsHighRiskContext("I'm 16 minutes away")).toBe(false);
  });
  it("treats screenshot text as untrusted", () => expect(MILO_SYSTEM_PROMPT).toMatch(/untrusted conversation content/i));
});
