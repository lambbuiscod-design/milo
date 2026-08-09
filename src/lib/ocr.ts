import "server-only";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createWorker, OEM, PSM, type Worker } from "tesseract.js";
import englishLanguageData from "@tesseract.js-data/eng";
import { isUsefulConversationText, normalizeOcrText } from "@/lib/ocr-text";

export type OcrErrorCode = "OCR_UNCLEAR" | "OCR_TIMEOUT" | "OCR_UNAVAILABLE";

export class OcrProcessingError extends Error {
  constructor(
    public readonly code: OcrErrorCode,
    public readonly status: 422 | 503 | 504,
  ) {
    super(code);
    this.name = "OcrProcessingError";
  }
}

const OCR_TIMEOUT_MS = 25_000;
const englishDataPath = join(
  dirname(englishLanguageData.langPath),
  "4.0.0_best_int",
);

export async function extractConversationText(image: Buffer) {
  let worker: Worker | null = null;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const workerPromise = createWorker("eng", OEM.LSTM_ONLY, {
    cachePath: join(tmpdir(), "milo-tesseract-cache"),
    langPath: englishDataPath,
    logger: () => undefined,
    errorHandler: () => undefined,
  });
  const timedOut = new Promise<never>((_, reject) => {
    timeout = setTimeout(
      () => reject(new OcrProcessingError("OCR_TIMEOUT", 504)),
      OCR_TIMEOUT_MS,
    );
  });

  try {
    worker = await Promise.race([workerPromise, timedOut]);
    await Promise.race([
      worker.setParameters({
        tessedit_pageseg_mode: PSM.SPARSE_TEXT,
        preserve_interword_spaces: "1",
        user_defined_dpi: "300",
      }),
      timedOut,
    ]);

    const recognition = worker.recognize(image);
    const result = await Promise.race([recognition, timedOut]);
    const text = normalizeOcrText(result.data.text);
    if (!isUsefulConversationText(text)) {
      throw new OcrProcessingError("OCR_UNCLEAR", 422);
    }
    return text;
  } catch (error) {
    if (error instanceof OcrProcessingError) throw error;
    throw new OcrProcessingError("OCR_UNAVAILABLE", 503);
  } finally {
    if (timeout) clearTimeout(timeout);
    if (worker) {
      await worker.terminate().catch(() => undefined);
    } else {
      void workerPromise.then((lateWorker) => lateWorker.terminate()).catch(() => undefined);
    }
  }
}
