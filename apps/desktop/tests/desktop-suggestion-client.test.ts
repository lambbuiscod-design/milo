import { describe, expect, it, vi } from "vitest";
import { DesktopSuggestionClient } from "../src/main/desktop-suggestion-client";

const requestId = "00000000-0000-4000-8000-000000000111";
const success = {
  requestId,
  conversationStatus: "clear",
  detectedLanguage: "English",
  briefContext: "A friendly conversation.",
  warning: null,
  replies: [
    { category: "safe", text: "Safe", whyItWorks: "Warm and clear." },
    { category: "confident", text: "Confident", whyItWorks: "Direct and respectful." },
    { category: "playful", text: "Playful", whyItWorks: "Light and natural." },
  ],
  remaining: 4,
} as const;

function client(fetchRequest: typeof fetch) {
  return new DesktopSuggestionClient({
    apiBaseUrl: "https://milo.example",
    clientId: "milo-windows-public",
    clientVersion: "0.1.0",
    fetchRequest,
    requestId: () => requestId,
  });
}

describe("DesktopSuggestionClient", () => {
  it("sends only the bounded text contract to the fixed endpoint", async () => {
    const fetchRequest = vi.fn<typeof fetch>(async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(body).toEqual({
        requestId,
        clientVersion: "0.1.0",
        tone: "warm",
        relationshipStage: "dating",
        messages: [{ role: "unknown", text: "Hello" }],
      });
      expect(init?.redirect).toBe("error");
      expect(init?.credentials).toBe("omit");
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer access-token");
      return Response.json(success);
    });

    await expect(client(fetchRequest).suggest({
      accessToken: "access-token",
      messages: [{ role: "unknown", text: "Hello" }],
      tone: "warm",
      relationshipStage: "dating",
    })).resolves.toEqual(success);
    expect(fetchRequest).toHaveBeenCalledWith(new URL("https://milo.example/api/v1/suggest"), expect.any(Object));
  });

  it("rejects untrusted URLs and oversized local context before network access", async () => {
    expect(() => new DesktopSuggestionClient({
      apiBaseUrl: "http://evil.example",
      clientId: "milo-windows-public",
      clientVersion: "0.1.0",
    })).toThrow(/not trusted/i);

    const fetchRequest = vi.fn<typeof fetch>();
    await expect(client(fetchRequest).suggest({
      accessToken: "access-token",
      messages: Array.from({ length: 5 }, () => ({ role: "unknown" as const, text: "x".repeat(1_000) })),
      tone: "warm",
      relationshipStage: "dating",
    })).rejects.toMatchObject({ code: "protocol" });
    expect(fetchRequest).not.toHaveBeenCalled();
  });

  it("rejects mismatched, unsafe-shaped, or oversized server responses", async () => {
    const mismatched = vi.fn<typeof fetch>(async () => Response.json({ ...success, requestId: "00000000-0000-4000-8000-000000000222" }));
    await expect(client(mismatched).suggest({
      accessToken: "access-token", messages: [{ role: "unknown", text: "Hello" }], tone: "warm", relationshipStage: "dating",
    })).rejects.toMatchObject({ code: "protocol" });

    const unsafeWithText = vi.fn<typeof fetch>(async () => Response.json({ ...success, conversationStatus: "unsafe" }));
    await expect(client(unsafeWithText).suggest({
      accessToken: "access-token", messages: [{ role: "unknown", text: "Hello" }], tone: "warm", relationshipStage: "dating",
    })).rejects.toMatchObject({ code: "protocol" });

    const oversized = vi.fn<typeof fetch>(async () => new Response("x".repeat(33 * 1024), {
      headers: { "Content-Type": "application/json" },
    }));
    await expect(client(oversized).suggest({
      accessToken: "access-token", messages: [{ role: "unknown", text: "Hello" }], tone: "warm", relationshipStage: "dating",
    })).rejects.toMatchObject({ code: "protocol" });
  });

  it("maps authentication, allowance, and rate-limit failures without exposing server text", async () => {
    for (const [status, code, expected] of [
      [401, "UNAUTHORIZED", "unauthorized"],
      [402, "PAYWALL", "paywall"],
      [429, "RATE_LIMIT", "rate_limit"],
    ] as const) {
      const fetchRequest = vi.fn<typeof fetch>(async () => Response.json({ code, error: "sensitive upstream detail" }, { status }));
      await expect(client(fetchRequest).suggest({
        accessToken: "access-token", messages: [{ role: "unknown", text: "Hello" }], tone: "warm", relationshipStage: "dating",
      })).rejects.toMatchObject({ code: expected });
    }
  });
});
