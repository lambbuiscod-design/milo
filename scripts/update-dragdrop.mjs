import fs from "fs";

const catPath = "apps/desktop/src/renderer/MiloCat.tsx";
let catCode = fs.readFileSync(catPath, "utf8");

if (!catCode.includes("handleMouseDown")) {
  catCode = catCode.replace(
    `const pupilOffset = externalPupilOffset || localPupil;`,
    `const pupilOffset = externalPupilOffset || localPupil;

  const handleMouseDown = () => {
    setLocalState("dragging");
  };

  const handleMouseUp = () => {
    setLocalState("drop");
    setTimeout(() => setLocalState(state), 1000); // restore after drop animation
  };`
  );

  catCode = catCode.replace(
    `<svg`,
    `<svg onMouseDown={handleMouseDown} onMouseUp={handleMouseUp}`
  );

  fs.writeFileSync(catPath, catCode, "utf8");
  console.log("Drag/drop animations added.");
}
