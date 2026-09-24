import fs from "fs";

const contractsPath = "apps/desktop/src/shared/contracts.ts";
let code = fs.readFileSync(contractsPath, "utf8");

if (!code.includes("type CatAppearance")) {
  const newTypes = `
export type CatAppearance = "charcoal" | "slate" | "mauve" | "caramel";
export type AnimationPersonality = "calm" | "energetic" | "chaotic" | "sleepy";

export interface MiloAccessories {
  head?: string;
  face?: string;
  neck?: string;
  body?: string;
}

export interface MiloAppearance {
  fur: CatAppearance;
  eyes: string;
  clothing?: string;
  accessories: MiloAccessories;
  animationPersonality: AnimationPersonality;
}

export interface MiloProgress {
  xp: number;
  level: number;
  firstMetAt: string;
  currentStreak: number;
}
`;
  code = code + "\n" + newTypes;
}

// Add to PublicSettings
if (!code.includes("appearance?: MiloAppearance")) {
  code = code.replace(
    /readonly dockMode\?: DockMode;/,
    `readonly dockMode?: DockMode;
  readonly appearance?: MiloAppearance;
  readonly progress?: MiloProgress;`
  );
}

fs.writeFileSync(contractsPath, code, "utf8");
console.log("contracts.ts updated.");

const settingsPath = "apps/desktop/src/main/settings-store.ts";
let storeCode = fs.readFileSync(settingsPath, "utf8");

if (!storeCode.includes("fur: z.enum")) {
  const schemaAdd = `  appearance: z.object({
    fur: z.enum(["charcoal", "slate", "mauve", "caramel"]).default("charcoal"),
    eyes: z.string().default("default"),
    clothing: z.string().optional(),
    accessories: z.object({
      head: z.string().optional(),
      face: z.string().optional(),
      neck: z.string().optional(),
      body: z.string().optional(),
    }).default({}),
    animationPersonality: z.enum(["calm", "energetic", "chaotic", "sleepy"]).default("calm")
  }).default({
    fur: "charcoal",
    eyes: "default",
    accessories: {},
    animationPersonality: "calm"
  }),
  progress: z.object({
    xp: z.number().default(0),
    level: z.number().default(1),
    firstMetAt: z.string().default(() => new Date().toISOString()),
    currentStreak: z.number().default(0)
  }).default({
    xp: 0,
    level: 1,
    firstMetAt: new Date().toISOString(),
    currentStreak: 0
  }),`;
  storeCode = storeCode.replace(
    /dockMode: z\.enum\(\["follow-window", "fixed"\]\)\.default\("follow-window"\),/,
    `dockMode: z.enum(["follow-window", "fixed"]).default("follow-window"),\n${schemaAdd}`
  );
  
  storeCode = storeCode.replace(
    /dockMode: s\.dockMode,/,
    `dockMode: s.dockMode,
      appearance: s.appearance as any,
      progress: s.progress,`
  );

  fs.writeFileSync(settingsPath, storeCode, "utf8");
  console.log("settings-store.ts updated.");
}

