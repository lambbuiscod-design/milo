import fs from "fs";

const appPath = "apps/desktop/src/renderer/App.tsx";
let appCode = fs.readFileSync(appPath, "utf8");

// We need to inject the state declarations right after "export function App"
appCode = appCode.replace(
  `export function App({ initialSnapshot = INITIAL_SNAPSHOT }: { initialSnapshot?: DesktopSnapshot } = {}) {`,
  `export function App({ initialSnapshot = INITIAL_SNAPSHOT }: { initialSnapshot?: DesktopSnapshot } = {}) {
  const [appViewState, setAppViewState] = useState<"home" | "settings" | "workspace" | "room" | "customize">("home");
  const [settingsTab, setSettingsTab] = useState("general");`
);

fs.writeFileSync(appPath, appCode, "utf8");
console.log("State declarations added.");
