import { Buffer } from "node:buffer";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createWorker, OEM, PSM, type Worker } from "tesseract.js";
import { normalizeRecentContext } from "./context-normalizer";

const require = createRequire(import.meta.url);

export type OcrExtractionResult = Readonly<{
  rawText: string;
  normalizedText: string;
  confidence: number;
  durationMs: number;
}>;

export type OcrEngineOptions = Readonly<{
  langPath?: string;
  cachePath?: string;
  timeoutMs?: number;
  dpi?: number;
}>;

export interface DesktopOcrEngineApi {
  initialize(): Promise<void>;
  extractFromBuffer(imageBuffer: Buffer, options?: OcrEngineOptions): Promise<OcrExtractionResult>;
  terminate(): Promise<void>;
}

/**
 * Resolves the path to the local offline integer-quantized LSTM model (4.0.0_best_int).
 * Guarantees 100% offline operation without any network requests.
 */
function getOfflineTrainedDataPath(): string {
  try {
    const pkgPath = require.resolve("@tesseract.js-data/eng/package.json");
    return join(dirname(pkgPath), "4.0.0_best_int");
  } catch {
    return join(process.cwd(), "node_modules", "@tesseract.js-data", "eng", "4.0.0_best_int");
  }
}

/**
 * Normalizes raw OCR transcript by stripping control characters and excessive whitespace.
 */
export function normalizeOcrText(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 12_000);
}

/**
 * High-performance local OCR engine running in Node.js worker_threads in the Main process.
 * Reusable worker instance, timeout guard, clean termination, and offline model execution.
 */
export class DesktopOcrEngine implements DesktopOcrEngineApi {
  private worker: Worker | null = null;
  private initPromise: Promise<Worker> | null = null;
  private readonly defaultTimeoutMs: number;

  constructor(options: { defaultTimeoutMs?: number } = {}) {
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 25_000;
  }

  /**
   * Initializes the Tesseract.js worker with offline LSTM models.
   * Safe to call concurrently; subsequent calls share the same initialization promise.
   */
  async initialize(): Promise<void> {
    await this.getOrCreateWorker();
  }

  private async getOrCreateWorker(options?: OcrEngineOptions): Promise<Worker> {
    if (this.worker) {
      return this.worker;
    }

    if (this.initPromise) {
      return await this.initPromise;
    }

    this.initPromise = (async () => {
      const langPath = options?.langPath ?? getOfflineTrainedDataPath();
      const cachePath = options?.cachePath ?? join(tmpdir(), "milo-tesseract-cache");

      const worker = await createWorker("eng", OEM.LSTM_ONLY, {
        cachePath,
        langPath,
        logger: () => undefined,
        errorHandler: () => undefined,
      });

      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SPARSE_TEXT,
        preserve_interword_spaces: "1",
        user_defined_dpi: options?.dpi ? String(options.dpi) : "300",
      });

      this.worker = worker;
      return worker;
    })();

    try {
      return await this.initPromise;
    } finally {
      this.initPromise = null;
    }
  }

  /**
   * Extracts text from an image buffer using local Tesseract LSTM model.
   * Validates buffer integrity, rejects empty and corrupted buffers,
   * enforces timeout guard, and returns confidence, duration, and normalized context.
   */
  async extractFromBuffer(imageBuffer: Buffer, options?: OcrEngineOptions): Promise<OcrExtractionResult> {
    const startTime = Date.now();

    // Guard: reject empty image buffer
    if (!imageBuffer || imageBuffer.length === 0) {
      throw new Error("OCR_EMPTY_BUFFER: Image buffer cannot be empty");
    }

    // Guard: check image signature (PNG, JPEG, BMP, WebP)
    const isPng =
      imageBuffer.length >= 8 &&
      imageBuffer[0] === 0x89 &&
      imageBuffer[1] === 0x50 &&
      imageBuffer[2] === 0x4e &&
      imageBuffer[3] === 0x47;

    const isJpeg =
      imageBuffer.length >= 3 &&
      imageBuffer[0] === 0xff &&
      imageBuffer[1] === 0xd8 &&
      imageBuffer[2] === 0xff;

    const isBmp =
      imageBuffer.length >= 2 &&
      imageBuffer[0] === 0x42 &&
      imageBuffer[1] === 0x4d;

    const isWebp =
      imageBuffer.length >= 12 &&
      imageBuffer.toString("utf8", 0, 4) === "RIFF" &&
      imageBuffer.toString("utf8", 8, 12) === "WEBP";

    if (!isPng && !isJpeg && !isBmp && !isWebp) {
      throw new Error("OCR_DECODING_ERROR: Corrupted or unsupported image buffer format");
    }

    if (isPng && imageBuffer.length < 24) {
      throw new Error("OCR_DECODING_ERROR: Corrupted or truncated PNG image buffer");
    }

    const timeoutMs = options?.timeoutMs ?? this.defaultTimeoutMs;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`OCR_TIMEOUT: OCR recognition timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      const recognitionPromise = (async () => {
        const worker = await this.getOrCreateWorker(options);
        return await worker.recognize(imageBuffer);
      })();

      const recognized = await Promise.race([recognitionPromise, timeoutPromise]);
      const rawText = normalizeOcrText(recognized.data.text || "");
      const normalizedContext = normalizeRecentContext(rawText, {
        maxMessages: 8,
        removeParticipantNames: false,
      });
      const normalizedText = normalizedContext.text;
      const confidence = typeof recognized.data.confidence === "number" ? recognized.data.confidence : 0;
      const durationMs = Math.max(1, Date.now() - startTime);

      return {
        rawText,
        normalizedText,
        confidence,
        durationMs,
      };
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("OCR_TIMEOUT")) {
        await this.terminate();
        throw error;
      }
      if (
        error instanceof Error &&
        (error.message.startsWith("OCR_EMPTY_BUFFER") ||
          error.message.startsWith("OCR_DECODING_ERROR"))
      ) {
        throw error;
      }
      throw new Error(
        `OCR_DECODING_ERROR: Failed to process image: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /**
   * Gracefully terminates the underlying worker thread.
   */
  async terminate(): Promise<void> {
    if (this.initPromise) {
      const worker = await this.initPromise.catch(() => null);
      this.initPromise = null;
      if (worker) {
        await worker.terminate().catch(() => undefined);
      }
    }
    if (this.worker) {
      const workerToTerminate = this.worker;
      this.worker = null;
      await workerToTerminate.terminate().catch(() => undefined);
    }
  }
}

export { DesktopOcrEngine as DefaultDesktopOcrEngine };
export { DesktopOcrEngine as TesseractDesktopOcrEngine };
