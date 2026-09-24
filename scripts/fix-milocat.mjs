import fs from "fs";

const catPath = "apps/desktop/src/renderer/MiloCat.tsx";
let catCode = fs.readFileSync(catPath, "utf8");

catCode = catCode.replace(
  `const fur = appearance?.fur && furColors[appearance.fur] ? furColors[appearance.fur] : furColors.charcoal;`,
  `const furKey = appearance?.fur as keyof typeof furColors;
  const fur = furKey && furColors[furKey] ? furColors[furKey] : furColors.charcoal;`
);

fs.writeFileSync(catPath, catCode, "utf8");
console.log("Fixed MiloCat.tsx");
