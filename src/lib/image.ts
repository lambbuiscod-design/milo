import sharp from "sharp";
import { validateProcessedImageFile } from "@/lib/image-upload";

export { MAX_PROCESSED_IMAGE_BYTES } from "@/lib/image-upload";
export const MIN_IMAGE_EDGE = 240;
const ALLOWED_DECODED_FORMATS = new Set(["png", "jpeg", "webp"]);
const EXPECTED_FORMAT_BY_MIME = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpeg"],
  ["image/webp", "webp"],
]);

export class ImageProcessingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageProcessingError";
  }
}

export function validateImageFile(file: File) {
  return validateProcessedImageFile(file);
}

function signatureFormat(bytes: Uint8Array) {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return "png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpeg";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return "webp";
  return null;
}

export async function sanitizeImage(file: File) {
  const validationError = validateImageFile(file);
  if (validationError) throw new ImageProcessingError(validationError);

  const raw = Buffer.from(await file.arrayBuffer());
  try {
    const detectedSignature = signatureFormat(raw);
    if (!detectedSignature || EXPECTED_FORMAT_BY_MIME.get(file.type) !== detectedSignature) {
      throw new ImageProcessingError("The file contents do not match its PNG, JPEG or WebP type.");
    }
    const image = sharp(raw, { failOn: "error", limitInputPixels: 24_000_000 });
    let metadata: Awaited<ReturnType<typeof image.metadata>>;
    try {
      metadata = await image.metadata();
    } catch {
      throw new ImageProcessingError("That screenshot is corrupt or could not be decoded.");
    }
    if (!metadata.format || !ALLOWED_DECODED_FORMATS.has(metadata.format)) {
      throw new ImageProcessingError("The file contents must be a PNG, JPEG or WebP screenshot.");
    }
    if (metadata.format !== detectedSignature) {
      throw new ImageProcessingError("The screenshot has conflicting image format information.");
    }
    if ((metadata.pages ?? 1) !== 1) {
      throw new ImageProcessingError("Animated or multi-page screenshots are not supported.");
    }
    if (!metadata.width || !metadata.height || Math.min(metadata.width, metadata.height) < MIN_IMAGE_EDGE) {
      throw new ImageProcessingError("The screenshot is too small to read clearly.");
    }

    const sanitized = await image
      .rotate()
      .resize({ width: 1600, height: 2400, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 86 })
      .toBuffer();

    return { buffer: sanitized, mimeType: "image/webp" as const, width: metadata.width, height: metadata.height };
  } catch (error) {
    if (error instanceof ImageProcessingError) throw error;
    throw new ImageProcessingError("That screenshot is corrupt or could not be processed.");
  } finally {
    raw.fill(0);
  }
}
