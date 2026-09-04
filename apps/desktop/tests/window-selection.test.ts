import { describe, expect, it } from "vitest";
import {
  bindNativeWindowIdentity,
  detectChatAppType,
  normalizeWindowTitle,
  selectFreshWindow,
  sortWindowCandidates,
  toWindowCandidates,
  windowHandleFromSourceId,
} from "../src/main/window-selection";

describe("selected-window boundary", () => {
  it("returns bounded, deduplicated titles and excludes Milo", () => {
    const candidates = toWindowCandidates(
      [
        { id: "window:101:0", name: "  WhatsApp   —   Chrome\n" },
        { id: "window:101:0", name: "duplicate" },
        { id: "window:999:0", name: "Milo" },
        { id: "screen:1:0", name: "not a window" },
        { id: "window:102:0", name: "\u0000" },
      ],
      "window:999:0",
    );
    expect(candidates).toEqual([{ sourceId: "window:101:0", title: "WhatsApp — Chrome" }]);
  });

  it("accepts only a currently enumerated source id", () => {
    const candidates = [{ sourceId: "window:101:0", title: "Chat" }];
    expect(selectFreshWindow("window:101:0", candidates)).toEqual({
      sourceId: "window:101:0",
      publicSummary: { available: true, title: "Chat", processId: null },
      nativeIdentity: null,
    });
    expect(selectFreshWindow("window:404:0", candidates)).toBeNull();
  });

  it("binds a fresh Electron source to the helper's anti-reuse identity", () => {
    const selected = selectFreshWindow("window:101:0", [{ sourceId: "window:101:0", title: "Chat" }]);
    expect(selected).not.toBeNull();
    expect(bindNativeWindowIdentity(selected!, [{ hwnd: 101, pid: 202, processCreationTime: "303" }])).toEqual({
      sourceId: "window:101:0",
      publicSummary: { available: true, title: "Chat", processId: 202 },
      nativeIdentity: { hwnd: 101, pid: 202, processCreationTime: "303" },
    });
    expect(bindNativeWindowIdentity(selected!, [{ hwnd: 102, pid: 202, processCreationTime: "303" }])).toBeNull();
    expect(windowHandleFromSourceId("window:9007199254740993:0")).toBeNull();
  });
});

describe("detectChatAppType", () => {
  it("detects WhatsApp desktop, web, and unread badge variations", () => {
    expect(detectChatAppType("WhatsApp")).toBe("whatsapp");
    expect(detectChatAppType("(2) WhatsApp")).toBe("whatsapp");
    expect(detectChatAppType("WhatsApp - Google Chrome")).toBe("whatsapp");
    expect(detectChatAppType("WhatsApp Web")).toBe("whatsapp");
    expect(detectChatAppType("Chat - WhatsApp - Microsoft Edge")).toBe("whatsapp");
    expect(detectChatAppType("(99+) WhatsApp")).toBe("whatsapp");
  });

  it("detects Discord desktop, channels, and unread badges", () => {
    expect(detectChatAppType("Discord")).toBe("discord");
    expect(detectChatAppType("(1) Discord")).toBe("discord");
    expect(detectChatAppType("Discord | #general | Milo Server")).toBe("discord");
    expect(detectChatAppType("Discord - Google Chrome")).toBe("discord");
    expect(detectChatAppType("Discord | #announcements")).toBe("discord");
  });

  it("detects Telegram desktop and web", () => {
    expect(detectChatAppType("Telegram")).toBe("telegram");
    expect(detectChatAppType("(5) Telegram")).toBe("telegram");
    expect(detectChatAppType("Telegram Web")).toBe("telegram");
    expect(detectChatAppType("Telegram - Desktop")).toBe("telegram");
  });

  it("detects Slack channels and workspaces", () => {
    expect(detectChatAppType("Slack")).toBe("slack");
    expect(detectChatAppType("Slack - Milo Engineering")).toBe("slack");
    expect(detectChatAppType("(3) Slack | general")).toBe("slack");
  });

  it("returns other for non-chat applications and arbitrary titles", () => {
    expect(detectChatAppType("Visual Studio Code")).toBe("other");
    expect(detectChatAppType("Google Chrome")).toBe("other");
    expect(detectChatAppType("Windows PowerShell")).toBe("other");
    expect(detectChatAppType("Calculator")).toBe("other");
    expect(detectChatAppType("Spotify Premium")).toBe("other");
    expect(detectChatAppType("")).toBe("other");
  });
});

describe("sortWindowCandidates", () => {
  it("prioritizes chat applications ahead of non-chat applications", () => {
    const candidates = [
      { sourceId: "window:1:0", title: "Visual Studio Code" },
      { sourceId: "window:2:0", title: "WhatsApp" },
      { sourceId: "window:3:0", title: "Calculator" },
      { sourceId: "window:4:0", title: "(1) Discord" },
      { sourceId: "window:5:0", title: "File Explorer" },
    ];

    const sorted = sortWindowCandidates(candidates);
    expect(sorted.map((c) => c.title)).toEqual([
      "WhatsApp",
      "(1) Discord",
      "Visual Studio Code",
      "Calculator",
      "File Explorer",
    ]);
  });

  it("preserves stable relative ordering within chat and non-chat groups", () => {
    const candidates = [
      { sourceId: "window:1:0", title: "App Alpha" },
      { sourceId: "window:2:0", title: "Slack - General" },
      { sourceId: "window:3:0", title: "App Beta" },
      { sourceId: "window:4:0", title: "Telegram" },
    ];

    const sorted = sortWindowCandidates(candidates);
    expect(sorted.map((c) => c.title)).toEqual([
      "Slack - General",
      "Telegram",
      "App Alpha",
      "App Beta",
    ]);
  });

  it("handles empty or already-sorted candidate lists", () => {
    expect(sortWindowCandidates([])).toEqual([]);
    const single = [{ sourceId: "window:1:0", title: "WhatsApp" }];
    expect(sortWindowCandidates(single)).toEqual(single);
  });
});

describe("toWindowCandidates chat prioritization and truncation prevention", () => {
  it("ensures chat applications beyond the 20-candidate limit are prioritized and never truncated", () => {
    // Generate 25 non-chat windows followed by 2 chat windows
    const sources = [
      ...Array.from({ length: 25 }, (_, i) => ({
        id: `window:${i + 10}:0`,
        name: `Browser Tab ${i + 1}`,
      })),
      { id: "window:100:0", name: "WhatsApp" },
      { id: "window:101:0", name: "(2) Discord" },
    ];

    const candidates = toWindowCandidates(sources, "window:999:0");

    // Must be capped at MAX_WINDOW_CANDIDATES (20)
    expect(candidates).toHaveLength(20);

    // The first two MUST be the chat applications
    expect(candidates[0]).toEqual({ sourceId: "window:100:0", title: "WhatsApp" });
    expect(candidates[1]).toEqual({ sourceId: "window:101:0", title: "(2) Discord" });

    // The remaining 18 are the first 18 non-chat windows
    expect(candidates[2].title).toBe("Browser Tab 1");
    expect(candidates[19].title).toBe("Browser Tab 18");
  });

  it("normalizes window titles properly", () => {
    expect(normalizeWindowTitle("  Messy \t Window \n Title  ")).toBe("Messy Window Title");
    expect(normalizeWindowTitle("A".repeat(200))).toHaveLength(120);
  });
});
