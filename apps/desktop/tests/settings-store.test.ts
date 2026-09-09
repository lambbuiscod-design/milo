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

  it.each(["charcoal", "slate", "mauve", "caramel"] as const)(
    "accepts valid catAppearance preset %s",
    (preset) => {
      expect(isContentFreeSettings({ ...VALID_SETTINGS, catAppearance: preset })).toBe(true);
    },
  );

  it.each(["calico", "orange", "secret", "tabby"])(
    "rejects invalid catAppearance preset %s",
    (preset) => {
      expect(isContentFreeSettings({ ...VALID_SETTINGS, catAppearance: preset })).toBe(false);
    },
  );
});

describe("ContentFreeSettingsStore catAppearance persistence", () => {
  it("defaults to charcoal and persists catAppearance roundtrip", async () => {
    const { mkdtempSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const path = await import("node:path");
    const { ContentFreeSettingsStore } = await import("../src/main/settings-store");

    const tempDir = mkdtempSync(path.join(tmpdir(), "milo-settings-test-"));
    try {
      const store1 = new ContentFreeSettingsStore(tempDir);
      expect(store1.getPublicSettings().catAppearance).toBe("charcoal");

      const updated = store1.updatePublicSettings({ catAppearance: "slate" });
      expect(updated.catAppearance).toBe("slate");
      expect(store1.getPublicSettings().catAppearance).toBe("slate");

      // Verify re-opening store from disk retains persisted appearance
      const store2 = new ContentFreeSettingsStore(tempDir);
      expect(store2.getPublicSettings().catAppearance).toBe("slate");

      // Verify updating to mauve
      const updatedMauve = store2.updatePublicSettings({ catAppearance: "mauve" });
      expect(updatedMauve.catAppearance).toBe("mauve");
      const store3 = new ContentFreeSettingsStore(tempDir);
      expect(store3.getPublicSettings().catAppearance).toBe("mauve");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

