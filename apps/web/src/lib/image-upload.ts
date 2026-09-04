export const MEBIBYTE_BYTES = 1024 * 1024;

/** What the product lets a user choose from their device. */
export const MAX_SELECTED_IMAGE_BYTES = 8 * MEBIBYTE_BYTES;

/**
 * Keep the complete multipart request below 4 MiB. Vercel Functions currently
 * impose a larger platform limit, but this lower ceiling leaves room for
 * boundaries, headers, context and future small form fields.
 */
export const MAX_ANALYZE_BODY_BYTES = 4 * MEBIBYTE_BYTES;
export const MULTIPART_RESERVE_BYTES = 256 * 1024;
export const MAX_PROCESSED_IMAGE_BYTES =
  MAX_ANALYZE_BODY_BYTES - MULTIPART_RESERVE_BYTES;

export const ALLOWED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

export type ImageFileLike = Pick<File, "size" | "type">;

export function validateSelectedImageFile(file: ImageFileLike) {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return "Choose a PNG, JPEG or WebP screenshot.";
  }
  if (file.size <= 0) return "The screenshot is empty or corrupt.";
  if (file.size > MAX_SELECTED_IMAGE_BYTES) {
    return "That screenshot is larger than 8 MB. Choose a smaller image.";
  }
  return null;
}

export function validateProcessedImageFile(file: ImageFileLike) {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return "Use a PNG, JPEG or WebP screenshot.";
  }
  if (file.size <= 0) return "The screenshot is empty or corrupt.";
  if (file.size > MAX_PROCESSED_IMAGE_BYTES) {
    return "The prepared screenshot is too large to upload safely.";
  }
  return null;
}

export function estimateAnalyzeMultipartBytes(imageBytes: number) {
  return imageBytes + MULTIPART_RESERVE_BYTES;
}

export type ImageDimensions = { width: number; height: number };

export function fitImageWithin(
  dimensions: ImageDimensions,
  bounds: ImageDimensions = { width: 1600, height: 2400 },
): ImageDimensions {
  if (
    !Number.isFinite(dimensions.width) ||
    !Number.isFinite(dimensions.height) ||
    dimensions.width <= 0 ||
    dimensions.height <= 0 ||
    !Number.isFinite(bounds.width) ||
    !Number.isFinite(bounds.height) ||
    bounds.width <= 0 ||
    bounds.height <= 0
  ) {
    throw new Error("Image dimensions are invalid.");
  }

  const scale = Math.min(
    1,
    bounds.width / dimensions.width,
    bounds.height / dimensions.height,
  );
  return {
    width: Math.max(1, Math.round(dimensions.width * scale)),
    height: Math.max(1, Math.round(dimensions.height * scale)),
  };
}

const COMPRESSION_QUALITIES = [0.88, 0.78, 0.68, 0.58, 0.48] as const;

export function compressionQualityForAttempt(attempt: number) {
  const safeAttempt = Number.isFinite(attempt) ? Math.max(0, Math.floor(attempt)) : 0;
  return COMPRESSION_QUALITIES[
    Math.min(safeAttempt, COMPRESSION_QUALITIES.length - 1)
  ];
}

export function nextCompressionDimensions(
  dimensions: ImageDimensions,
  encodedBytes: number,
  targetBytes = MAX_PROCESSED_IMAGE_BYTES,
): ImageDimensions {
  if (encodedBytes <= 0 || targetBytes <= 0) {
    throw new Error("Compression sizes are invalid.");
  }

  // Encoded size roughly follows pixel count. The safety factor avoids another
  // near-miss, while the clamp prevents an unexpectedly destructive resize.
  const estimatedScale = Math.sqrt(targetBytes / encodedBytes) * 0.92;
  const scale = Math.min(0.9, Math.max(0.68, estimatedScale));
  return {
    width: Math.max(1, Math.floor(dimensions.width * scale)),
    height: Math.max(1, Math.floor(dimensions.height * scale)),
  };
}
