import fs from "fs";

const catPath = "apps/desktop/src/renderer/MiloCat.tsx";
let catCode = fs.readFileSync(catPath, "utf8");

if (!catCode.includes("import { useState, useEffect }")) {
  catCode = catCode.replace(
    `import type { CharacterState, DesktopState, MiloAppearance } from "../shared/contracts";`,
    `import { useState, useEffect } from "react";\nimport type { CharacterState, DesktopState, MiloAppearance } from "../shared/contracts";`
  );

  catCode = catCode.replace(
    `export function MiloCat({ state, "aria-label": customAriaLabel, pupilOffset, appearance }: MiloCatProps) {`,
    `export function MiloCat({ state, "aria-label": customAriaLabel, pupilOffset: externalPupilOffset, appearance }: MiloCatProps) {
  const [localPupil, setLocalPupil] = useState({ x: 0, y: 0 });
  const [localState, setLocalState] = useState(state);

  useEffect(() => {
    setLocalState(state);
  }, [state]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Very simple normalized tracking
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      const dx = (e.clientX - cx) / cx;
      const dy = (e.clientY - cy) / cy;
      setLocalPupil({ x: dx * 3, y: dy * 3 }); // max 3px movement
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const pupilOffset = externalPupilOffset || localPupil;
  const displayState = localState;
`
  );

  catCode = catCode.replace(/state === /g, "displayState === ");
  catCode = catCode.replace(/state=/g, "displayState=");

  // Apply pupil offsets
  catCode = catCode.replace(
    `<circle cx="44" cy="54" r="5" fill="#1A1F2C" className="cat-eye-pupil" />`,
    `<circle cx={44 + pupilOffset.x} cy={54 + pupilOffset.y} r="5" fill="#1A1F2C" className="cat-eye-pupil" />`
  );
  catCode = catCode.replace(
    `<circle cx="84" cy="54" r="5" fill="#1A1F2C" className="cat-eye-pupil" />`,
    `<circle cx={84 + pupilOffset.x} cy={54 + pupilOffset.y} r="5" fill="#1A1F2C" className="cat-eye-pupil" />`
  );

  fs.writeFileSync(catPath, catCode, "utf8");
  console.log("MiloCat tracking added.");
}
