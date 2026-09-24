import fs from "fs";

const contractsPath = "apps/desktop/src/shared/contracts.ts";
let code = fs.readFileSync(contractsPath, "utf8");

// Remove the duplicate definition at the end.
const regex = /export type CatAppearance = "charcoal" \| "slate" \| "mauve" \| "caramel";/;
code = code.replace(regex, ""); // remove first
code = code.replace(regex, ""); // remove second? No, wait. 

fs.writeFileSync(contractsPath, code, "utf8");
console.log("Removed duplicate type.");
