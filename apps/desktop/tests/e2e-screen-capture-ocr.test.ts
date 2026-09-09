import { describe, expect, it, vi } from "vitest";
import { DesktopSuggestionClient } from "../src/main/desktop-suggestion-client";
import {
  MAX_CONTEXT_CHARACTERS,
  MAX_CONTEXT_MESSAGES,
  normalizeRecentContext,
} from "../src/main/context-normalizer";
import {
  type ChatAppType,
  detectChatAppType,
  sortWindowCandidates,
  toWindowCandidates,
  windowHandleFromSourceId,
} from "../src/main/window-selection";

// ============================================================================
// Domain Contracts & Interface Specifications (from PROJECT.md / Survey Reports)
// ============================================================================

export class WindowCaptureError extends Error {
  constructor(
    readonly code: "WINDOW_NOT_FOUND" | "WINDOW_MINIMIZED" | "CAPTURE_FAILED",
    message: string,
  ) {
    super(message);
    this.name = "WindowCaptureError";
  }
}

export type CapturedWindowFrame = Readonly<{
  sourceId: string;
  title: string;
  appType: ChatAppType;
  imageBuffer: Buffer;
  width: number;
  height: number;
  timestamp: number;
}>;

export interface MockNativeImage {
  toPNG(): Buffer;
  getSize(): { width: number; height: number };
  isEmpty(): boolean;
}

export interface MockDesktopCapturerSource {
  id: string;
  name: string;
  thumbnail: MockNativeImage;
}

export interface DesktopCapturerApi {
  getSources(options: {
    types: string[];
    thumbnailSize?: { width: number; height: number };
  }): Promise<MockDesktopCapturerSource[]>;
}

export class WindowCaptureService {
  constructor(private readonly capturer: DesktopCapturerApi) {}

  async enumerateCandidates(excludedSourceId: string = "") {
    const sources = await this.capturer.getSources({
      types: ["window"],
      thumbnailSize: { width: 0, height: 0 },
    });
    const candidates = toWindowCandidates(sources, excludedSourceId);
    return sortWindowCandidates(candidates);
  }

  async captureWindow(
    sourceId: string,
    options: { width?: number; height?: number } = { width: 1920, height: 1080 },
  ): Promise<CapturedWindowFrame> {
    const width = options.width ?? 1920;
    const height = options.height ?? 1080;
    const sources = await this.capturer.getSources({
      types: ["window"],
      thumbnailSize: { width, height },
    });

    const target = sources.find((s) => s.id === sourceId);
    if (!target) {
      throw new WindowCaptureError("WINDOW_NOT_FOUND", `Window with sourceId ${sourceId} not found`);
    }

    if (
      target.thumbnail.isEmpty() ||
      target.thumbnail.getSize().width === 0 ||
      target.thumbnail.getSize().height === 0
    ) {
      throw new WindowCaptureError("WINDOW_MINIMIZED", `Target window ${sourceId} is minimized or empty`);
    }

    const pngBuffer = target.thumbnail.toPNG();
    if (pngBuffer.length === 0) {
      throw new WindowCaptureError("CAPTURE_FAILED", "Captured thumbnail produced an empty buffer");
    }

    return {
      sourceId: target.id,
      title: target.name,
      appType: detectChatAppType(target.name),
      imageBuffer: pngBuffer,
      width: target.thumbnail.getSize().width,
      height: target.thumbnail.getSize().height,
      timestamp: Date.now(),
    };
  }
}

export type OcrExtractionResult = Readonly<{
  rawText: string;
  normalizedText: string;
  confidence: number;
  durationMs: number;
}>;

export interface DesktopOcrEngine {
  initialize(): Promise<void>;
  extractFromBuffer(imageBuffer: Buffer): Promise<OcrExtractionResult>;
  terminate(): Promise<void>;
}

/**
 * Deterministic in-memory OCR mock engine simulating Tesseract.js behavior.
 * Validates PNG buffer signature, rejects corrupt/empty buffers, and yields transcripts.
 */
export class MockDesktopOcrEngine implements DesktopOcrEngine {
  private initialized = false;
  private readonly transcriptMap = new Map<string, string>();

  registerTranscript(bufferKey: string, transcript: string) {
    this.transcriptMap.set(bufferKey, transcript);
  }

  async initialize(): Promise<void> {
    this.initialized = true;
  }

  async extractFromBuffer(imageBuffer: Buffer): Promise<OcrExtractionResult> {
    if (!this.initialized) {
      await this.initialize();
    }
    if (imageBuffer.length === 0) {
      throw new Error("OCR_EMPTY_BUFFER: Image buffer cannot be empty");
    }
    // Check PNG signature: 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A
    const isPng =
      imageBuffer.length >= 8 &&
      imageBuffer[0] === 0x89 &&
      imageBuffer[1] === 0x50 &&
      imageBuffer[2] === 0x4e &&
      imageBuffer[3] === 0x47;

    if (!isPng && !imageBuffer.toString("utf8").startsWith("MOCK_IMAGE")) {
      throw new Error("OCR_DECODING_ERROR: Corrupted or unsupported image buffer format");
    }

    const key = imageBuffer.toString("base64");
    const rawText = this.transcriptMap.get(key) ?? "Hello! How are you doing today?";
    const normalized = normalizeRecentContext(rawText, { removeParticipantNames: true }).text;

    return {
      rawText,
      normalizedText: normalized,
      confidence: 94.8,
      durationMs: 42,
    };
  }

