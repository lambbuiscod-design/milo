import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { type BrowserWindow, screen } from "electron";
import { z } from "zod";
import {
  DEFAULT_COMPANION_SIZE,
  MIN_COMPANION_PEEK_PX,
  calculateCenteredPosition,
  clampWithEdgePeeking,
} from "../shared/companion-bounds";
import type { Size } from "../shared/position";

const MAX_POSITION_FILE_BYTES = 4096;
const DEFAULT_DEBOUNCE_MS = 300;

export const companionPositionSchema = z
  .object({
    x: z.number().int().finite().min(-100_000).max(100_000),
    y: z.number().int().finite().min(-100_000).max(100_000),
    monitorId: z.string().min(1).max(64),
    version: z.literal(1).default(1),
  })
  .strict();

export type CompanionPosition = z.infer<typeof companionPositionSchema>;

export class CompanionPositionManager {
  readonly #directory: string;
  readonly #filePath: string;
  readonly #debounceMs: number;
  readonly #windowSize: Size;

  #window: BrowserWindow | null = null;
  #saveTimer: NodeJS.Timeout | null = null;
  #pendingPosition: CompanionPosition | null = null;
  #currentPosition: CompanionPosition | null = null;

  constructor(options: { userDataDirectory: string; debounceMs?: number; windowSize?: Size }) {
    this.#directory = options.userDataDirectory;
    this.#filePath = path.join(this.#directory, "milo-companion-position.json");
    this.#debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
    this.#windowSize = options.windowSize ?? DEFAULT_COMPANION_SIZE;
  }

