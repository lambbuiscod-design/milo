import fs from "fs";

const catPath = "apps/desktop/src/renderer/MiloCat.tsx";
let catCode = fs.readFileSync(catPath, "utf8");

if (!catCode.includes("import type { MiloAppearance }")) {
  catCode = catCode.replace(
    `import type { CharacterState, DesktopState } from "../shared/contracts";`,
    `import type { CharacterState, DesktopState, MiloAppearance } from "../shared/contracts";`
  );
  
  catCode = catCode.replace(
    `pupilOffset?: { x: number; y: number };`,
    `pupilOffset?: { x: number; y: number };
  appearance?: MiloAppearance;`
  );

  catCode = catCode.replace(
    `export function MiloCat({ state, "aria-label": customAriaLabel, pupilOffset }: MiloCatProps) {`,
    `export function MiloCat({ state, "aria-label": customAriaLabel, pupilOffset, appearance }: MiloCatProps) {

  const furColors = {
    charcoal: { cat: "#2b3044", ear: "#d97757", nose: "#c86d51" },
    slate: { cat: "#4a5568", ear: "#7b8fab", nose: "#6b7fa0" },
    mauve: { cat: "#7c6b7e", ear: "#b8939b", nose: "#a8838b" },
    caramel: { cat: "#8b6a3e", ear: "#c49a6c", nose: "#b58a5c" }
  };
  
  const fur = appearance?.fur && furColors[appearance.fur] ? furColors[appearance.fur] : furColors.charcoal;
  const styleVars = {
    "--cat": fur.cat,
    "--cat-ear": fur.ear,
    "--cat-nose": fur.nose,
  } as React.CSSProperties;`
  );
  
  catCode = catCode.replace(
    `aria-label={customAriaLabel ?? "Milo cat mascot"}
    >`,
    `aria-label={customAriaLabel ?? "Milo cat mascot"}
      style={styleVars}
    >`
  );

  fs.writeFileSync(catPath, catCode, "utf8");
  console.log("MiloCat updated.");
}
