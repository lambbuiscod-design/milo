import { describe, expect, it } from "vitest";
import { isContentFreeSettings } from "../src/main/settings-store";

const VALID_SETTINGS = {
  version: 1,
  theme: "system",
  motion: "reduced",
  showWatchingIndicator: true,
  paused: false,
  overlayPositions: {
    "123": { x: -1200, y: 240 },
  },
};

describe("content-free persisted settings schema", () => {
  it("accepts only display coordinates and presentation preferences", () => {
    expect(isContentFreeSettings(VALID_SETTINGS)).toBe(true);
  });

  it.each(["transcript", "reply", "windowTitle", "participant", "token", "clipboard"])(
    "rejects forbidden %s content",
    (key) => {
      expect(isContentFreeSettings({ ...VALID_SETTINGS, [key]: "private" })).toBe(false);
    },
  );

  it("bounds per-display coordinate storage", () => {
    const tooMany = Object.fromEntries(
      Array.from({ length: 17 }, (_, index) => [String(index), { x: index, y: index }]),
    );
    expect(isContentFreeSettings({ ...VALID_SETTINGS, overlayPositions: tooMany })).toBe(false);
  });
});

