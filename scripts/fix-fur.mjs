import fs from "fs";

const storePath = "apps/desktop/src/main/settings-store.ts";
let storeCode = fs.readFileSync(storePath, "utf8");

storeCode = storeCode.replace(
  /fur: "charcoal",/g,
  `fur: "charcoal" as const,`
);

fs.writeFileSync(storePath, storeCode, "utf8");
console.log("Fixed settings-store fur type inference.");
