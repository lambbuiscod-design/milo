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
  it("defaults to charcoal and preserves a legacy selected appearance", async () => {
    const { mkdtempSync, rmSync, writeFileSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const path = await import("node:path");
    const { ContentFreeSettingsStore } = await import("../src/main/settings-store");

    const tempDir = mkdtempSync(path.join(tmpdir(), "milo-settings-test-"));
    try {
      const store1 = new ContentFreeSettingsStore(tempDir);
      expect(store1.getPublicSettings().catAppearance).toBe("charcoal");
      expect(() => store1.updatePublicSettings({ catAppearance: "slate" })).toThrow("MILO_REWARD_LOCKED");

      writeFileSync(
        path.join(tempDir, "milo-settings.json"),
        JSON.stringify({ ...VALID_SETTINGS, catAppearance: "slate" }),
      );
      const store2 = new ContentFreeSettingsStore(tempDir);
      expect(store2.getPublicSettings().catAppearance).toBe("slate");
      expect(store2.getPublicSettings().appearance?.fur).toBe("slate");
      expect(store2.getPublicSettings().progress?.unlockedRewards).toContain("fur-slate");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe("ContentFreeSettingsStore progression migration and limits", () => {
  it("migrates legacy content-free settings to version 3 without losing preferences", async () => {
    const { mkdtempSync, readFileSync, rmSync, writeFileSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const path = await import("node:path");
    const { ContentFreeSettingsStore } = await import("../src/main/settings-store");
    const tempDir = mkdtempSync(path.join(tmpdir(), "milo-settings-migration-"));
    try {
      writeFileSync(path.join(tempDir, "milo-settings.json"), JSON.stringify(VALID_SETTINGS));
      const store = new ContentFreeSettingsStore(tempDir);
      expect(store.getPublicSettings().motion).toBe("reduced");
      const migrated = JSON.parse(readFileSync(path.join(tempDir, "milo-settings.json"), "utf8")) as { version: number };
      expect(migrated.version).toBe(3);
      expect(store.getPublicSettings()).toMatchObject({
        uiSoundEnabled: true,
        miloSoundEnabled: true,
        activitySoundEnabled: false,
      });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("persists the throttle, daily cap, and streak across restarts", async () => {
    const { mkdtempSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const path = await import("node:path");
    const { ContentFreeSettingsStore } = await import("../src/main/settings-store");
    const tempDir = mkdtempSync(path.join(tmpdir(), "milo-settings-xp-"));
    let nowMs = Date.parse("2026-09-12T08:00:00.000Z");
    const now = () => new Date(nowMs);
    try {
      let store = new ContentFreeSettingsStore(tempDir, { now });
      expect(store.addXp(5)).toBe(true);
      expect(store.getPublicSettings().progress?.currentStreak).toBe(1);

      store = new ContentFreeSettingsStore(tempDir, { now });
      expect(store.addXp(5)).toBe(false);
      nowMs += 2_000;
      expect(store.addXp(5)).toBe(true);
      nowMs += 2_000;
      expect(store.addXp(5)).toBe(true);
      nowMs += 2_000;
      expect(store.addXp(5)).toBe(true);
      nowMs += 2_000;
      expect(store.addXp(1)).toBe(false);

      nowMs = Date.parse("2026-09-13T08:00:00.000Z");
      store = new ContentFreeSettingsStore(tempDir, { now });
      expect(store.addXp(5)).toBe(true);
      expect(store.getPublicSettings().progress?.currentStreak).toBe(2);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("enforces reward ownership in the main-process store", async () => {
    const { mkdtempSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const path = await import("node:path");
    const { ContentFreeSettingsStore } = await import("../src/main/settings-store");
    const tempDir = mkdtempSync(path.join(tmpdir(), "milo-settings-rewards-"));
    try {
      const store = new ContentFreeSettingsStore(tempDir);
      expect(() => store.updatePublicSettings({ catAppearance: "slate" })).toThrow("MILO_REWARD_LOCKED");
      expect(() => store.updatePublicSettings({
        room: { background: "default", items: [{ id: "lamp", x: 20, y: 20, scale: 1 }] },
      })).toThrow("MILO_REWARD_LOCKED");
      expect(store.updatePublicSettings({
        room: { background: "default", items: [{ id: "plant", x: 20, y: 20, scale: 1 }] },
      }).room?.items[0]?.id).toBe("plant");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
