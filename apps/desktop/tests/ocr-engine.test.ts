import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DesktopOcrEngine, type OcrExtractionResult } from "../src/main/ocr-engine";
import {
  SYNTHETIC_CHAT_EXPECTED_SUBSTRINGS,
  SYNTHETIC_CHAT_IMAGE_BASE64,
  getSyntheticChatImageBuffer,
} from "@milo/test-fixtures";

describe("DesktopOcrEngine (Tesseract.js Local Offline OCR)", () => {
  let ocrEngine: DesktopOcrEngine;

  beforeAll(async () => {
    ocrEngine = new DesktopOcrEngine();
    await ocrEngine.initialize();
  }, 35_000);

  afterAll(async () => {
    if (ocrEngine) {
      await ocrEngine.terminate();
    }
  });

  describe("Programmatic OCR Verification on Standard Synthetic Chat Fixture", () => {
    it("successfully parses standard test image buffer and extracts all expected substrings", async () => {
      expect(SYNTHETIC_CHAT_IMAGE_BASE64).toBeDefined();
      expect(SYNTHETIC_CHAT_IMAGE_BASE64.length).toBeGreaterThan(0);

      const imageBuffer = getSyntheticChatImageBuffer();
      expect(imageBuffer).toBeInstanceOf(Buffer);
      expect(imageBuffer.length).toBeGreaterThan(100);

      const result: OcrExtractionResult = await ocrEngine.extractFromBuffer(imageBuffer);

      // Verify structure and metrics
      expect(result).toBeDefined();
      expect(typeof result.rawText).toBe("string");
      expect(typeof result.normalizedText).toBe("string");
      expect(result.durationMs).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(50);

      // Verify that all expected substrings are extracted
      for (const expectedSubstring of SYNTHETIC_CHAT_EXPECTED_SUBSTRINGS) {
        const foundInRaw = result.rawText.toLowerCase().includes(expectedSubstring.toLowerCase());
        const foundInNormalized = result.normalizedText.toLowerCase().includes(expectedSubstring.toLowerCase());
        expect(
          foundInRaw || foundInNormalized,
          `Expected OCR output to contain substring "${expectedSubstring}". Raw text: "${result.rawText}", Normalized: "${result.normalizedText}"`,
        ).toBe(true);
      }
    }, 30_000);

    it("verifies proper line formatting, character cleanup, and line separation", async () => {
      const imageBuffer = getSyntheticChatImageBuffer();
      const result = await ocrEngine.extractFromBuffer(imageBuffer);

      // Raw and normalized text should be non-empty
      expect(result.rawText.length).toBeGreaterThan(20);
      expect(result.normalizedText.length).toBeGreaterThan(20);

      // No unprintable control characters
      expect(result.rawText).not.toMatch(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/);
      expect(result.normalizedText).not.toMatch(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/);

      // Normalized lines should be bounded and structured
      const lines = result.normalizedText.split("\n").map((l) => l.trim()).filter(Boolean);
      expect(lines.length).toBeGreaterThanOrEqual(2);
    }, 20_000);
  });

  describe("Error Handling and Buffer Guards (Adversarial Stress Testing)", () => {
    it("rejects 0-byte buffer with OCR_EMPTY_BUFFER error", async () => {
      await expect(ocrEngine.extractFromBuffer(Buffer.alloc(0))).rejects.toThrowError(
        /OCR_EMPTY_BUFFER: Image buffer cannot be empty/,
      );
      await expect(ocrEngine.extractFromBuffer(Buffer.from([]))).rejects.toThrowError(
        /OCR_EMPTY_BUFFER: Image buffer cannot be empty/,
      );
    });

    it("rejects random binary byte arrays with OCR_DECODING_ERROR", async () => {
      const randomBytes1 = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]);
      await expect(ocrEngine.extractFromBuffer(randomBytes1)).rejects.toThrowError(
        /OCR_DECODING_ERROR/,
      );

      const randomBytes2 = Buffer.from([0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff, 0x11, 0x22, 0x33]);
      await expect(ocrEngine.extractFromBuffer(randomBytes2)).rejects.toThrowError(
        /OCR_DECODING_ERROR/,
      );
    });

    it("rejects truncated binary byte arrays across image formats with OCR_DECODING_ERROR", async () => {
      // Truncated PNG header (4 bytes)
      const truncatedPngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
      await expect(ocrEngine.extractFromBuffer(truncatedPngHeader)).rejects.toThrowError(
        /OCR_DECODING_ERROR/,
      );

      // Truncated PNG chunk (16 bytes, valid magic but under 24 bytes)
      const truncatedPngChunk = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      ]);
      await expect(ocrEngine.extractFromBuffer(truncatedPngChunk)).rejects.toThrowError(
        /OCR_DECODING_ERROR: Corrupted or truncated PNG image buffer/,
      );

      // Truncated JPEG magic (3 bytes)
      const truncatedJpeg = Buffer.from([0xff, 0xd8, 0xff]);
      await expect(ocrEngine.extractFromBuffer(truncatedJpeg)).rejects.toThrowError(
        /OCR_DECODING_ERROR/,
      );

      // Truncated BMP magic (2 bytes)
      const truncatedBmp = Buffer.from([0x42, 0x4d]);
      await expect(ocrEngine.extractFromBuffer(truncatedBmp)).rejects.toThrowError(
        /OCR_DECODING_ERROR/,
      );
    });

    it("rejects non-image text files passed as Buffer with OCR_DECODING_ERROR", async () => {
      // Plain text transcript
      const plainTextBuffer = Buffer.from(
        "Alex: I had a really nice time tonight.\nMe: I did too. It was fun!\nAlex: We should definitely do it again.",
      );
      await expect(ocrEngine.extractFromBuffer(plainTextBuffer)).rejects.toThrowError(
        /OCR_DECODING_ERROR/,
      );

      // Text file starting with 'BM' (BMP magic trap)
      const bmpPrefixTextBuffer = Buffer.from(
        "BM is an abbreviation for Business Model. This text file should never be parsed as an image.",
      );
      await expect(ocrEngine.extractFromBuffer(bmpPrefixTextBuffer)).rejects.toThrowError(
        /OCR_DECODING_ERROR/,
      );

      // JSON payload buffer
      const jsonBuffer = Buffer.from(
        JSON.stringify({ type: "chat_message", text: "Hello Milo screen capture", timestamp: Date.now() }),
      );
      await expect(ocrEngine.extractFromBuffer(jsonBuffer)).rejects.toThrowError(
        /OCR_DECODING_ERROR/,
      );

      // HTML / XML document buffer
      const htmlBuffer = Buffer.from(
        "<!DOCTYPE html><html><head><title>Chat</title></head><body><p>Hello world</p></body></html>",
      );
      await expect(ocrEngine.extractFromBuffer(htmlBuffer)).rejects.toThrowError(
        /OCR_DECODING_ERROR/,
      );
    });

    it("handles concurrent calls to extractFromBuffer() during worker initialization safely", async () => {
      // Create fresh, uninitialized engine
      const freshEngine = new DesktopOcrEngine();
      const fixtureBuffer = getSyntheticChatImageBuffer();

      // Launch 3 concurrent extraction calls before initialize() is called
      const [res1, res2, res3] = await Promise.all([
        freshEngine.extractFromBuffer(fixtureBuffer),
        freshEngine.extractFromBuffer(fixtureBuffer),
        freshEngine.extractFromBuffer(fixtureBuffer),
      ]);

      // Assert all 3 calls resolved with valid OCR results
      for (const res of [res1, res2, res3]) {
        expect(res).toBeDefined();
        expect(res.confidence).toBeGreaterThan(50);
        expect(res.durationMs).toBeGreaterThan(0);
        for (const expectedSubstring of SYNTHETIC_CHAT_EXPECTED_SUBSTRINGS) {
          const match =
            res.rawText.toLowerCase().includes(expectedSubstring.toLowerCase()) ||
            res.normalizedText.toLowerCase().includes(expectedSubstring.toLowerCase());
          expect(match).toBe(true);
        }
      }

      await freshEngine.terminate();
    }, 45_000);

    it("rejects invalid buffers immediately without stalling concurrent valid extractions during init", async () => {
      const freshEngine = new DesktopOcrEngine();
      const validBuffer = getSyntheticChatImageBuffer();
      const emptyBuffer = Buffer.alloc(0);
      const corruptBuffer = Buffer.from("NOT_AN_IMAGE_BUFFER");

      const [validResult, emptyError, corruptError] = await Promise.all([
        freshEngine.extractFromBuffer(validBuffer),
        freshEngine.extractFromBuffer(emptyBuffer).catch((e) => e),
        freshEngine.extractFromBuffer(corruptBuffer).catch((e) => e),
      ]);

      expect(validResult.confidence).toBeGreaterThan(50);
      expect(emptyError).toBeInstanceOf(Error);
      expect((emptyError as Error).message).toMatch(/OCR_EMPTY_BUFFER/);
      expect(corruptError).toBeInstanceOf(Error);
      expect((corruptError as Error).message).toMatch(/OCR_DECODING_ERROR/);

      await freshEngine.terminate();
    }, 45_000);
  });

  describe("Lifecycle and Worker Reuse", () => {
    it("reuses the initialized worker instance for subsequent recognitions", async () => {
      const imageBuffer = getSyntheticChatImageBuffer();
      const firstRun = await ocrEngine.extractFromBuffer(imageBuffer);
      const secondRun = await ocrEngine.extractFromBuffer(imageBuffer);

      expect(firstRun.confidence).toBeGreaterThan(50);
      expect(secondRun.confidence).toBeGreaterThan(50);
      expect(secondRun.durationMs).toBeGreaterThan(0);
    }, 20_000);

    it("terminates cleanly and can re-initialize for subsequent calls", async () => {
      const tempEngine = new DesktopOcrEngine();
      await tempEngine.initialize();
      await tempEngine.terminate();

      // Ensure terminating an already-terminated engine is safe
      await expect(tempEngine.terminate()).resolves.toBeUndefined();

      // Engine can re-initialize and process after termination
      const imageBuffer = getSyntheticChatImageBuffer();
      const result = await tempEngine.extractFromBuffer(imageBuffer);
      expect(result.confidence).toBeGreaterThan(50);
      await tempEngine.terminate();
    }, 30_000);
  });
});
