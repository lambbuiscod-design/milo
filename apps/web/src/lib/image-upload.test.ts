import { describe, expect, it } from "vitest";
import {
  MAX_ANALYZE_BODY_BYTES,
  MAX_PROCESSED_IMAGE_BYTES,
  MAX_SELECTED_IMAGE_BYTES,
  MULTIPART_RESERVE_BYTES,
  compressionQualityForAttempt,
  estimateAnalyzeMultipartBytes,
  fitImageWithin,
  nextCompressionDimensions,
  validateProcessedImageFile,
  validateSelectedImageFile,
} from "@/lib/image-upload";

describe("browser image upload limits", () => {
  it("accepts an 8 MiB selection while reserving multipart space below 4 MiB", () => {
    expect(validateSelectedImageFile({ size: MAX_SELECTED_IMAGE_BYTES, type: "image/png" })).toBeNull();
    expect(validateSelectedImageFile({ size: MAX_SELECTED_IMAGE_BYTES + 1, type: "image/png" })).toMatch(/8 MB/);
    expect(MAX_PROCESSED_IMAGE_BYTES).toBe(MAX_ANALYZE_BODY_BYTES - MULTIPART_RESERVE_BYTES);
    expect(estimateAnalyzeMultipartBytes(MAX_PROCESSED_IMAGE_BYTES)).toBe(MAX_ANALYZE_BODY_BYTES);
  });

  it("does not accept an unprocessed large selection at the server boundary", () => {
    expect(validateProcessedImageFile({ size: MAX_PROCESSED_IMAGE_BYTES, type: "image/webp" })).toBeNull();
    expect(validateProcessedImageFile({ size: MAX_PROCESSED_IMAGE_BYTES + 1, type: "image/webp" })).toMatch(/prepared screenshot/i);
  });

  it("fits wide and tall screenshots without changing their aspect ratio", () => {
    expect(fitImageWithin({ width: 4000, height: 2000 })).toEqual({ width: 1600, height: 800 });
    expect(fitImageWithin({ width: 1000, height: 4000 })).toEqual({ width: 600, height: 2400 });
    expect(fitImageWithin({ width: 900, height: 1800 })).toEqual({ width: 900, height: 1800 });
  });

  it("uses bounded quality steps and proportional resize steps", () => {
    expect(compressionQualityForAttempt(0)).toBe(0.88);
    expect(compressionQualityForAttempt(3)).toBe(0.58);
    expect(compressionQualityForAttempt(99)).toBe(0.48);
    const resized = nextCompressionDimensions(
      { width: 1600, height: 2400 },
      MAX_PROCESSED_IMAGE_BYTES * 4,
    );
    expect(resized).toEqual({ width: 1088, height: 1632 });
    expect(resized.width / resized.height).toBeCloseTo(2 / 3, 5);
  });
});
