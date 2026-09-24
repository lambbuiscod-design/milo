import fs from "fs";

const contractsPath = "apps/desktop/src/shared/contracts.ts";
let code = fs.readFileSync(contractsPath, "utf8");

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

if (!code.includes("interface MiloAppearance")) {
  code = code + "\n" + newTypes;
  fs.writeFileSync(contractsPath, code, "utf8");
  console.log("Added declarations to contracts.");
}
