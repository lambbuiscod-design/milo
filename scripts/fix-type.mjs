import fs from "fs";

const storePath = "apps/desktop/src/main/settings-store.ts";
let storeCode = fs.readFileSync(storePath, "utf8");

storeCode = storeCode.replace(
  /animationPersonality: "calm"/g,
  `animationPersonality: "calm" as const`
);

fs.writeFileSync(storePath, storeCode, "utf8");
console.log("Fixed settings-store type inference.");
