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
import { rewardsUnlockedThroughLevel } from "../shared/progression";

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
const cosmeticIdSchema = z.string().min(1).max(48).regex(/^[a-z0-9_-]+$/);
const appearanceSchema = z
  .object({
    fur: z.enum(["charcoal", "slate", "mauve", "caramel"]).default("charcoal"),
    eyes: cosmeticIdSchema.default("classic"),
    clothing: cosmeticIdSchema.optional(),
    accessories: z
      .object({
        head: cosmeticIdSchema.optional(),
        face: cosmeticIdSchema.optional(),
        neck: cosmeticIdSchema.optional(),
        body: cosmeticIdSchema.optional(),
      })
      .strict()
      .default({}),
    animationPersonality: z.enum(["calm", "energetic", "chaotic", "sleepy"]).default("calm"),
  })
  .strict();
const progressSchema = z
  .object({
    xp: z.number().int().min(0).max(1_000_000).default(0),
    level: z.number().int().min(1).max(100).default(1),
    firstMetAt: z.string().datetime().default(() => new Date().toISOString()),
    currentStreak: z.number().int().min(0).max(10_000).default(0),
    unlockedRewards: z.array(cosmeticIdSchema).max(64).default(() => [...rewardsUnlockedThroughLevel(1)]),
  })
  .strict();
const roomItemSchema = z
  .object({
    id: cosmeticIdSchema,
    x: z.number().finite().min(0).max(1_000),
    y: z.number().finite().min(0).max(1_000),
    scale: z.number().finite().min(0.5).max(2),
    rotation: z.number().finite().min(-180).max(180).optional(),
  })
  .strict();
const roomSchema = z
  .object({
    background: cosmeticIdSchema.default("default"),
    items: z.array(roomItemSchema).max(32).default([]),
  })
  .strict();
const persistedSettingsV1Schema = z
  .object({
    version: z.literal(1),
    theme: z.enum(["system", "light", "dark"]),
    motion: z.enum(["system", "full", "reduced", "minimal"]),
    showWatchingIndicator: z.boolean(),
    soundEnabled: z.boolean().default(true),
    soundVolume: z.number().min(0).max(1).default(0.7),
    noticeSoundEnabled: z.boolean().default(false),
    activeTone: z.enum(["standard", "romantic", "witty", "professional"]).default("standard"),
    opacity: z.number().min(0.75).max(1).default(1.0),
    isPinned: z.boolean().default(true),
    dockMode: z.enum(["free", "top-left", "top-right", "bottom-left", "bottom-right", "follow-window"]).default("free"),
    launchAtLogin: z.boolean().default(false),
    startMinimized: z.boolean().default(true),
    closeBehavior: z.enum(["hide", "minimize", "quit"]).default("hide"),
    language: z.enum(["system", "en", "it"]).default("system"),
    catAppearance: z.enum(["charcoal", "slate", "mauve", "caramel"]).default("charcoal"),
    appearance: appearanceSchema.default({
      fur: "charcoal",
      eyes: "classic",
      accessories: {},
      animationPersonality: "calm",
    }),
    progress: progressSchema.default({
      xp: 0,
      level: 1,
      firstMetAt: new Date().toISOString(),
      currentStreak: 0,
      unlockedRewards: [...rewardsUnlockedThroughLevel(1)],
    }),
    room: roomSchema.default({ background: "default", items: [] }),
    paused: z.boolean(),
    overlayPositions: positionsSchema,
  })
  .strict();

const xpPolicySchema = z
  .object({
    lastAwardAt: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
    awardDay: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
    dailyEarned: z.number().int().min(0).max(20).default(0),
  })
  .strict();

const persistedSettingsSchema = persistedSettingsV1Schema.extend({
  version: z.literal(2),
  xpPolicy: xpPolicySchema.default({ lastAwardAt: 0, awardDay: null, dailyEarned: 0 }),
}).strict();

type PersistedSettings = z.infer<typeof persistedSettingsSchema>;

function preserveEarnedAndSelectedRewards(settings: PersistedSettings): PersistedSettings {
  const selectedRewards = [
    `fur-${settings.appearance.fur}`,
    `animation-${settings.appearance.animationPersonality}`,
    ...settings.room.items.map((item) => `room-${item.id}`),
  ];
  return persistedSettingsSchema.parse({
    ...settings,
    progress: {
      ...settings.progress,
      unlockedRewards: [
        ...new Set([
          ...settings.progress.unlockedRewards,
          ...rewardsUnlockedThroughLevel(settings.progress.level),
          ...selectedRewards,
        ]),
      ],
    },
  });
}

