import fs from "fs";

const storePath = "apps/desktop/src/main/settings-store.ts";
let storeCode = fs.readFileSync(storePath, "utf8");

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
  `catAppearance: z.enum(["charcoal", "slate", "mauve", "caramel"]).default("charcoal"),`,
  `catAppearance: z.enum(["charcoal", "slate", "mauve", "caramel"]).default("charcoal"),\n${schemaAdd}`
);

storeCode = storeCode.replace(
  `catAppearance: s.catAppearance,`,
  `catAppearance: s.catAppearance,
      appearance: s.appearance as any,
      progress: s.progress,`
);

storeCode = storeCode.replace(
  `catAppearance: "charcoal",`,
  `catAppearance: "charcoal",
  appearance: { fur: "charcoal", eyes: "default", accessories: {}, animationPersonality: "calm" },
  progress: { xp: 0, level: 1, firstMetAt: new Date().toISOString(), currentStreak: 0 },`
);

fs.writeFileSync(storePath, storeCode, "utf8");
console.log("settings-store.ts fixed.");
