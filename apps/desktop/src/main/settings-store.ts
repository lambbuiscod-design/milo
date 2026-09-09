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
import { z } from "zod";
import type { Point } from "../shared/position";
import type { PublicSettings, PublicSettingsPatch } from "../shared/contracts";

const MAX_SETTINGS_BYTES = 32_768;
const positionSchema = z
  .object({
    x: z.number().int().finite().min(-100_000).max(100_000),
    y: z.number().int().finite().min(-100_000).max(100_000),
  })
  .strict();
const positionsSchema = z
  .record(z.string().regex(/^-?\d{1,20}$/), positionSchema)
  .refine((positions) => Object.keys(positions).length <= 16);
const persistedSettingsSchema = z
  .object({
    version: z.literal(1),
    theme: z.enum(["system", "light", "dark"]),
    motion: z.enum(["system", "full", "reduced"]),
    showWatchingIndicator: z.boolean(),
    soundEnabled: z.boolean().default(true),
    soundVolume: z.number().min(0).max(1).default(0.7),
    noticeSoundEnabled: z.boolean().default(false),
    activeTone: z.enum(["standard", "romantic", "witty", "professional"]).default("standard"),
    opacity: z.number().min(0.75).max(1).default(1.0),
    isPinned: z.boolean().default(true),
    dockMode: z.enum(["free", "top-left", "top-right", "bottom-left", "bottom-right", "follow-window"]).default("follow-window"),
    catAppearance: z.enum(["charcoal", "slate", "mauve", "caramel"]).default("charcoal"),
    paused: z.boolean(),
    overlayPositions: positionsSchema,
  })
  .strict();

type PersistedSettings = z.infer<typeof persistedSettingsSchema>;

const DEFAULT_SETTINGS: PersistedSettings = Object.freeze({
  version: 1,
  theme: "system",
  motion: "system",
  showWatchingIndicator: true,
  soundEnabled: true,
  soundVolume: 0.7,
  noticeSoundEnabled: false,
  activeTone: "standard",
  opacity: 1.0,
  isPinned: true,
  dockMode: "follow-window",
  catAppearance: "charcoal",
  paused: false,
  overlayPositions: Object.freeze({}),
});

export class ContentFreeSettingsStore {
  readonly #directory: string;
  readonly #filePath: string;
  #settings: PersistedSettings;

  constructor(userDataDirectory: string) {
    this.#directory = userDataDirectory;
    this.#filePath = path.join(userDataDirectory, "milo-settings.json");
    this.#settings = this.#read();
  }

  getPublicSettings(): PublicSettings {
    return {
      theme: this.#settings.theme,
      motion: this.#settings.motion,
      showWatchingIndicator: this.#settings.showWatchingIndicator,
      soundEnabled: this.#settings.soundEnabled,
      soundVolume: this.#settings.soundVolume,
      noticeSoundEnabled: this.#settings.noticeSoundEnabled,
      activeTone: this.#settings.activeTone,
      opacity: this.#settings.opacity,
      isPinned: this.#settings.isPinned,
      dockMode: this.#settings.dockMode,
      catAppearance: this.#settings.catAppearance,
    };
  }

  updatePublicSettings(patch: PublicSettingsPatch): PublicSettings {
    this.#settings = persistedSettingsSchema.parse({ ...this.#settings, ...patch });
    this.#write();
    return this.getPublicSettings();
  }

  getPaused(): boolean {
    return this.#settings.paused;
  }

  setPaused(paused: boolean): void {
    this.#settings = { ...this.#settings, paused };
    this.#write();
  }

  getOverlayPosition(displayId: string): Point | null {
    return this.#settings.overlayPositions[displayId] ?? null;
  }

  setOverlayPosition(displayId: string, position: Point): void {
    const candidate = {
      ...this.#settings.overlayPositions,
      [displayId]: { x: Math.round(position.x), y: Math.round(position.y) },
    };
    const entries = Object.entries(candidate).slice(-16);
    this.#settings = persistedSettingsSchema.parse({
      ...this.#settings,
      overlayPositions: Object.fromEntries(entries),
    });
    this.#write();
  }

  #read(): PersistedSettings {
    try {
      if (!existsSync(this.#filePath)) return { ...DEFAULT_SETTINGS, overlayPositions: {} };
      if (statSync(this.#filePath).size > MAX_SETTINGS_BYTES) {
        return { ...DEFAULT_SETTINGS, overlayPositions: {} };
      }
      const parsed: unknown = JSON.parse(readFileSync(this.#filePath, "utf8"));
      return persistedSettingsSchema.parse(parsed);
    } catch {
      return { ...DEFAULT_SETTINGS, overlayPositions: {} };
    }
  }

  #write(): void {
    const serialized = JSON.stringify(persistedSettingsSchema.parse(this.#settings));
    if (Buffer.byteLength(serialized, "utf8") > MAX_SETTINGS_BYTES) return;

    let descriptor: number | null = null;
    const temporaryPath = `${this.#filePath}.tmp`;
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
          // A failed close has no user-facing recovery and must not log a local path.
        }
      }
      try {
        if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
      } catch {
        // Best-effort cleanup of Milo's own content-free temporary settings file.
      }
    }
  }
}

export function isContentFreeSettings(value: unknown): boolean {
  return persistedSettingsSchema.safeParse(value).success;
}

