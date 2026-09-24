import fs from "fs";

const contractsPath = "apps/desktop/src/shared/contracts.ts";
let code = fs.readFileSync(contractsPath, "utf8");

code = code.replace(
  `dockMode?: DockMode;`,
  `dockMode?: DockMode;
  appearance?: MiloAppearance;
  progress?: MiloProgress;`
);

fs.writeFileSync(contractsPath, code, "utf8");
console.log("Fixed contracts.ts");
