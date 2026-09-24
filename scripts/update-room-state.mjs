import fs from "fs";

const storePath = "apps/desktop/src/main/settings-store.ts";
let storeCode = fs.readFileSync(storePath, "utf8");

if (!storeCode.includes("room: z.object")) {
  storeCode = storeCode.replace(
    /progress: z\.object\(\{[^]*?\}\)\.default\(\{[^]*?\}\),/,
    `$&
  room: z.object({
    background: z.string().default("default"),
    items: z.array(z.object({
      id: z.string(),
      x: z.number(),
      y: z.number(),
      scale: z.number()
    })).default([])
  }).default({ background: "default", items: [] }),`
  );

  storeCode = storeCode.replace(
    /progress: s\.progress,/,
    `progress: s.progress,
      room: s.room as any,`
  );

  storeCode = storeCode.replace(
    /progress: \{ xp: 0, level: 1, firstMetAt: new Date\(\)\.toISOString\(\), currentStreak: 0 \},/,
    `$&
  room: { background: "default", items: [] },`
  );

  fs.writeFileSync(storePath, storeCode, "utf8");
  console.log("settings-store.ts updated with Room state.");
}

const contractsPath = "apps/desktop/src/shared/contracts.ts";
let contractsCode = fs.readFileSync(contractsPath, "utf8");

if (!contractsCode.includes("RoomState")) {
  contractsCode += `
export interface RoomItemState {
  id: string;
  x: number;
  y: number;
  scale: number;
}
export interface RoomState {
  background: string;
  items: RoomItemState[];
}
`;
  contractsCode = contractsCode.replace(
    /progress\?: MiloProgress;/,
    `progress?: MiloProgress;
  room?: RoomState;`
  );
  fs.writeFileSync(contractsPath, contractsCode, "utf8");
  console.log("contracts.ts updated with Room state.");
}
