import { Buffer } from "node:buffer";

/**
 * High-contrast synthetic chat conversation SVG markup.
 * Designed for 100% offline local OCR parsing without external network requests.
 * Conforms strictly to @milo/test-fixtures policy (fixtureDataPolicy = "synthetic-only").
 */
export const SYNTHETIC_CHAT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600" viewBox="0 0 900 600">
  <rect width="900" height="600" fill="#ffffff"/>
  <rect x="30" y="30" width="840" height="540" rx="16" fill="#f8fafc" stroke="#e2e8f0" stroke-width="2"/>
  
  <rect x="60" y="70" width="760" height="120" rx="16" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1"/>
  <text x="90" y="145" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="600" fill="#0f172a">Alex: I had a really nice time tonight.</text>

  <rect x="60" y="230" width="760" height="120" rx="16" fill="#e0e7ff" stroke="#a5b4fc" stroke-width="1"/>
  <text x="90" y="305" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="600" fill="#1e1b4b">Me: I did too. It was fun!</text>

  <rect x="60" y="390" width="760" height="120" rx="16" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1"/>
  <text x="90" y="465" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="600" fill="#0f172a">Alex: We should definitely do it again.</text>
</svg>`;

export const SYNTHETIC_CHAT_EXPECTED_SUBSTRINGS = [
  "really nice time tonight",
  "It was fun",
  "definitely do it again",
] as const;

let initialBase64 = "";

try {
  const sharpModule: any = await import("sharp");
  const sharpFn =
    typeof sharpModule.default === "function"
      ? sharpModule.default
      : typeof sharpModule === "function"
        ? sharpModule
        : null;

  if (sharpFn) {
    const pngBuffer = await sharpFn(Buffer.from(SYNTHETIC_CHAT_SVG))
      .png({ compressionLevel: 9 })
      .toBuffer();
    initialBase64 = pngBuffer.toString("base64");
  }
} catch {
  // In environments without sharp or during initial compilation, base64 may be generated on demand
}

export const SYNTHETIC_CHAT_IMAGE_BASE64: string = initialBase64;

/**
 * Returns a Buffer containing the valid synthetic chat PNG image.
 */
export function getSyntheticChatImageBuffer(): Buffer {
  if (SYNTHETIC_CHAT_IMAGE_BASE64 && SYNTHETIC_CHAT_IMAGE_BASE64.length > 0) {
    return Buffer.from(SYNTHETIC_CHAT_IMAGE_BASE64, "base64");
  }
  throw new Error("Synthetic chat image buffer could not be generated: base64 is empty.");
}
