import { describe, expect, it } from "vitest";
import { ContextChangeDetector } from "../src/main/context-change-detector";

describe("ephemeral local context change detector", () => {
  it("establishes a baseline without reporting an existing chat as new", () => {
    const detector = new ContextChangeDetector();
    expect(detector.observe("hello")).toEqual({ changed: false, hasUnacknowledgedChange: false });
  });

  it("requires the same changed context twice before reporting it", () => {
    const detector = new ContextChangeDetector();
    detector.observe("hello");
    expect(detector.observe("hello\nnew message").changed).toBe(false);
    expect(detector.observe("hello\nnew message")).toEqual({ changed: true, hasUnacknowledgedChange: true });
  });

  it("does not confirm transient extraction churn", () => {
    const detector = new ContextChangeDetector();
    detector.observe("baseline");
    detector.observe("temporary a");
    detector.observe("temporary b");
    expect(detector.observe("baseline")).toEqual({ changed: false, hasUnacknowledgedChange: false });
  });

  it("supports acknowledge and lifecycle clearing without retaining content", () => {
    const detector = new ContextChangeDetector();
    detector.observe("one");
    detector.observe("one\ntwo");
    detector.observe("one\ntwo");
    detector.acknowledge();
    expect(detector.observe("one\ntwo").hasUnacknowledgedChange).toBe(false);
    detector.clear();
    expect(detector.observe("completely different")).toEqual({ changed: false, hasUnacknowledgedChange: false });
  });

  it("ignores empty observations", () => {
    const detector = new ContextChangeDetector();
    expect(detector.observe("")).toEqual({ changed: false, hasUnacknowledgedChange: false });
    expect(detector.observe("")).toEqual({ changed: false, hasUnacknowledgedChange: false });
  });
});