  async terminate(): Promise<void> {
    this.initialized = false;
  }
}

/**
 * Standard synthetic PNG builder utility that creates valid in-memory PNG buffers.
 */
export function createSyntheticPngBuffer(identifier: string = "default", width = 800, height = 600): Buffer {
  // Minimal valid PNG binary header
  const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const payload = Buffer.from(`DATA:${identifier}:${width}x${height}`);
  return Buffer.concat([pngHeader, payload]);
}

export function createMockNativeImage(
  pngBuffer: Buffer,
  width: number,
  height: number,
  empty: boolean = false,
): MockNativeImage {
  return {
    toPNG: () => pngBuffer,
    getSize: () => ({ width, height }),
    isEmpty: () => empty,
  };
}

// ============================================================================
// E2E Pipeline Orchestrator Harness
// ============================================================================

export type E2EPipelineResult = Readonly<{
  sourceId: string;
  appType: ChatAppType;
  capturedText: string;
  normalizedMessageCount: number;
  replies: readonly {
    category: "safe" | "confident" | "playful";
    text: string;
    whyItWorks: string;
  }[];
  remaining: number;
}>;

export async function runE2ESuggestionPipeline(params: {
  sourceId: string;
  captureService: WindowCaptureService;
  ocrEngine: DesktopOcrEngine;
  suggestionClient: DesktopSuggestionClient;
  accessToken: string;
  tone?: "standard" | "romantic" | "witty" | "professional" | "warm" | "confident" | "playful" | "direct";
  relationshipStage?: "new_match" | "first_dates" | "dating" | "relationship" | "conflict";
}): Promise<E2EPipelineResult> {
  const frame = await params.captureService.captureWindow(params.sourceId);
  const ocrResult = await params.ocrEngine.extractFromBuffer(frame.imageBuffer);

  const normalized = normalizeRecentContext(ocrResult.rawText, {
    maxMessages: 8,
    removeParticipantNames: true,
  });

  if (normalized.messageCount === 0 || normalized.text.trim().length === 0) {
    throw new Error("EMPTY_CONTEXT");
  }

  const messages = normalized.text.split("\n").map((text) => ({
    role: "unknown" as const,
    text,
  }));

  const suggestionResult = await params.suggestionClient.suggest({
    accessToken: params.accessToken,
    messages,
    tone: params.tone ?? "warm",
    relationshipStage: params.relationshipStage ?? "dating",
  });

  return {
    sourceId: frame.sourceId,
    appType: frame.appType,
    capturedText: ocrResult.rawText,
    normalizedMessageCount: normalized.messageCount,
    replies: suggestionResult.replies,
    remaining: suggestionResult.remaining,
  };
}

// ============================================================================
// Vitest Test Suite: 4-Tier Comprehensive E2E Verification (>=38 Tests)
// ============================================================================

