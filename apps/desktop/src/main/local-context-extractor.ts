import type {
  NativeHelperClient,
  NativeTextSnapshot,
  NativeWindowIdentity,
} from "./native-helper-client";

export type LocalExtractionMethod = "uia" | "local_ocr";
export type LocalContextSnapshot = NativeTextSnapshot & Readonly<{
  method: LocalExtractionMethod;
  language: "en" | "it" | null;
}>;

type LocalExtractionHelper = Pick<NativeHelperClient, "extractText" | "captureText">;

export function hasUsefulLocalText(value: string): boolean {
  const lines = value.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
  return lines.length >= 2 && lines.join(" ").length >= 20;
}

/**
 * Reads one already-validated selected window. UI Automation is always first;
 * WGC/OCR is used only when accessibility text is insufficient. Pixel buffers
 * remain wholly inside the native helper and are never returned here.
 */
export async function extractLocalContext(
  helper: LocalExtractionHelper,
  identity: NativeWindowIdentity,
  maxChars = 6_000,
  preferredOcrLanguage: "en" | "it" = "en",
): Promise<LocalContextSnapshot> {
  const uia = await helper.extractText(identity, maxChars);
  if (hasUsefulLocalText(uia.text)) return { ...uia, method: "uia", language: null };

  let bestOcr: (NativeTextSnapshot & { language: "en" | "it" }) | null = null;
  const ocrLanguages = preferredOcrLanguage === "it" ? (["it", "en"] as const) : (["en", "it"] as const);
  for (const language of ocrLanguages) {
    try {
      const ocr = await helper.captureText(identity, language, maxChars);
      if (bestOcr === null || ocr.text.length > bestOcr.text.length) bestOcr = { ...ocr, language };
      if (hasUsefulLocalText(ocr.text)) return { ...ocr, method: "local_ocr", language };
    } catch {
      // A missing language pack or unavailable capture capability must not
      // discard a usable best-effort UI Automation snapshot.
    }
  }

  if (bestOcr !== null && bestOcr.text.trim().length > uia.text.trim().length) {
    return { ...bestOcr, method: "local_ocr" };
  }
  return { ...uia, method: "uia", language: null };
}
