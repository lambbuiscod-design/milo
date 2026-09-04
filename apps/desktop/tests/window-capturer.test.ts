import type { DesktopCapturerSource, NativeImage, SourcesOptions } from "electron";
import { describe, expect, it, vi } from "vitest";
import {
  WindowCaptureError,
  WindowCaptureService,
  type DesktopCapturerApi,
} from "../src/main/window-capturer";

function createMockNativeImage(options: {
  width?: number;
  height?: number;
  isEmpty?: boolean;
  pngBuffer?: Buffer;
  toPNGThrows?: boolean;
}): NativeImage {
  const {
    width = 1920,
    height = 1080,
    isEmpty = false,
    pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00]),
    toPNGThrows = false,
  } = options;

  return {
    isEmpty: () => isEmpty,
    getSize: () => ({ width, height }),
    toPNG: () => {
      if (toPNGThrows) {
        throw new Error("GDI capture internal error");
      }
      return pngBuffer;
    },
    toJPEG: () => Buffer.alloc(0),
    toBitmap: () => Buffer.alloc(0),
    getBitmap: () => Buffer.alloc(0),
    getNativeHandle: () => Buffer.alloc(0),
    crop: () => ({} as unknown as NativeImage),
    resize: () => ({} as unknown as NativeImage),
    getAspectRatio: () => (height === 0 ? 0 : width / height),
    addRepresentation: () => {},
  } as unknown as NativeImage;
}

function createMockCapturer(
  sources: DesktopCapturerSource[],
  spyFn?: (options: SourcesOptions) => void,
): DesktopCapturerApi {
  return {
    getSources: async (options: SourcesOptions) => {
      if (spyFn) spyFn(options);
      return sources;
    },
  };
}

