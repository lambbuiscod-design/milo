import { describe, expect, it, vi } from "vitest";
import { extractLocalContext, hasUsefulLocalText } from "../src/main/local-context-extractor";
import type { NativeWindowIdentity } from "../src/main/native-helper-client";

const identity: NativeWindowIdentity = { hwnd: 10, pid: 20, processCreationTime: "134000000000000000" };

describe("selected-window local extraction priority", () => {
  it("uses UI Automation without capturing when text is sufficient", async () => {
    const helper = {
      extractText: vi.fn(async () => ({ text: "Other: Are you free tonight?\nSelf: Yes, after eight.", truncated: false })),
      captureText: vi.fn(),
    };
    await expect(extractLocalContext(helper as never, identity)).resolves.toMatchObject({ method: "uia", language: null });
    expect(helper.captureText).not.toHaveBeenCalled();
  });

  it("falls back to selected-window OCR and supports Italian", async () => {
    const helper = {
      extractText: vi.fn(async () => ({ text: "Chat", truncated: false })),
      captureText: vi.fn(async (_identity, language: "en" | "it") => language === "en"
        ? { text: "", truncated: false }
        : { text: "Altro: Ci vediamo stasera?\nIo: Volentieri, alle otto.", truncated: false }),
    };
    await expect(extractLocalContext(helper as never, identity)).resolves.toMatchObject({ method: "local_ocr", language: "it" });
    expect(helper.captureText).toHaveBeenCalledTimes(2);
  });

  it("tries the locally selected OCR language first", async () => {
    const helper = {
      extractText: vi.fn(async () => ({ text: "Chat", truncated: false })),
      captureText: vi.fn(async (_identity, language: "en" | "it") => language === "it"
        ? { text: "Altro: Ci vediamo stasera?\nIo: Volentieri, alle otto.", truncated: false }
        : { text: "", truncated: false }),
    };
    await expect(extractLocalContext(helper as never, identity, 6_000, "it")).resolves.toMatchObject({
      method: "local_ocr",
      language: "it",
    });
    expect(helper.captureText).toHaveBeenCalledTimes(1);
    expect(helper.captureText.mock.calls[0]?.[1]).toBe("it");
  });

  it("returns best-effort UIA text if local capture is unavailable", async () => {
    const helper = {
      extractText: vi.fn(async () => ({ text: "Last visible message", truncated: true })),
      captureText: vi.fn(async () => { throw new Error("capture unavailable"); }),
    };
    await expect(extractLocalContext(helper as never, identity)).resolves.toEqual({
      text: "Last visible message",
      truncated: true,
      method: "uia",
      language: null,
    });
  });

  it("requires multiple bounded text lines before skipping OCR", () => {
    expect(hasUsefulLocalText("one short line")).toBe(false);
    expect(hasUsefulLocalText("hello there\nhow are you today?")).toBe(true);
  });
});
