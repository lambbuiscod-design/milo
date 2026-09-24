import fs from "fs";

const windowPath = "apps/desktop/src/main/window.ts";
let windowCode = fs.readFileSync(windowPath, "utf8");

const oldFunc = `export function createCompanionWindow(preloadPath: string): BrowserWindow {
  return new BrowserWindow({
    width: 250,
    height: 300,
    show: false,
    transparent: true,
    backgroundColor: "#00000000",
    frame: false,
    title: "Milo Companion",
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    resizable: false,
    autoHideMenuBar: true,
    focusable: false,
    fullscreenable: false,
    maximizable: false,
    minimizable: false,
    webPreferences: {
      ...SECURE_WEB_PREFERENCES,
      preload: preloadPath,
    },
  });
}`;

const newFunc = `export function createCompanionWindow(preloadPath: string): BrowserWindow {
  const win = new BrowserWindow({
    width: 250,
    height: 300,
    show: false,
    transparent: true,
    backgroundColor: "#00000000",
    frame: false,
    title: "Milo Companion",
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    resizable: false,
    autoHideMenuBar: true,
    focusable: false,
    fullscreenable: false,
    maximizable: false,
    minimizable: false,
    webPreferences: {
      ...SECURE_WEB_PREFERENCES,
      preload: preloadPath,
    },
  });
  win.webContents.openDevTools({ mode: "detach" });
  return win;
}`;

windowCode = windowCode.replace(oldFunc, newFunc);
fs.writeFileSync(windowPath, windowCode, "utf8");
console.log("DevTools injected safely.");
