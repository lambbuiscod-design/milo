// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  InvalidRequestBodyError,
  RequestBodyTooLargeError,
  readFormDataWithinLimit,
  readJsonWithinLimit,
  readTextWithinLimit,
  rejectCrossOriginMutation,
} from "@/lib/http-security";

function mutationRequest(headers: HeadersInit = {}) {
  return new Request("https://milo.example/api/events", {
    method: "POST",
    headers,
  });
}

describe("same-origin mutation protection", () => {
  it("accepts an exact same-origin browser request", () => {
    const request = mutationRequest({
      origin: "https://milo.example",
      "sec-fetch-site": "same-origin",
    });
    expect(rejectCrossOriginMutation(request)).toBeNull();

    const previousAppUrl = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = "https://milo.example";
    try {
      const proxied = new Request("http://internal:3000/api/events", {
        method: "POST",
        headers: { origin: "https://milo.example", "sec-fetch-site": "same-origin" },
      });
      expect(rejectCrossOriginMutation(proxied)).toBeNull();
    } finally {
      process.env.NEXT_PUBLIC_APP_URL = previousAppUrl;
    }
  });

  it("rejects cross-origin, same-site and originless requests", async () => {
    const crossOrigin = rejectCrossOriginMutation(
      mutationRequest({
        origin: "https://evil.example",
        "sec-fetch-site": "cross-site",
      }),
    );
    expect(crossOrigin?.status).toBe(403);
    await expect(crossOrigin?.json()).resolves.toMatchObject({ code: "INVALID_ORIGIN" });

    const siblingOrigin = rejectCrossOriginMutation(
      mutationRequest({
        origin: "https://attacker.milo.example",
        "sec-fetch-site": "same-site",
      }),
    );
    expect(siblingOrigin?.status).toBe(403);
    expect(rejectCrossOriginMutation(mutationRequest())?.status).toBe(403);

    const forgedOrigin = mutationRequest({
      host: "milo.example",
      origin: "https://evil.example",
      "sec-fetch-site": "same-origin",
    });
    expect(rejectCrossOriginMutation(forgedOrigin)?.status).toBe(403);
  });
});

describe("bounded request bodies", () => {
  it("parses valid JSON and rejects malformed JSON", async () => {
    const valid = new Request("https://milo.example/api/events", {
      method: "POST",
      body: JSON.stringify({ event: "reply_copied" }),
    });
    await expect(readJsonWithinLimit(valid)).resolves.toEqual({ event: "reply_copied" });

    const malformed = new Request("https://milo.example/api/events", {
      method: "POST",
      body: "{",
    });
    await expect(readJsonWithinLimit(malformed)).rejects.toBeInstanceOf(InvalidRequestBodyError);
  });

  it("enforces the real streamed size when Content-Length is absent", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("12345"));
        controller.enqueue(new TextEncoder().encode("67890"));
        controller.close();
      },
    });
    const request = new Request("https://milo.example/api/webhook", {
      method: "POST",
      body: stream,
      // Node requires duplex for a streaming request body, but it is not part
      // of the browser RequestInit type used by TypeScript.
      duplex: "half",
    } as RequestInit & { duplex: "half" });
    await expect(readTextWithinLimit(request, 8)).rejects.toBeInstanceOf(RequestBodyTooLargeError);
  });

  it("rejects an oversized declared body before reading it", async () => {
    const request = new Request("https://milo.example/api/events", {
      method: "POST",
      headers: { "content-length": "999" },
      body: "{}",
    });
    await expect(readJsonWithinLimit(request, 32)).rejects.toBeInstanceOf(RequestBodyTooLargeError);
  });

  it("parses bounded multipart form data", async () => {
    const boundary = "milo-security-test-boundary";
    const body = [
      `--${boundary}\r\nContent-Disposition: form-data; name="tone"\r\n\r\nwarm\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="chat.png"\r\nContent-Type: image/png\r\n\r\nimage\r\n`,
      `--${boundary}--\r\n`,
    ].join("");
    const request = new Request("https://milo.example/api/analyze", {
      method: "POST",
      headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
      body,
    });
    const parsed = await readFormDataWithinLimit(request, 4_096);
    expect(parsed.get("tone")).toBe("warm");
    const image = parsed.get("image");
    expect(image).toBeInstanceOf(Blob);
    expect((image as File).name).toBe("chat.png");
  });
});
