import fs from "fs";

const appPath = "apps/desktop/src/renderer/App.tsx";
let appCode = fs.readFileSync(appPath, "utf8");

if (!appCode.includes("motion-reduced")) {
  appCode = appCode.replace(
    /className="desktop-layer"/,
    `className={\`desktop-layer \${snapshot.settings.motion === "reduced" ? "motion-reduced" : ""}\`}`
  );
  fs.writeFileSync(appPath, appCode, "utf8");
  console.log("Motion reduced class added to App.tsx.");
}

const cssPath = "apps/desktop/src/renderer/styles.css";
let cssCode = fs.readFileSync(cssPath, "utf8");

if (!cssCode.includes(".motion-reduced *")) {
  cssCode += `\n\n.motion-reduced * {\n  animation-duration: 0.01ms !important;\n  transition-duration: 0.01ms !important;\n}\n`;
  fs.writeFileSync(cssPath, cssCode, "utf8");
  console.log("Motion reduced CSS added to styles.css.");
}
