import fs from "fs";

const windowPath = "apps/desktop/src/main/window.ts";
let windowCode = fs.readFileSync(windowPath, "utf8");

windowCode = windowCode.replace(
  /export function createCompanionWindow\(preloadPath: string\): BrowserWindow \{/,
  `export function createCompanionWindow(preloadPath: string): BrowserWindow {
  const electron = require("electron");
`
);

windowCode = windowCode.replace(
  /return new BrowserWindow\(\{/,
  `const win = new BrowserWindow({`
);

windowCode = windowCode.replace(
  /preload: preloadPath,\n      \},\n    \}\);\n  \}/,
  `preload: preloadPath,
      },
    });
    win.webContents.openDevTools({ mode: 'detach' });
    win.show();
    return win;
  }`
);

fs.writeFileSync(windowPath, windowCode, "utf8");
console.log("DevTools injected using simpler regex!");