describe("WindowCaptureService", () => {
  it("captures target window frame and returns lossless PNG buffer with correct metadata", async () => {
    const pngData = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01, 0x02, 0x03]);
    const mockImage = createMockNativeImage({ width: 1920, height: 1080, pngBuffer: pngData });

    const capturer = createMockCapturer([
      {
        id: "window:101:0",
        name: "(2) WhatsApp - Google Chrome",
        thumbnail: mockImage,
        appIcon: null as unknown as NativeImage,
        display_id: "",
      },
      {
        id: "window:102:0",
        name: "Visual Studio Code",
        thumbnail: createMockNativeImage({ width: 1920, height: 1080 }),
        appIcon: null as unknown as NativeImage,
        display_id: "",
      },
    ]);

    const service = new WindowCaptureService(capturer);
    const frame = await service.captureWindow("window:101:0");

    expect(frame.sourceId).toBe("window:101:0");
    expect(frame.title).toBe("(2) WhatsApp - Google Chrome");
    expect(frame.appType).toBe("whatsapp");
    expect(frame.width).toBe(1920);
    expect(frame.height).toBe(1080);
    expect(frame.imageBuffer).toEqual(pngData);
    expect(typeof frame.timestamp).toBe("number");
    expect(frame.timestamp).toBeGreaterThan(0);
  });

  it("identifies Discord, Telegram, Slack, and other chat app types accurately during capture", async () => {
    const sources: DesktopCapturerSource[] = [
      {
        id: "window:201:0",
        name: "Discord | #general | Milo Server",
        thumbnail: createMockNativeImage({ width: 1280, height: 720 }),
        appIcon: null as unknown as NativeImage,
        display_id: "",
      },
      {
        id: "window:202:0",
        name: "(5) Telegram Web",
        thumbnail: createMockNativeImage({ width: 1280, height: 720 }),
        appIcon: null as unknown as NativeImage,
        display_id: "",
      },
      {
        id: "window:203:0",
        name: "Slack - Engineering Standup",
        thumbnail: createMockNativeImage({ width: 1280, height: 720 }),
        appIcon: null as unknown as NativeImage,
        display_id: "",
      },
      {
        id: "window:204:0",
        name: "Calculator",
        thumbnail: createMockNativeImage({ width: 1280, height: 720 }),
        appIcon: null as unknown as NativeImage,
        display_id: "",
      },
    ];

    const service = new WindowCaptureService(createMockCapturer(sources));

    const discordFrame = await service.captureWindow("window:201:0");
    expect(discordFrame.appType).toBe("discord");

    const telegramFrame = await service.captureWindow("window:202:0");
    expect(telegramFrame.appType).toBe("telegram");

    const slackFrame = await service.captureWindow("window:203:0");
    expect(slackFrame.appType).toBe("slack");

    const otherFrame = await service.captureWindow("window:204:0");
    expect(otherFrame.appType).toBe("other");
  });

  it("passes default (1920x1080) and custom dimensions to desktopCapturer.getSources", async () => {
    let capturedOptions: SourcesOptions | undefined;
    const capturer = createMockCapturer(
      [
        {
          id: "window:101:0",
          name: "WhatsApp",
          thumbnail: createMockNativeImage({ width: 2560, height: 1440 }),
          appIcon: null as unknown as NativeImage,
          display_id: "",
        },
      ],
      (options) => {
        capturedOptions = options;
      },
    );

    const service = new WindowCaptureService(capturer);

    // Default dimensions
    await service.captureWindow("window:101:0");
    expect(capturedOptions).toEqual({
      types: ["window"],
      thumbnailSize: { width: 1920, height: 1080 },
      fetchWindowIcons: false,
    });

    // Custom dimensions
    await service.captureWindow("window:101:0", { width: 2560, height: 1440 });
    expect(capturedOptions).toEqual({
      types: ["window"],
      thumbnailSize: { width: 2560, height: 1440 },
      fetchWindowIcons: false,
    });
  });

  describe("error handling and edge cases", () => {
    it("throws WINDOW_NOT_FOUND when sourceId does not exist in enumerated sources", async () => {
      const capturer = createMockCapturer([
        {
          id: "window:101:0",
          name: "WhatsApp",
          thumbnail: createMockNativeImage({ width: 1920, height: 1080 }),
          appIcon: null as unknown as NativeImage,
          display_id: "",
        },
      ]);

      const service = new WindowCaptureService(capturer);

      await expect(service.captureWindow("window:999:0")).rejects.toThrowError(WindowCaptureError);
      try {
        await service.captureWindow("window:999:0");
      } catch (error) {
        expect(error).toBeInstanceOf(WindowCaptureError);
        expect((error as WindowCaptureError).code).toBe("WINDOW_NOT_FOUND");
      }
    });

    it("throws WINDOW_NOT_FOUND for invalid or empty sourceId input", async () => {
      const capturer = createMockCapturer([]);
      const service = new WindowCaptureService(capturer);

      await expect(service.captureWindow("")).rejects.toThrowError(WindowCaptureError);
      await expect(service.captureWindow(null as unknown as string)).rejects.toThrowError(
        WindowCaptureError,
      );
    });

    it("throws WINDOW_MINIMIZED when thumbnail is empty (isEmpty === true)", async () => {
      const capturer = createMockCapturer([
        {
          id: "window:101:0",
          name: "WhatsApp (Minimized)",
          thumbnail: createMockNativeImage({ isEmpty: true }),
          appIcon: null as unknown as NativeImage,
          display_id: "",
        },
      ]);

      const service = new WindowCaptureService(capturer);

      try {
        await service.captureWindow("window:101:0");
        expect.unreachable("Should have thrown WindowCaptureError");
      } catch (error) {
        expect(error).toBeInstanceOf(WindowCaptureError);
        expect((error as WindowCaptureError).code).toBe("WINDOW_MINIMIZED");
      }
    });

    it("throws WINDOW_MINIMIZED when thumbnail has zero dimensions", async () => {
      const capturer = createMockCapturer([
        {
          id: "window:101:0",
          name: "WhatsApp (Zero Size)",
          thumbnail: createMockNativeImage({ width: 0, height: 0 }),
          appIcon: null as unknown as NativeImage,
          display_id: "",
        },
      ]);

      const service = new WindowCaptureService(capturer);

      try {
        await service.captureWindow("window:101:0");
        expect.unreachable("Should have thrown WindowCaptureError");
      } catch (error) {
        expect(error).toBeInstanceOf(WindowCaptureError);
        expect((error as WindowCaptureError).code).toBe("WINDOW_MINIMIZED");
      }
    });

    it("throws WINDOW_MINIMIZED when thumbnail produces empty PNG buffer", async () => {
      const capturer = createMockCapturer([
        {
          id: "window:101:0",
          name: "WhatsApp",
          thumbnail: createMockNativeImage({ pngBuffer: Buffer.alloc(0) }),
          appIcon: null as unknown as NativeImage,
          display_id: "",
        },
      ]);

      const service = new WindowCaptureService(capturer);

      try {
        await service.captureWindow("window:101:0");
        expect.unreachable("Should have thrown WindowCaptureError");
      } catch (error) {
        expect(error).toBeInstanceOf(WindowCaptureError);
        expect((error as WindowCaptureError).code).toBe("WINDOW_MINIMIZED");
      }
    });

    it("throws WINDOW_MINIMIZED when thumbnail object is missing", async () => {
      const capturer = createMockCapturer([
        {
          id: "window:101:0",
          name: "WhatsApp",
          thumbnail: null as unknown as NativeImage,
          appIcon: null as unknown as NativeImage,
          display_id: "",
        },
      ]);

      const service = new WindowCaptureService(capturer);

      try {
        await service.captureWindow("window:101:0");
        expect.unreachable("Should have thrown WindowCaptureError");
      } catch (error) {
        expect(error).toBeInstanceOf(WindowCaptureError);
        expect((error as WindowCaptureError).code).toBe("WINDOW_MINIMIZED");
      }
    });

    it("throws CAPTURE_FAILED when desktopCapturer.getSources rejects", async () => {
      const failingCapturer: DesktopCapturerApi = {
        getSources: vi.fn().mockRejectedValue(new Error("DWM capture access denied")),
      };

      const service = new WindowCaptureService(failingCapturer);

      try {
        await service.captureWindow("window:101:0");
        expect.unreachable("Should have thrown WindowCaptureError");
      } catch (error) {
        expect(error).toBeInstanceOf(WindowCaptureError);
        expect((error as WindowCaptureError).code).toBe("CAPTURE_FAILED");
        expect((error as WindowCaptureError).message).toContain("DWM capture access denied");
      }
    });

    it("throws CAPTURE_FAILED when thumbnail.toPNG throws unexpectedly", async () => {
      const capturer = createMockCapturer([
        {
          id: "window:101:0",
          name: "WhatsApp",
          thumbnail: createMockNativeImage({ toPNGThrows: true }),
          appIcon: null as unknown as NativeImage,
          display_id: "",
        },
      ]);

      const service = new WindowCaptureService(capturer);

      try {
        await service.captureWindow("window:101:0");
        expect.unreachable("Should have thrown WindowCaptureError");
      } catch (error) {
        expect(error).toBeInstanceOf(WindowCaptureError);
        expect((error as WindowCaptureError).code).toBe("CAPTURE_FAILED");
        expect((error as WindowCaptureError).message).toContain("GDI capture internal error");
      }
    });

    it("falls back gracefully when default constructor is called outside electron runtime", async () => {
      const service = new WindowCaptureService();
      try {
        await service.captureWindow("window:101:0");
        expect.unreachable("Should have thrown WindowCaptureError");
      } catch (error) {
        expect(error).toBeInstanceOf(WindowCaptureError);
        expect((error as WindowCaptureError).code).toBe("CAPTURE_FAILED");
      }
    });
  });

  describe("adversarial stress tests and boundary challenges", () => {
    describe("zero and negative dimensions", () => {
      it("falls back to default dimensions when options width or height is negative, zero, or NaN", async () => {
        let requestedOptions: SourcesOptions | undefined;
        const capturer = createMockCapturer(
          [
            {
              id: "window:101:0",
              name: "WhatsApp",
              thumbnail: createMockNativeImage({ width: 1920, height: 1080 }),
              appIcon: null as unknown as NativeImage,
              display_id: "",
            },
          ],
          (opts) => {
            requestedOptions = opts;
          },
        );

        const service = new WindowCaptureService(capturer);

        // Negative dimensions
        await service.captureWindow("window:101:0", { width: -100, height: -200 });
        expect(requestedOptions?.thumbnailSize).toEqual({ width: 1920, height: 1080 });

        // Zero dimensions
        await service.captureWindow("window:101:0", { width: 0, height: 0 });
        expect(requestedOptions?.thumbnailSize).toEqual({ width: 1920, height: 1080 });

        // NaN dimensions
        await service.captureWindow("window:101:0", { width: Number.NaN, height: Number.NaN });
        expect(requestedOptions?.thumbnailSize).toEqual({ width: 1920, height: 1080 });
      });

      it("handles single-dimension zero (zero width with non-zero height, or vice versa)", async () => {
        const capturerZeroWidth = createMockCapturer([
          {
            id: "window:101:0",
            name: "WhatsApp",
            thumbnail: createMockNativeImage({ width: 0, height: 1080 }),
            appIcon: null as unknown as NativeImage,
            display_id: "",
          },
        ]);
        const serviceZeroWidth = new WindowCaptureService(capturerZeroWidth);
        await expect(serviceZeroWidth.captureWindow("window:101:0")).rejects.toMatchObject({
          name: "WindowCaptureError",
          code: "WINDOW_MINIMIZED",
        });

        const capturerZeroHeight = createMockCapturer([
          {
            id: "window:101:0",
            name: "WhatsApp",
            thumbnail: createMockNativeImage({ width: 1920, height: 0 }),
            appIcon: null as unknown as NativeImage,
            display_id: "",
          },
        ]);
        const serviceZeroHeight = new WindowCaptureService(capturerZeroHeight);
        await expect(serviceZeroHeight.captureWindow("window:101:0")).rejects.toMatchObject({
          name: "WindowCaptureError",
          code: "WINDOW_MINIMIZED",
        });
      });

      it("rejects negative thumbnail dimensions with WINDOW_MINIMIZED", async () => {
        const capturer = createMockCapturer([
          {
            id: "window:101:0",
            name: "WhatsApp",
            thumbnail: createMockNativeImage({ width: -1, height: -1 }),
            appIcon: null as unknown as NativeImage,
            display_id: "",
          },
        ]);
        const service = new WindowCaptureService(capturer);
        await expect(service.captureWindow("window:101:0")).rejects.toMatchObject({
          name: "WindowCaptureError",
          code: "WINDOW_MINIMIZED",
        });
      });
    });

    describe("missing and invalid sourceId", () => {
      it("rejects whitespace-only sourceId with WINDOW_NOT_FOUND", async () => {
        const capturer = createMockCapturer([
          {
            id: "window:101:0",
            name: "WhatsApp",
            thumbnail: createMockNativeImage({ width: 1920, height: 1080 }),
            appIcon: null as unknown as NativeImage,
            display_id: "",
          },
        ]);
        const service = new WindowCaptureService(capturer);
        await expect(service.captureWindow("   ")).rejects.toMatchObject({
          name: "WindowCaptureError",
          code: "WINDOW_NOT_FOUND",
        });
      });

      it("rejects non-string or undefined sourceId values", async () => {
        const capturer = createMockCapturer([]);
        const service = new WindowCaptureService(capturer);

        await expect(service.captureWindow(undefined as unknown as string)).rejects.toMatchObject({
          name: "WindowCaptureError",
          code: "WINDOW_NOT_FOUND",
        });
        await expect(service.captureWindow(12345 as unknown as string)).rejects.toMatchObject({
          name: "WindowCaptureError",
          code: "WINDOW_NOT_FOUND",
        });
        await expect(service.captureWindow({} as unknown as string)).rejects.toMatchObject({
          name: "WindowCaptureError",
          code: "WINDOW_NOT_FOUND",
        });
      });
    });

    describe("NativeImage unexpected exceptions", () => {
      it("exposes unhandled exception if thumbnail.isEmpty throws", async () => {
        const capturer = createMockCapturer([
          {
            id: "window:101:0",
            name: "WhatsApp",
            thumbnail: {
              ...createMockNativeImage({}),
              isEmpty: () => {
                throw new Error("Object has been destroyed");
              },
            } as unknown as NativeImage,
            appIcon: null as unknown as NativeImage,
            display_id: "",
          },
        ]);
        const service = new WindowCaptureService(capturer);
        // Finding: Because isEmpty() is not wrapped in try/catch, it throws raw Error rather than WindowCaptureError
        await expect(service.captureWindow("window:101:0")).rejects.toThrow("Object has been destroyed");
      });

      it("exposes unhandled exception if thumbnail.getSize throws", async () => {
        const capturer = createMockCapturer([
          {
            id: "window:101:0",
            name: "WhatsApp",
            thumbnail: {
              ...createMockNativeImage({}),
              isEmpty: () => false,
              getSize: () => {
                throw new Error("Native handle is invalid");
              },
            } as unknown as NativeImage,
            appIcon: null as unknown as NativeImage,
            display_id: "",
          },
        ]);
        const service = new WindowCaptureService(capturer);
        // Finding: Because getSize() is not wrapped in try/catch, it throws raw Error rather than WindowCaptureError
        await expect(service.captureWindow("window:101:0")).rejects.toThrow("Native handle is invalid");
      });

      it("handles non-Error objects thrown by thumbnail.toPNG", async () => {
        const capturer = createMockCapturer([
          {
            id: "window:101:0",
            name: "WhatsApp",
            thumbnail: {
              ...createMockNativeImage({}),
              toPNG: () => {
                throw "Raw string failure in GDI";
              },
            } as unknown as NativeImage,
            appIcon: null as unknown as NativeImage,
            display_id: "",
          },
        ]);
        const service = new WindowCaptureService(capturer);
        await expect(service.captureWindow("window:101:0")).rejects.toMatchObject({
          name: "WindowCaptureError",
          code: "CAPTURE_FAILED",
          message: expect.stringContaining("Raw string failure in GDI"),
        });
      });
    });

    describe("rapid consecutive capture calls", () => {
      it("executes 50 rapid sequential capture calls with full determinism and monotonic timestamps", async () => {
        const capturer = createMockCapturer([
          {
            id: "window:101:0",
            name: "WhatsApp",
            thumbnail: createMockNativeImage({ width: 1920, height: 1080 }),
            appIcon: null as unknown as NativeImage,
            display_id: "",
          },
        ]);
        const service = new WindowCaptureService(capturer);

        let previousTimestamp = 0;
        for (let i = 0; i < 50; i++) {
          const frame = await service.captureWindow("window:101:0");
          expect(frame.sourceId).toBe("window:101:0");
          expect(frame.width).toBe(1920);
          expect(frame.height).toBe(1080);
          expect(frame.timestamp).toBeGreaterThanOrEqual(previousTimestamp);
          previousTimestamp = frame.timestamp;
        }
      });

      it("executes 20 rapid concurrent capture calls in parallel without race conditions", async () => {
        let callCount = 0;
        const capturer = createMockCapturer(
          [
            {
              id: "window:101:0",
              name: "Discord",
              thumbnail: createMockNativeImage({ width: 1280, height: 720 }),
              appIcon: null as unknown as NativeImage,
              display_id: "",
            },
          ],
          () => {
            callCount++;
          },
        );
        const service = new WindowCaptureService(capturer);

        const promises = Array.from({ length: 20 }, () => service.captureWindow("window:101:0"));
        const results = await Promise.all(promises);

        expect(results).toHaveLength(20);
        expect(callCount).toBe(20);
        for (const frame of results) {
          expect(frame.sourceId).toBe("window:101:0");
          expect(frame.appType).toBe("discord");
          expect(frame.width).toBe(1280);
          expect(frame.height).toBe(720);
        }
      });

      it("handles mixed concurrent requests where some succeed and some fail independently", async () => {
        const capturer = createMockCapturer([
          {
            id: "window:101:0",
            name: "WhatsApp",
            thumbnail: createMockNativeImage({ width: 1920, height: 1080 }),
            appIcon: null as unknown as NativeImage,
            display_id: "",
          },
          {
            id: "window:102:0",
            name: "MinimizedApp",
            thumbnail: createMockNativeImage({ isEmpty: true }),
            appIcon: null as unknown as NativeImage,
            display_id: "",
          },
        ]);
        const service = new WindowCaptureService(capturer);

        const results = await Promise.allSettled([
          service.captureWindow("window:101:0"),
          service.captureWindow("window:999:0"), // Not found
          service.captureWindow("window:102:0"), // Minimized
          service.captureWindow("window:101:0"), // Valid concurrent
        ]);

        expect(results[0]?.status).toBe("fulfilled");
        expect(results[1]?.status).toBe("rejected");
        expect((results[1] as PromiseRejectedResult).reason).toMatchObject({
          name: "WindowCaptureError",
          code: "WINDOW_NOT_FOUND",
        });
        expect(results[2]?.status).toBe("rejected");
        expect((results[2] as PromiseRejectedResult).reason).toMatchObject({
          name: "WindowCaptureError",
          code: "WINDOW_MINIMIZED",
        });
        expect(results[3]?.status).toBe("fulfilled");
      });
    });
  });
});

