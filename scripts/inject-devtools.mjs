import fs from "fs";

const windowPath = "apps/desktop/src/main/window.ts";
let windowCode = fs.readFileSync(windowPath, "utf8");

if (!windowCode.includes("openDevTools")) {
  windowCode = windowCode.replace(
    /return new BrowserWindow\(\{/,
    `const win = new BrowserWindow({`
  );
  windowCode = windowCode.replace(
    /        preload: preloadPath,\n      \},\n    \}\);\n  \}/,
    `        preload: preloadPath,
      },
    });
    win.webContents.openDevTools({ mode: "detach" });
    return win;
  }`
  );
  fs.writeFileSync(windowPath, windowCode, "utf8");
  console.log("openDevTools injected.");
}