  attachWindow(window: BrowserWindow): void {
    this.#window = window;

    window.on("move", this.#onWindowMove);
    window.on("moved", this.#onWindowMoved);
    window.on("close", this.#onWindowClose);
    window.on("closed", this.#onWindowClosed);

    screen.on("display-removed", this.#onDisplayRemoved);
    screen.on("display-metrics-changed", this.#onDisplayMetricsChanged);
    screen.on("display-added", this.#onDisplayAdded);
  }

  dispose(): void {
    if (this.#window) {
      this.#window.removeListener("move", this.#onWindowMove);
      this.#window.removeListener("moved", this.#onWindowMoved);
      this.#window.removeListener("close", this.#onWindowClose);
      this.#window.removeListener("closed", this.#onWindowClosed);
      this.#window = null;
    }

    screen.removeListener("display-removed", this.#onDisplayRemoved);
    screen.removeListener("display-metrics-changed", this.#onDisplayMetricsChanged);
    screen.removeListener("display-added", this.#onDisplayAdded);

    this.flush();
  }

  loadInitialPosition(): CompanionPosition {
    const saved = this.#read();
    const allDisplays = screen.getAllDisplays();
    const primary = screen.getPrimaryDisplay();

    let targetDisplay = saved
      ? allDisplays.find((d) => String(d.id) === String(saved.monitorId))
      : null;

    if (!targetDisplay) {
      // Missing, corrupt, or disconnected monitor -> fallback to primary display center (R3)
      targetDisplay = primary;
      const centered = calculateCenteredPosition(this.#windowSize, primary.workArea);
      const fallbackPosition: CompanionPosition = {
        x: centered.x,
        y: centered.y,
        monitorId: String(primary.id),
        version: 1,
      };
      this.#currentPosition = fallbackPosition;
      this.#write(fallbackPosition);

      if (this.#window && !this.#window.isDestroyed()) {
        this.#window.setBounds({
          x: fallbackPosition.x,
          y: fallbackPosition.y,
          width: this.#windowSize.width,
          height: this.#windowSize.height,
        }, false);
      }
      return fallbackPosition;
    }

    // Monitor connected: Clamp saved position with 25px edge peeking (R4)
    const rawPoint = saved
      ? { x: saved.x, y: saved.y }
      : { x: targetDisplay.workArea.x, y: targetDisplay.workArea.y };
    const clamped = clampWithEdgePeeking(
      rawPoint,
      this.#windowSize,
      targetDisplay.workArea,
      MIN_COMPANION_PEEK_PX,
    );

    const validPosition: CompanionPosition = {
      x: clamped.x,
      y: clamped.y,
      monitorId: String(targetDisplay.id),
      version: 1,
    };
    this.#currentPosition = validPosition;

    if (this.#window && !this.#window.isDestroyed()) {
      this.#window.setBounds({
        x: validPosition.x,
        y: validPosition.y,
        width: this.#windowSize.width,
        height: this.#windowSize.height,
      }, false);
    }
    return validPosition;
  }

  flush(): void {
    if (this.#saveTimer) {
      clearTimeout(this.#saveTimer);
      this.#saveTimer = null;
    }
    if (this.#pendingPosition) {
      this.#write(this.#pendingPosition);
      this.#pendingPosition = null;
    }
  }

  readonly #onWindowMove = (): void => {
    if (!this.#window || this.#window.isDestroyed()) return;
    const bounds = this.#window.getBounds();
    const center = {
      x: bounds.x + Math.round(bounds.width / 2),
      y: bounds.y + Math.round(bounds.height / 2),
    };
    const display = screen.getDisplayNearestPoint(center);

    this.#pendingPosition = {
      x: bounds.x,
      y: bounds.y,
      monitorId: String(display.id),
      version: 1,
    };
    this.#currentPosition = this.#pendingPosition;

    if (this.#saveTimer) {
      clearTimeout(this.#saveTimer);
    }
    this.#saveTimer = setTimeout(() => {
      this.#saveTimer = null;
      if (this.#pendingPosition) {
        this.#write(this.#pendingPosition);
        this.#pendingPosition = null;
      }
    }, this.#debounceMs);
  };

  readonly #onWindowMoved = (): void => {
    this.flush();
  };

  readonly #onWindowClose = (): void => {
    this.flush();
  };

  readonly #onWindowClosed = (): void => {
    this.flush();
  };

  readonly #onDisplayRemoved = (_event: Electron.Event, oldDisplay?: Electron.Display): void => {
    if (this.#window && this.#window.isDestroyed()) return;

    const allDisplays = screen.getAllDisplays();
    const isCurrentConnected =
      this.#currentPosition !== null &&
      allDisplays.some((d) => String(d.id) === String(this.#currentPosition?.monitorId));
    const wasActiveRemoved =
      oldDisplay !== undefined &&
      this.#currentPosition !== null &&
      String(oldDisplay.id) === String(this.#currentPosition.monitorId);

    if (!isCurrentConnected || wasActiveRemoved) {
      const primary = screen.getPrimaryDisplay();
      const fallback = calculateCenteredPosition(this.#windowSize, primary.workArea);
      const position: CompanionPosition = {
        x: fallback.x,
        y: fallback.y,
        monitorId: String(primary.id),
        version: 1,
      };
      this.#currentPosition = position;
      this.#pendingPosition = position;

      if (this.#window && !this.#window.isDestroyed()) {
        this.#window.setBounds({
          x: position.x,
          y: position.y,
          width: this.#windowSize.width,
          height: this.#windowSize.height,
        }, false);
      }
      this.flush();
    }
  };

  readonly #onDisplayMetricsChanged = (): void => {
    if (this.#window && this.#window.isDestroyed()) return;

    const bounds = this.#window ? this.#window.getBounds() : (this.#currentPosition ?? { x: 0, y: 0 });
    const center = {
      x: bounds.x + Math.round(this.#windowSize.width / 2),
      y: bounds.y + Math.round(this.#windowSize.height / 2),
    };
    const display = screen.getDisplayNearestPoint(center);
    const clamped = clampWithEdgePeeking(
      bounds,
      this.#windowSize,
      display.workArea,
      MIN_COMPANION_PEEK_PX,
    );

    if (
      clamped.x !== bounds.x ||
      clamped.y !== bounds.y ||
      String(display.id) !== this.#currentPosition?.monitorId
    ) {
      const position: CompanionPosition = {
        x: clamped.x,
        y: clamped.y,
        monitorId: String(display.id),
        version: 1,
      };
      this.#currentPosition = position;
      this.#pendingPosition = position;

      if (this.#window && !this.#window.isDestroyed()) {
        this.#window.setBounds({
          x: position.x,
          y: position.y,
          width: this.#windowSize.width,
          height: this.#windowSize.height,
        }, false);
      }
      this.flush();
    }
  };

  readonly #onDisplayAdded = (): void => {
    this.#onDisplayMetricsChanged();
  };

  #read(): CompanionPosition | null {
    try {
      if (!existsSync(this.#filePath)) return null;
      if (statSync(this.#filePath).size > MAX_POSITION_FILE_BYTES) return null;
      const raw = readFileSync(this.#filePath, "utf8");
      const parsed = JSON.parse(raw);
      return companionPositionSchema.parse(parsed);
    } catch {
      return null;
    }
  }

  #write(position: CompanionPosition): void {
    const validated = companionPositionSchema.parse(position);
    const serialized = JSON.stringify(validated);
    const temporaryPath = `${this.#filePath}.tmp`;
    let descriptor: number | null = null;
    try {
      mkdirSync(this.#directory, { recursive: true });
      descriptor = openSync(temporaryPath, "w", 0o600);
      writeFileSync(descriptor, serialized, "utf8");
      fsyncSync(descriptor);
      closeSync(descriptor);
      descriptor = null;
      renameSync(temporaryPath, this.#filePath);
    } catch {
      if (descriptor !== null) {
        try {
          closeSync(descriptor);
        } catch {
          // ignore
        }
      }
      try {
        if (existsSync(temporaryPath)) {
          unlinkSync(temporaryPath);
        }
      } catch {
        // ignore
      }
    }
  }
}