const DEFAULT_SETTINGS: PersistedSettings = Object.freeze({
  version: 2,
  theme: "system",
  motion: "system",
  showWatchingIndicator: true,
  soundEnabled: true,
  soundVolume: 0.7,
  noticeSoundEnabled: false,
  activeTone: "standard",
  opacity: 1.0,
  isPinned: true,
  dockMode: "free",
  launchAtLogin: false,
  startMinimized: true,
  closeBehavior: "hide",
  language: "system",
  catAppearance: "charcoal",
  appearance: { fur: "charcoal" as const, eyes: "classic", accessories: {}, animationPersonality: "calm" as const },
  progress: { xp: 0, level: 1, firstMetAt: new Date().toISOString(), currentStreak: 0, unlockedRewards: [...rewardsUnlockedThroughLevel(1)] },
  room: { background: "default", items: [] },
  xpPolicy: { lastAwardAt: 0, awardDay: null, dailyEarned: 0 },
  paused: false,
  overlayPositions: Object.freeze({}),
});

export class ContentFreeSettingsStore {
  readonly #directory: string;
  readonly #filePath: string;
  #settings: PersistedSettings;
  readonly #now: () => Date;

  constructor(userDataDirectory: string, options: { now?: () => Date } = {}) {
    this.#directory = userDataDirectory;
    this.#filePath = path.join(userDataDirectory, "milo-settings.json");
    this.#now = options.now ?? (() => new Date());
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
      launchAtLogin: this.#settings.launchAtLogin,
      startMinimized: this.#settings.startMinimized,
      closeBehavior: this.#settings.closeBehavior,
      language: this.#settings.language,
      catAppearance: this.#settings.catAppearance,
      appearance: this.#settings.appearance,
      progress: this.#settings.progress,
      room: this.#settings.room,
    };
  }

  updatePublicSettings(patch: PublicSettingsPatch): PublicSettings {
    const appearance = patch.appearance ?? this.#settings.appearance;
    const catAppearance = patch.catAppearance ?? appearance.fur;
    const unlocked = new Set(this.#settings.progress.unlockedRewards);
    const requestedRewards = [
      `fur-${catAppearance}`,
      `animation-${appearance.animationPersonality}`,
      ...(patch.room?.items ?? []).map((item) => `room-${item.id}`),
    ];
    if (requestedRewards.some((reward) => !unlocked.has(reward))) {
      throw new Error("MILO_REWARD_LOCKED");
    }
    this.#settings = persistedSettingsSchema.parse({
      ...this.#settings,
      ...patch,
      catAppearance,
      appearance: { ...appearance, fur: catAppearance },
    });
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

  addXp(amount: number): boolean {
    if (!Number.isInteger(amount) || amount < 1 || amount > 20) return false;
    const now = this.#now();
    const nowMs = now.getTime();
    if (!Number.isFinite(nowMs)) return false;
    const today = now.toISOString().slice(0, 10);
    const policy = this.#settings.xpPolicy;
    const dailyEarned = policy.awardDay === today ? policy.dailyEarned : 0;

    // Rate limit: max 1 per 2 seconds, max 20 per day
    if (nowMs - policy.lastAwardAt < 2000) return false;
    if (dailyEarned + amount > 20) return false;

    const current = this.#settings.progress;
    let newXp = current.xp + amount;
    let newLevel = current.level;

    while (true) {
      let threshold = 100;
      if (newLevel === 2) threshold = 250;
      else if (newLevel === 3) threshold = 500;
      else if (newLevel >= 4) threshold = 1000 * (newLevel - 3);

      if (newXp >= threshold) {
        newXp -= threshold;
        newLevel++;
      } else {
        break;
      }
    }

    const previousDay = this.#settings.xpPolicy.awardDay;
    const previousDayMs = previousDay === null ? Number.NaN : Date.parse(`${previousDay}T00:00:00.000Z`);
    const todayMs = Date.parse(`${today}T00:00:00.000Z`);
    const currentStreak = previousDay === today
      ? current.currentStreak
      : previousDayMs === todayMs - 86_400_000
        ? Math.min(10_000, current.currentStreak + 1)
        : 1;

    this.#settings = persistedSettingsSchema.parse({
      ...this.#settings,
      progress: {
        ...current,
        xp: newXp,
        level: newLevel,
        currentStreak,
        unlockedRewards: [...new Set([...current.unlockedRewards, ...rewardsUnlockedThroughLevel(newLevel)])],
      },
      xpPolicy: { lastAwardAt: nowMs, awardDay: today, dailyEarned: dailyEarned + amount },
    });
    this.#write();
    return true;
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
      const current = persistedSettingsSchema.safeParse(parsed);
      if (current.success) return preserveEarnedAndSelectedRewards(current.data);
      const legacy = persistedSettingsV1Schema.safeParse(parsed);
      if (legacy.success) {
        const migrated = persistedSettingsSchema.parse({
          ...legacy.data,
          version: 2,
          appearance: { ...legacy.data.appearance, fur: legacy.data.catAppearance },
          xpPolicy: { lastAwardAt: 0, awardDay: null, dailyEarned: 0 },
        });
        this.#settings = preserveEarnedAndSelectedRewards(migrated);
        this.#write();
        return this.#settings;
      }
      return { ...DEFAULT_SETTINGS, overlayPositions: {} };
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
  return persistedSettingsSchema.safeParse(value).success || persistedSettingsV1Schema.safeParse(value).success;
}

