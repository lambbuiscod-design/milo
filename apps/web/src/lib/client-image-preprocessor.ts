import {
  MAX_PROCESSED_IMAGE_BYTES,
  compressionQualityForAttempt,
  fitImageWithin,
  nextCompressionDimensions,
  validateProcessedImageFile,
  validateSelectedImageFile,
  type ImageDimensions,
} from "@/lib/image-upload";

const MAX_RESIZE_ROUNDS = 4;
const QUALITY_ATTEMPTS_PER_ROUND = 5;

type DecodedImage = {
  source: CanvasImageSource;
  dimensions: ImageDimensions;
  release: () => void;
};

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: "image/webp" | "image/jpeg",
  quality: number,
) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob || blob.size <= 0) {
        reject(new Error("This browser could not compress the screenshot."));
        return;
      }
      resolve(blob);
    }, type, quality);
  });
}

async function decodeWithImageElement(file: File): Promise<DecodedImage> {
  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = "async";
  image.src = objectUrl;

  try {
    await image.decode();
  } catch {
    URL.revokeObjectURL(objectUrl);
    image.src = "";
    throw new Error("That screenshot could not be opened. Try exporting it again.");
  }

  if (!image.naturalWidth || !image.naturalHeight) {
    URL.revokeObjectURL(objectUrl);
    image.src = "";
    throw new Error("That screenshot is empty or corrupt.");
  }

  return {
    source: image,
    dimensions: { width: image.naturalWidth, height: image.naturalHeight },
    release: () => {
      image.src = "";
      URL.revokeObjectURL(objectUrl);
    },
  };
}

async function decodeForResize(file: File): Promise<DecodedImage> {
  // createImageBitmap can decode away from the main thread in modern browsers.
  // The HTMLImageElement path keeps iOS/browser compatibility.
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      if (!bitmap.width || !bitmap.height) {
        bitmap.close();
        throw new Error("Invalid bitmap dimensions.");
      }
      return {
        source: bitmap,
        dimensions: { width: bitmap.width, height: bitmap.height },
        release: () => bitmap.close(),
      };
    } catch {
      // Fall back for browsers/codecs whose createImageBitmap support is partial.
    }
  }

  return decodeWithImageElement(file);
}

function drawImage(
  source: CanvasImageSource,
  dimensions: ImageDimensions,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) {
    canvas.width = 0;
    canvas.height = 0;
    throw new Error("This browser cannot prepare screenshots for upload.");
  }
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, dimensions.width, dimensions.height);
  context.drawImage(source, 0, 0, dimensions.width, dimensions.height);
  return canvas;
}

function releaseCanvas(canvas: HTMLCanvasElement | null) {
  if (!canvas) return;
  canvas.width = 0;
  canvas.height = 0;
}

function processedFileName(mimeType: string) {
  return `milo-screenshot.${mimeType === "image/webp" ? "webp" : "jpg"}`;
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Image preparation was cancelled.", "AbortError");
}

export async function prepareImageForUpload(
  file: File,
  options: { signal?: AbortSignal } = {},
): Promise<File> {
  throwIfAborted(options.signal);
  const selectionError = validateSelectedImageFile(file);
  if (selectionError) throw new Error(selectionError);
  if (!validateProcessedImageFile(file)) return file;

  const decoded = await decodeForResize(file);
  let canvas: HTMLCanvasElement | null = null;
  try {
    throwIfAborted(options.signal);
    let dimensions = fitImageWithin(decoded.dimensions);
    let smallestOversizedBytes = file.size;

    for (let round = 0; round < MAX_RESIZE_ROUNDS; round += 1) {
      throwIfAborted(options.signal);
      releaseCanvas(canvas);
      canvas = drawImage(decoded.source, dimensions);

      for (let attempt = 0; attempt < QUALITY_ATTEMPTS_PER_ROUND; attempt += 1) {
        throwIfAborted(options.signal);
        const quality = compressionQualityForAttempt(attempt);
        let encoded = await canvasToBlob(canvas, "image/webp", quality);
        throwIfAborted(options.signal);
        if (encoded.type !== "image/webp" || encoded.size > MAX_PROCESSED_IMAGE_BYTES) {
          const jpeg = await canvasToBlob(canvas, "image/jpeg", quality);
          if (encoded.type !== "image/webp" || jpeg.size < encoded.size) {
            encoded = jpeg;
          }
        }
        smallestOversizedBytes = Math.min(smallestOversizedBytes, encoded.size);

        if (encoded.size <= MAX_PROCESSED_IMAGE_BYTES) {
          const prepared = new File(
            [encoded],
            processedFileName(encoded.type),
            { type: encoded.type, lastModified: file.lastModified },
          );
          const preparedError = validateProcessedImageFile(prepared);
          if (preparedError) throw new Error(preparedError);
          return prepared;
        }
      }

      dimensions = nextCompressionDimensions(
        dimensions,
        smallestOversizedBytes,
      );
    }

    throw new Error(
      "Milo could not make this screenshot small enough without hurting readability. Crop it slightly and try again.",
    );
  } finally {
    releaseCanvas(canvas);
    decoded.release();
  }
}