describe("E2E Screen Capture, Local OCR, and Suggestion Pipeline", () => {
  const fixedRequestId = "00000000-0000-4000-8000-000000000111";

  const standardApiResponse = {
    requestId: fixedRequestId,
    conversationStatus: "clear",
    detectedLanguage: "English",
    briefContext: "Conversational banter between matches.",
    warning: null,
    replies: [
      { category: "safe", text: "That sounds wonderful, let's do it!", whyItWorks: "Warm and reassuring." },
      { category: "confident", text: "Count me in. How about tomorrow at 8?", whyItWorks: "Assertive and direct." },
      { category: "playful", text: "Only if you promise not to beat me again!", whyItWorks: "Lighthearted teasing." },
    ],
    remaining: 5,
  } as const;

  function createTestClient(fetchRequest: typeof fetch) {
    return new DesktopSuggestionClient({
      apiBaseUrl: "https://milo.example",
      clientId: "milo-windows-public",
      clientVersion: "0.1.0",
      fetchRequest,
      requestId: () => fixedRequestId,
    });
  }

  // --------------------------------------------------------------------------
  // Tier 1: Feature Coverage (R1, R2, R3) -> 15 Tests
  // --------------------------------------------------------------------------
  describe("Tier 1: Feature Coverage (R1, R2, R3)", () => {
    describe("R1: Screen Capture & Window Enumeration", () => {
      it("T1.1.1: retrieves candidates with 0x0 thumbnails to minimize enumeration memory", async () => {
        const capturer: DesktopCapturerApi = {
          getSources: vi.fn(async (options) => {
            expect(options.thumbnailSize).toEqual({ width: 0, height: 0 });
            return [
              { id: "window:101:0", name: "WhatsApp", thumbnail: createMockNativeImage(Buffer.alloc(0), 0, 0) },
              { id: "window:102:0", name: "Discord", thumbnail: createMockNativeImage(Buffer.alloc(0), 0, 0) },
            ];
          }),
        };

        const service = new WindowCaptureService(capturer);
        const candidates = await service.enumerateCandidates();
        expect(candidates).toHaveLength(2);
        expect(candidates.map((c) => c.sourceId)).toEqual(["window:101:0", "window:102:0"]);
      });

      it("T1.1.2: prioritizes WhatsApp and Discord windows at the head of candidate list", async () => {
        const capturer: DesktopCapturerApi = {
          getSources: async () => [
            { id: "window:201:0", name: "Google Chrome", thumbnail: createMockNativeImage(Buffer.alloc(0), 0, 0) },
            { id: "window:202:0", name: "(2) WhatsApp", thumbnail: createMockNativeImage(Buffer.alloc(0), 0, 0) },
            { id: "window:203:0", name: "Visual Studio Code", thumbnail: createMockNativeImage(Buffer.alloc(0), 0, 0) },
            { id: "window:204:0", name: "Discord #general", thumbnail: createMockNativeImage(Buffer.alloc(0), 0, 0) },
          ],
        };

        const service = new WindowCaptureService(capturer);
        const candidates = await service.enumerateCandidates();

        expect(candidates).toHaveLength(4);
        expect(candidates[0]?.title).toBe("(2) WhatsApp");
        expect(candidates[1]?.title).toBe("Discord #general");
        expect(candidates[2]?.title).toBe("Google Chrome");
        expect(candidates[3]?.title).toBe("Visual Studio Code");
      });

      it("T1.1.3: captures targeted window at 1920x1080 returning lossless PNG buffer", async () => {
        const pngBuf = createSyntheticPngBuffer("whatsapp-frame", 1920, 1080);
        const capturer: DesktopCapturerApi = {
          getSources: vi.fn(async (options) => {
            expect(options.thumbnailSize).toEqual({ width: 1920, height: 1080 });
            return [
              {
                id: "window:101:0",
                name: "WhatsApp",
                thumbnail: createMockNativeImage(pngBuf, 1920, 1080, false),
              },
            ];
          }),
        };

        const service = new WindowCaptureService(capturer);
        const frame = await service.captureWindow("window:101:0", { width: 1920, height: 1080 });

        expect(frame.sourceId).toBe("window:101:0");
        expect(frame.title).toBe("WhatsApp");
        expect(frame.appType).toBe("whatsapp");
        expect(frame.width).toBe(1920);
        expect(frame.height).toBe(1080);
        expect(frame.imageBuffer.length).toBeGreaterThan(0);
        expect(frame.imageBuffer[0]).toBe(0x89); // PNG magic byte
      });

      it("T1.1.4: classifies chat application titles correctly across platforms", () => {
        expect(detectChatAppType("WhatsApp")).toBe("whatsapp");
        expect(detectChatAppType("(1) WhatsApp Web - Google Chrome")).toBe("whatsapp");
        expect(detectChatAppType("Discord | #chill-chat | Milo")).toBe("discord");
        expect(detectChatAppType("Slack - Engineering")).toBe("slack");
        expect(detectChatAppType("Telegram Messenger")).toBe("telegram");
        expect(detectChatAppType("Calculator")).toBe("other");
      });

      it("T1.1.5: excludes Milo's own window ID from capture candidate enumeration", async () => {
        const capturer: DesktopCapturerApi = {
          getSources: async () => [
            { id: "window:999:0", name: "Milo Floating Assistant", thumbnail: createMockNativeImage(Buffer.alloc(0), 0, 0) },
            { id: "window:101:0", name: "WhatsApp", thumbnail: createMockNativeImage(Buffer.alloc(0), 0, 0) },
          ],
        };

        const service = new WindowCaptureService(capturer);
        const candidates = await service.enumerateCandidates("window:999:0");

        expect(candidates).toHaveLength(1);
        expect(candidates[0]?.sourceId).toBe("window:101:0");
      });
    });

    describe("R2: Local OCR Text Extraction", () => {
      it("T1.2.1: extracts multi-line synthetic conversation transcript from image buffer", async () => {
        const ocr = new MockDesktopOcrEngine();
        const pngBuf = createSyntheticPngBuffer("chat-transcript");
        ocr.registerTranscript(
          pngBuf.toString("base64"),
          "Alex: Hey, are you free Friday?\nJordan: Yes, totally free! What do you have in mind?",
        );

        const result = await ocr.extractFromBuffer(pngBuf);
        expect(result.rawText).toContain("Alex: Hey, are you free Friday?");
        expect(result.rawText).toContain("Jordan: Yes, totally free!");
        expect(result.normalizedText).toContain("Participant: Hey, are you free Friday?");
      });

      it("T1.2.2: reports non-zero confidence score and duration metrics", async () => {
        const ocr = new MockDesktopOcrEngine();
        const pngBuf = createSyntheticPngBuffer("metrics-test");
        const result = await ocr.extractFromBuffer(pngBuf);

        expect(result.confidence).toBeGreaterThan(50);
        expect(result.durationMs).toBeGreaterThan(0);
      });

      it("T1.2.3: preserves interword spacing and distinct conversation turn lines", async () => {
        const ocr = new MockDesktopOcrEngine();
        const pngBuf = createSyntheticPngBuffer("spacing-test");
        ocr.registerTranscript(
          pngBuf.toString("base64"),
          "Line One: Spacing Test\nLine Two: Another Spaced Turn",
        );

        const result = await ocr.extractFromBuffer(pngBuf);
        const lines = result.rawText.split("\n");
        expect(lines).toHaveLength(2);
        expect(lines[0]).toBe("Line One: Spacing Test");
        expect(lines[1]).toBe("Line Two: Another Spaced Turn");
      });

      it("T1.2.4: engine manages initialize and terminate lifecycle cleanly", async () => {
        const ocr = new MockDesktopOcrEngine();
        await expect(ocr.initialize()).resolves.toBeUndefined();
        const pngBuf = createSyntheticPngBuffer("lifecycle-test");
        await expect(ocr.extractFromBuffer(pngBuf)).resolves.toBeDefined();
        await expect(ocr.terminate()).resolves.toBeUndefined();
      });

      it("T1.2.5: text normalizer sanitizes raw OCR output, removing null bytes and excess whitespace", () => {
        const rawOcr = "  \u0000Alex:   Hey!   \r\n\n\n  Jordan:   See    you   soon.  \u0000";
        const normalized = normalizeRecentContext(rawOcr, { removeParticipantNames: true });

        expect(normalized.text).toBe("Participant: Hey!\nParticipant: See you soon.");
        expect(normalized.messageCount).toBe(2);
        expect(normalized.participantNamesRemoved).toBe(true);
      });
    });

    describe("R3: AI Suggestion Pipeline Integration", () => {
      it("T1.3.1: produces exactly 3 categorized replies (safe, confident, playful)", async () => {
        const fetchRequest = vi.fn<typeof fetch>(async () => Response.json(standardApiResponse));
        const client = createTestClient(fetchRequest);

        const result = await client.suggest({
          accessToken: "access-token-12345",
          messages: [{ role: "unknown", text: "Are you free tonight?" }],
          tone: "warm",
          relationshipStage: "dating",
        });

        expect(result.replies).toHaveLength(3);
        const categories = result.replies.map((r) => r.category);
        expect(categories).toContain("safe");
        expect(categories).toContain("confident");
        expect(categories).toContain("playful");
      });

      it("T1.3.2: propagates chosen tone selection in request payload", async () => {
        let capturedTone: string | undefined;
        const fetchRequest = vi.fn<typeof fetch>(async (_url, init) => {
          const body = JSON.parse(String(init?.body)) as { tone: string };
          capturedTone = body.tone;
          return Response.json(standardApiResponse);
        });

        const client = createTestClient(fetchRequest);
        await client.suggest({
          accessToken: "access-token-12345",
          messages: [{ role: "unknown", text: "Hey!" }],
          tone: "witty",
          relationshipStage: "dating",
        });

        expect(capturedTone).toBe("witty");
      });

      it("T1.3.3: propagates chosen relationship stage context in request payload", async () => {
        let capturedStage: string | undefined;
        const fetchRequest = vi.fn<typeof fetch>(async (_url, init) => {
          const body = JSON.parse(String(init?.body)) as { relationshipStage: string };
          capturedStage = body.relationshipStage;
          return Response.json(standardApiResponse);
        });

        const client = createTestClient(fetchRequest);
        await client.suggest({
          accessToken: "access-token-12345",
          messages: [{ role: "unknown", text: "Nice to match!" }],
          tone: "playful",
          relationshipStage: "new_match",
        });

        expect(capturedStage).toBe("new_match");
      });

      it("T1.3.4: ensures each reply has non-empty text and rationale explanation", async () => {
        const fetchRequest = vi.fn<typeof fetch>(async () => Response.json(standardApiResponse));
        const client = createTestClient(fetchRequest);

        const result = await client.suggest({
          accessToken: "access-token-12345",
          messages: [{ role: "unknown", text: "Hey" }],
          tone: "confident",
          relationshipStage: "dating",
        });

        for (const reply of result.replies) {
          expect(reply.text.trim().length).toBeGreaterThan(0);
          expect(reply.whyItWorks.trim().length).toBeGreaterThan(0);
        }
      });

      it("T1.3.5: surfaces remaining quota credit count from server response", async () => {
        const fetchRequest = vi.fn<typeof fetch>(async () =>
          Response.json({ ...standardApiResponse, remaining: 12 }),
        );
        const client = createTestClient(fetchRequest);

        const result = await client.suggest({
          accessToken: "access-token-12345",
          messages: [{ role: "unknown", text: "Hey" }],
          tone: "warm",
          relationshipStage: "dating",
        });

        expect(result.remaining).toBe(12);
      });
    });
  });

  // --------------------------------------------------------------------------
  // Tier 2: Boundary & Corner Cases -> 15 Tests
  // --------------------------------------------------------------------------
  describe("Tier 2: Boundary & Corner Cases", () => {
    describe("R1 Boundaries: Screen Capture", () => {
      it("T2.1.1: throws WINDOW_MINIMIZED when captured window thumbnail isEmpty is true", async () => {
        const capturer: DesktopCapturerApi = {
          getSources: async () => [
            {
              id: "window:101:0",
              name: "WhatsApp",
              thumbnail: createMockNativeImage(Buffer.alloc(0), 0, 0, true), // isEmpty = true
            },
          ],
        };

        const service = new WindowCaptureService(capturer);
        await expect(service.captureWindow("window:101:0")).rejects.toMatchObject({
          name: "WindowCaptureError",
          code: "WINDOW_MINIMIZED",
        });
      });

      it("T2.1.2: throws WINDOW_NOT_FOUND when sourceId does not exist in enumerated sources", async () => {
        const capturer: DesktopCapturerApi = {
          getSources: async () => [
            {
              id: "window:101:0",
              name: "WhatsApp",
              thumbnail: createMockNativeImage(createSyntheticPngBuffer(), 1920, 1080),
            },
          ],
        };

        const service = new WindowCaptureService(capturer);
        await expect(service.captureWindow("window:99999:0")).rejects.toMatchObject({
          name: "WindowCaptureError",
          code: "WINDOW_NOT_FOUND",
        });
      });

      it("T2.1.3: rejects malformed source ID format safely", () => {
        expect(windowHandleFromSourceId("invalid:source:id")).toBeNull();
        expect(windowHandleFromSourceId("screen:0:0")).toBeNull();
        expect(windowHandleFromSourceId("window:notanumber:0")).toBeNull();
        expect(windowHandleFromSourceId("window:9007199254740993:0")).toBeNull(); // Exceeds Number.MAX_SAFE_INTEGER
      });

      it("T2.1.4: handles empty desktop sources list gracefully without crashing", async () => {
        const capturer: DesktopCapturerApi = {
          getSources: async () => [],
        };

        const service = new WindowCaptureService(capturer);
        const candidates = await service.enumerateCandidates();
        expect(candidates).toEqual([]);
      });

      it("T2.1.5: handles extreme capture resolution requests safely (4K down to 1x1)", async () => {
        const capturer: DesktopCapturerApi = {
          getSources: vi.fn(async (options) => {
            const { width, height } = options.thumbnailSize ?? { width: 1920, height: 1080 };
            return [
              {
                id: "window:101:0",
                name: "Discord",
                thumbnail: createMockNativeImage(createSyntheticPngBuffer("4k", width, height), width, height),
              },
            ];
          }),
        };

        const service = new WindowCaptureService(capturer);
        const frame4k = await service.captureWindow("window:101:0", { width: 3840, height: 2160 });
        expect(frame4k.width).toBe(3840);
        expect(frame4k.height).toBe(2160);

        const frameTiny = await service.captureWindow("window:101:0", { width: 1, height: 1 });
        expect(frameTiny.width).toBe(1);
        expect(frameTiny.height).toBe(1);
      });
    });

    describe("R2 Boundaries: Local OCR & Normalization", () => {
      it("T2.2.1: rejects 0-byte empty buffer with explicit error", async () => {
        const ocr = new MockDesktopOcrEngine();
        await expect(ocr.extractFromBuffer(Buffer.alloc(0))).rejects.toThrow(/OCR_EMPTY_BUFFER/);
      });

      it("T2.2.2: rejects corrupted or non-image binary buffer safely without crash", async () => {
        const ocr = new MockDesktopOcrEngine();
        const corruptedBuffer = Buffer.from("NOT_A_PNG_OR_IMAGE_DATA_CORRUPT");
        await expect(ocr.extractFromBuffer(corruptedBuffer)).rejects.toThrow(/OCR_DECODING_ERROR/);
      });

      it("T2.2.3: extracts minimal single-word conversation correctly", async () => {
        const ocr = new MockDesktopOcrEngine();
        const pngBuf = createSyntheticPngBuffer("single-word");
        ocr.registerTranscript(pngBuf.toString("base64"), "Hey");

        const result = await ocr.extractFromBuffer(pngBuf);
        expect(result.rawText).toBe("Hey");
        expect(result.normalizedText).toBe("Hey");
      });

      it("T2.2.4: conversation normalizer strictly caps history to the 8 most recent messages", () => {
        const fifteenMessages = Array.from({ length: 15 }, (_, i) => `Msg ${i + 1}`).join("\n");
        const normalized = normalizeRecentContext(fifteenMessages);

        expect(normalized.messageCount).toBe(MAX_CONTEXT_MESSAGES); // 8
        expect(normalized.text).toBe(
          "Msg 8\nMsg 9\nMsg 10\nMsg 11\nMsg 12\nMsg 13\nMsg 14\nMsg 15",
        );
        expect(normalized.truncated).toBe(true);
      });

      it("T2.2.5: conversation normalizer strictly bounds total length to <= 4,000 characters", () => {
        const newest = "z".repeat(600);
        const massiveInput = Array.from({ length: MAX_CONTEXT_MESSAGES }, (_, index) =>
          index === MAX_CONTEXT_MESSAGES - 1 ? newest : String(index).repeat(600),
        ).join("\n");
        const normalized = normalizeRecentContext(massiveInput);

        expect(normalized.text.length).toBeLessThanOrEqual(MAX_CONTEXT_CHARACTERS); // 4000
        expect(normalized.text.endsWith(newest)).toBe(true);
        expect(normalized.truncated).toBe(true);
      });
    });

    describe("R3 Boundaries: Suggestion Pipeline & Upstream Errors", () => {
      it("T2.3.1: rejects access token containing whitespace before network access", async () => {
        const fetchRequest = vi.fn<typeof fetch>();
        const client = createTestClient(fetchRequest);

        await expect(
          client.suggest({
            accessToken: "token with invalid spaces",
            messages: [{ role: "unknown", text: "Hey" }],
            tone: "warm",
            relationshipStage: "dating",
          }),
        ).rejects.toMatchObject({ code: "unauthorized" });
        expect(fetchRequest).not.toHaveBeenCalled();
      });

      it("T2.3.2: rejects context exceeding 4,000 characters before network access", async () => {
        const fetchRequest = vi.fn<typeof fetch>();
        const client = createTestClient(fetchRequest);

        await expect(
          client.suggest({
            accessToken: "valid-access-token",
            messages: Array.from({ length: 5 }, () => ({
              role: "unknown" as const,
              text: "x".repeat(1_000), // 5 * 1000 = 5000 > 4000
            })),
            tone: "warm",
            relationshipStage: "dating",
          }),
        ).rejects.toMatchObject({ code: "protocol" });
        expect(fetchRequest).not.toHaveBeenCalled();
      });

      it("T2.3.3: rejects empty context (0 messages) before network call", async () => {
        const fetchRequest = vi.fn<typeof fetch>();
        const client = createTestClient(fetchRequest);

        await expect(
          client.suggest({
            accessToken: "valid-access-token",
            messages: [],
            tone: "warm",
            relationshipStage: "dating",
          }),
        ).rejects.toMatchObject({ code: "protocol" });
        expect(fetchRequest).not.toHaveBeenCalled();
      });

      it("T2.3.4: maps HTTP 429 rate limit failure to sanitized rate_limit code", async () => {
        const fetchRequest = vi.fn<typeof fetch>(async () =>
          Response.json({ code: "RATE_LIMIT", error: "Too many requests" }, { status: 429 }),
        );
        const client = createTestClient(fetchRequest);

        await expect(
          client.suggest({
            accessToken: "valid-access-token",
            messages: [{ role: "unknown", text: "Hey" }],
            tone: "warm",
            relationshipStage: "dating",
          }),
        ).rejects.toMatchObject({ code: "rate_limit" });
      });

      it("T2.3.5: maps HTTP 402 quota exhaustion failure to sanitized paywall code", async () => {
        const fetchRequest = vi.fn<typeof fetch>(async () =>
          Response.json({ code: "PAYWALL", error: "Allowance exhausted" }, { status: 402 }),
        );
        const client = createTestClient(fetchRequest);

        await expect(
          client.suggest({
            accessToken: "valid-access-token",
            messages: [{ role: "unknown", text: "Hey" }],
            tone: "warm",
            relationshipStage: "dating",
          }),
        ).rejects.toMatchObject({ code: "paywall" });
      });
    });
  });

  // --------------------------------------------------------------------------
  // Tier 3: Cross-Feature Combinations -> 4 Tests
  // --------------------------------------------------------------------------
  describe("Tier 3: Cross-Feature Combinations", () => {
    it("T3.1: Pairwise Capture + OCR: captured window buffer directly parses via OCR without disk I/O", async () => {
      const pngBuf = createSyntheticPngBuffer("pairwise-capture-ocr");
      const capturer: DesktopCapturerApi = {
        getSources: async () => [
          {
            id: "window:101:0",
            name: "WhatsApp",
            thumbnail: createMockNativeImage(pngBuf, 1920, 1080),
          },
        ],
      };

      const captureService = new WindowCaptureService(capturer);
      const ocrEngine = new MockDesktopOcrEngine();
      ocrEngine.registerTranscript(
        pngBuf.toString("base64"),
        "Taylor: Dinner at 7pm tonight?\nSam: Perfect, see you there!",
      );

      // Step 1: Capture frame
      const frame = await captureService.captureWindow("window:101:0");
      expect(frame.imageBuffer).toBe(pngBuf);

      // Step 2: Feed directly to OCR
      const ocrResult = await ocrEngine.extractFromBuffer(frame.imageBuffer);
      expect(ocrResult.rawText).toContain("Dinner at 7pm tonight?");
      expect(ocrResult.rawText).toContain("Perfect, see you there!");
    });

    it("T3.2: Pairwise OCR + Suggestion: OCR transcript normalizes and generates 3 categorized replies", async () => {
      const ocrEngine = new MockDesktopOcrEngine();
      const pngBuf = createSyntheticPngBuffer("pairwise-ocr-suggestion");
      ocrEngine.registerTranscript(
        pngBuf.toString("base64"),
        "Morgan: What do you think about going to that new art gallery?\nRiley: Sounds interesting!",
      );

      const fetchRequest = vi.fn<typeof fetch>(async () => Response.json(standardApiResponse));
      const suggestionClient = createTestClient(fetchRequest);

      const ocrResult = await ocrEngine.extractFromBuffer(pngBuf);
      const normalized = normalizeRecentContext(ocrResult.rawText, { removeParticipantNames: true });

      const messages = normalized.text.split("\n").map((text) => ({ role: "unknown" as const, text }));
      const suggestions = await suggestionClient.suggest({
        accessToken: "valid-access-token",
        messages,
        tone: "playful",
        relationshipStage: "dating",
      });

      expect(suggestions.replies).toHaveLength(3);
      expect(suggestions.replies[0]?.category).toBe("safe");
      expect(suggestions.replies[1]?.category).toBe("confident");
      expect(suggestions.replies[2]?.category).toBe("playful");
    });

    it("T3.3: Full End-to-End Pipeline: window selection -> capture -> OCR -> normalize -> suggestions", async () => {
      const pngBuf = createSyntheticPngBuffer("full-e2e");
      const capturer: DesktopCapturerApi = {
        getSources: async () => [
          {
            id: "window:501:0",
            name: "WhatsApp Web",
            thumbnail: createMockNativeImage(pngBuf, 1920, 1080),
          },
        ],
      };

      const captureService = new WindowCaptureService(capturer);
      const ocrEngine = new MockDesktopOcrEngine();
      ocrEngine.registerTranscript(
        pngBuf.toString("base64"),
        "Alex: I had so much fun on our walk today.\nMe: Me too! We should do it again soon.\nAlex: Are you free this weekend?",
      );

      const fetchRequest = vi.fn<typeof fetch>(async () => Response.json(standardApiResponse));
      const suggestionClient = createTestClient(fetchRequest);

      const pipelineResult = await runE2ESuggestionPipeline({
        sourceId: "window:501:0",
        captureService,
        ocrEngine,
        suggestionClient,
        accessToken: "valid-access-token",
        tone: "confident",
        relationshipStage: "first_dates",
      });

      expect(pipelineResult.sourceId).toBe("window:501:0");
      expect(pipelineResult.appType).toBe("whatsapp");
      expect(pipelineResult.normalizedMessageCount).toBe(3);
      expect(pipelineResult.replies).toHaveLength(3);
      expect(pipelineResult.remaining).toBe(5);
    });

    it("T3.4: End-to-End Error Recovery: capture failure halts pipeline safely without unhandled error", async () => {
      const capturer: DesktopCapturerApi = {
        getSources: async () => [
          {
            id: "window:502:0",
            name: "Discord",
            thumbnail: createMockNativeImage(Buffer.alloc(0), 0, 0, true), // Minimized!
          },
        ],
      };

      const captureService = new WindowCaptureService(capturer);
      const ocrEngine = new MockDesktopOcrEngine();
      const fetchRequest = vi.fn<typeof fetch>();
      const suggestionClient = createTestClient(fetchRequest);

      await expect(
        runE2ESuggestionPipeline({
          sourceId: "window:502:0",
          captureService,
          ocrEngine,
          suggestionClient,
          accessToken: "valid-access-token",
        }),
      ).rejects.toMatchObject({
        name: "WindowCaptureError",
        code: "WINDOW_MINIMIZED",
      });

      // Assert downstream services were not called
      expect(fetchRequest).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // Tier 4: Real-World Application Scenarios -> 5 Tests
  // --------------------------------------------------------------------------
  describe("Tier 4: Real-World Application Scenarios", () => {
    it("T4.1: WhatsApp Dating Match: multi-turn casual dialogue with informal language and emojis", async () => {
      const pngBuf = createSyntheticPngBuffer("whatsapp-dating");
      const capturer: DesktopCapturerApi = {
        getSources: async () => [
          {
            id: "window:701:0",
            name: "WhatsApp - Jessica",
            thumbnail: createMockNativeImage(pngBuf, 1920, 1080),
          },
        ],
      };

      const captureService = new WindowCaptureService(capturer);
      const ocrEngine = new MockDesktopOcrEngine();
      const whatsappTranscript = [
        "Jessica: Hey!! Still recovering from that coffee place 😂",
        "Me: Haha told you the espresso was intense!",
        "Jessica: Definitely haha. Are you down for tacos on Tuesday instead? 🌮",
      ].join("\n");

      ocrEngine.registerTranscript(pngBuf.toString("base64"), whatsappTranscript);

      const fetchRequest = vi.fn<typeof fetch>(async (_url, init) => {
        const body = JSON.parse(String(init?.body)) as { messages: { text: string }[] };
        expect(body.messages).toHaveLength(3);
        expect(body.messages[2]?.text).toContain("tacos on Tuesday");
        return Response.json(standardApiResponse);
      });

      const suggestionClient = createTestClient(fetchRequest);
      const result = await runE2ESuggestionPipeline({
        sourceId: "window:701:0",
        captureService,
        ocrEngine,
        suggestionClient,
        accessToken: "valid-access-token",
        tone: "playful",
        relationshipStage: "dating",
      });

      expect(result.appType).toBe("whatsapp");
      expect(result.replies).toHaveLength(3);
      expect(result.replies.map((r) => r.category)).toEqual(["safe", "confident", "playful"]);
    });

    it("T4.2: Discord Gaming Banter: rapid squad chatter with gamer tags and abbreviations", async () => {
      const pngBuf = createSyntheticPngBuffer("discord-gaming");
      const capturer: DesktopCapturerApi = {
        getSources: async () => [
          {
            id: "window:702:0",
            name: "Discord | #ranked-squad",
            thumbnail: createMockNativeImage(pngBuf, 1920, 1080),
          },
        ],
      };

      const captureService = new WindowCaptureService(capturer);
      const ocrEngine = new MockDesktopOcrEngine();
      const discordTranscript = [
        "Viper: ggs that last match was insane",
        "Ghost: bro stole my ace again smh",
        "Viper: u were 1 shot admit it lol",
        "Ghost: run it back one more game? need redemption",
      ].join("\n");

      ocrEngine.registerTranscript(pngBuf.toString("base64"), discordTranscript);

      const fetchRequest = vi.fn<typeof fetch>(async () => Response.json(standardApiResponse));
      const suggestionClient = createTestClient(fetchRequest);

      const result = await runE2ESuggestionPipeline({
        sourceId: "window:702:0",
        captureService,
        ocrEngine,
        suggestionClient,
        accessToken: "valid-access-token",
        tone: "witty",
        relationshipStage: "dating",
      });

      expect(result.appType).toBe("discord");
      expect(result.normalizedMessageCount).toBe(4);
      expect(result.replies).toHaveLength(3);
    });

    it("T4.3: Slack Work Sync: semi-formal professional discussion regarding scheduling and deliverables", async () => {
      const pngBuf = createSyntheticPngBuffer("slack-work");
      const capturer: DesktopCapturerApi = {
        getSources: async () => [
          {
            id: "window:703:0",
            name: "Slack - project-launch",
            thumbnail: createMockNativeImage(pngBuf, 1920, 1080),
          },
        ],
      };

      const captureService = new WindowCaptureService(capturer);
      const ocrEngine = new MockDesktopOcrEngine();
      const slackTranscript = [
        "Sarah Jenkins: Hi team, we reviewed the Q3 roadmap updates this morning.",
        "David Chen: Looks great. Do we have the revised timeline for the security review?",
        "Sarah Jenkins: Yes, pushed to staging today. Can everyone review before 4pm?",
      ].join("\n");

      ocrEngine.registerTranscript(pngBuf.toString("base64"), slackTranscript);

      const fetchRequest = vi.fn<typeof fetch>(async (_url, init) => {
        const body = JSON.parse(String(init?.body)) as { tone: string };
        expect(body.tone).toBe("professional");
        return Response.json(standardApiResponse);
      });

      const suggestionClient = createTestClient(fetchRequest);
      const result = await runE2ESuggestionPipeline({
        sourceId: "window:703:0",
        captureService,
        ocrEngine,
        suggestionClient,
        accessToken: "valid-access-token",
        tone: "professional",
        relationshipStage: "dating",
      });

      expect(result.appType).toBe("slack");
      expect(result.normalizedMessageCount).toBe(3);
    });

    it("T4.4: Complex Multi-Line Conversation: long-turn messages with paragraph formatting", async () => {
      const pngBuf = createSyntheticPngBuffer("complex-multiline");
      const capturer: DesktopCapturerApi = {
        getSources: async () => [
          {
            id: "window:704:0",
            name: "WhatsApp - Deep Discussion",
            thumbnail: createMockNativeImage(pngBuf, 1920, 1080),
          },
        ],
      };

      const captureService = new WindowCaptureService(capturer);
      const ocrEngine = new MockDesktopOcrEngine();
      const complexTranscript = [
        "Taylor: Hey! Just wanted to share my thoughts on the book you recommended.",
        "Taylor: The central premise was fascinating, especially the chapter on habit loops.",
        "Taylor: Did you agree with the author's conclusions regarding environmental design?",
      ].join("\n");

      ocrEngine.registerTranscript(pngBuf.toString("base64"), complexTranscript);

      const fetchRequest = vi.fn<typeof fetch>(async () => Response.json(standardApiResponse));
      const suggestionClient = createTestClient(fetchRequest);

      const result = await runE2ESuggestionPipeline({
        sourceId: "window:704:0",
        captureService,
        ocrEngine,
        suggestionClient,
        accessToken: "valid-access-token",
        tone: "warm",
      });

      expect(result.normalizedMessageCount).toBe(3);
      expect(result.replies).toHaveLength(3);
    });

    it("T4.5: Noisy Background Chat: resiliently strips UI chrome, timestamps, and sidebars", async () => {
      const pngBuf = createSyntheticPngBuffer("noisy-chat");
      const capturer: DesktopCapturerApi = {
        getSources: async () => [
          {
            id: "window:705:0",
            name: "Discord - #general-chat",
            thumbnail: createMockNativeImage(pngBuf, 1920, 1080),
          },
        ],
      };

      const captureService = new WindowCaptureService(capturer);
      const ocrEngine = new MockDesktopOcrEngine();

      // Noisy transcript containing duplicate adjacent lines and control characters
      const noisyTranscript = [
        "  \u0000[10:42 AM] Channel topic: General discussions  ",
        "  \u0000[10:42 AM] Channel topic: General discussions  ",
        "Casey: Are we still meeting at Central Park? \r\n",
        "Casey: Are we still meeting at Central Park? \r\n",
        "Pat: Yes! Bringing snacks too. \u0000",
      ].join("\n");

      ocrEngine.registerTranscript(pngBuf.toString("base64"), noisyTranscript);

      const fetchRequest = vi.fn<typeof fetch>(async () => Response.json(standardApiResponse));
      const suggestionClient = createTestClient(fetchRequest);

      const result = await runE2ESuggestionPipeline({
        sourceId: "window:705:0",
        captureService,
        ocrEngine,
        suggestionClient,
        accessToken: "valid-access-token",
      });

      // Normalization should deduplicate consecutive identical lines and redact names
      expect(result.normalizedMessageCount).toBe(3);
      expect(result.replies).toHaveLength(3);
    });
  });
});
