import { describe, expect, it } from "vitest";
import { transitionDesktopState } from "../src/shared/state-machine";

describe("desktop state machine", () => {
  it("covers the visible synthetic preview lifecycle", () => {
    expect(transitionDesktopState("idle", "notice")).toBe("noticed");
    expect(transitionDesktopState("noticed", "generate")).toBe("generating");
    expect(transitionDesktopState("generating", "ready")).toBe("ready");
    expect(transitionDesktopState("ready", "fail")).toBe("error");
    expect(transitionDesktopState("error", "reset")).toBe("idle");
  });

  it("fails closed while paused", () => {
    expect(transitionDesktopState("generating", "pause")).toBe("paused");
    expect(transitionDesktopState("paused", "notice")).toBe("paused");
    expect(transitionDesktopState("paused", "generate")).toBe("paused");
    expect(transitionDesktopState("paused", "ready")).toBe("paused");
    expect(transitionDesktopState("paused", "resume")).toBe("idle");
  });

  it("accepts ready only after generation", () => {
    expect(transitionDesktopState("idle", "ready")).toBe("idle");
    expect(transitionDesktopState("noticed", "ready")).toBe("noticed");
  });
});

