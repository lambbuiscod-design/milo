import { desktopCapturer, type DesktopCapturerSource, type SourcesOptions } from "electron";
import {
  detectChatAppType,
  normalizeWindowTitle,
  type ChatAppType,
} from "./window-selection";

export type { ChatAppType } from "./window-selection";

export type CapturedWindowFrame = Readonly<{
  sourceId: string;
  title: string;
  appType: ChatAppType;
  imageBuffer: Buffer; // Lossless PNG
  width: number;
  height: number;
  timestamp: number;
}>;

export interface DesktopCapturerApi {
  getSources(options: SourcesOptions): Promise<DesktopCapturerSource[]>;
}

export class WindowCaptureError extends Error {
  constructor(
    readonly code: "WINDOW_NOT_FOUND" | "WINDOW_MINIMIZED" | "CAPTURE_FAILED",
    message: string,
  ) {
    super(message);
    this.name = "WindowCaptureError";
  }
}

export type WindowCaptureOptions = Readonly<{
  width?: number;
  height?: number;
}>;

const DEFAULT_CAPTURE_WIDTH = 1920;
const DEFAULT_CAPTURE_HEIGHT = 1080;

export class WindowCaptureService {
  private readonly capturer: DesktopCapturerApi;

  constructor(capturer?: DesktopCapturerApi) {
    if (capturer) {
      this.capturer = capturer;
    } else if (typeof desktopCapturer !== "undefined" && desktopCapturer !== null) {
      this.capturer = desktopCapturer;
    } else {
      this.capturer = {
        getSources: async () => {
          throw new WindowCaptureError(
            "CAPTURE_FAILED",
            "desktopCapturer is not available in the current environment.",
          );
        },
      };
    }
  }

  async captureWindow(
    sourceId: string,
    options?: WindowCaptureOptions,
  ): Promise<CapturedWindowFrame> {
    if (!sourceId || typeof sourceId !== "string") {
      throw new WindowCaptureError("WINDOW_NOT_FOUND", "A valid window sourceId is required.");
    }

    const width =
      typeof options?.width === "number" && options.width > 0
        ? options.width
        : DEFAULT_CAPTURE_WIDTH;
    const height =
      typeof options?.height === "number" && options.height > 0
        ? options.height
        : DEFAULT_CAPTURE_HEIGHT;

    let sources: DesktopCapturerSource[];
    try {
      sources = await this.capturer.getSources({
        types: ["window"],
        thumbnailSize: { width, height },
        fetchWindowIcons: false,
      });
    } catch (error) {
      if (error instanceof WindowCaptureError) throw error;
      throw new WindowCaptureError(
        "CAPTURE_FAILED",
        `Failed to enumerate sources for capture: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const targetSource = sources.find((source) => source.id === sourceId);
    if (!targetSource) {
      throw new WindowCaptureError(
        "WINDOW_NOT_FOUND",
        `Window with sourceId '${sourceId}' was not found in enumerated sources.`,
      );
    }

    const thumbnail = targetSource.thumbnail;
    if (!thumbnail) {
      throw new WindowCaptureError(
        "WINDOW_MINIMIZED",
        `Window '${targetSource.name}' has no thumbnail available.`,
      );
    }

    try {
      if (typeof thumbnail.isEmpty === "function" && thumbnail.isEmpty()) {
        throw new WindowCaptureError(
          "WINDOW_MINIMIZED",
          `Window '${targetSource.name}' is minimized or has an empty thumbnail.`,
        );
      }
    } catch (error) {
      if (error instanceof WindowCaptureError) {
        throw error;
      }
      throw new WindowCaptureError(
        "CAPTURE_FAILED",
        `Failed to inspect thumbnail state for window '${targetSource.name}': ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    let size = { width: 0, height: 0 };
    try {
      size =
        typeof thumbnail.getSize === "function"
          ? thumbnail.getSize()
          : { width: 0, height: 0 };
    } catch (error) {
      throw new WindowCaptureError(
        "CAPTURE_FAILED",
        `Failed to get thumbnail size for window '${targetSource.name}': ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (size.width <= 0 || size.height <= 0) {
      throw new WindowCaptureError(
        "WINDOW_MINIMIZED",
        `Window '${targetSource.name}' has zero dimensions (${size.width}x${size.height}) and cannot be captured.`,
      );
    }

    let imageBuffer: Buffer;
    try {
      imageBuffer = thumbnail.toPNG();
    } catch (error) {
      throw new WindowCaptureError(
        "CAPTURE_FAILED",
        `Failed to convert thumbnail to PNG for window '${targetSource.name}': ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (!imageBuffer || imageBuffer.length === 0) {
      throw new WindowCaptureError(
        "WINDOW_MINIMIZED",
        `Window '${targetSource.name}' produced an empty image buffer.`,
      );
    }

    const appType = detectChatAppType(targetSource.name);
    const title = normalizeWindowTitle(targetSource.name) || targetSource.name;

    return {
      sourceId: targetSource.id,
      title,
      appType,
      imageBuffer,
      width: size.width,
      height: size.height,
      timestamp: Date.now(),
    };
  }
}
