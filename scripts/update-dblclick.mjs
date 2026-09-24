import fs from "fs";

const appPath = "apps/desktop/src/renderer/App.tsx";
let appCode = fs.readFileSync(appPath, "utf8");

if (!appCode.includes("onDoubleClick={() =>")) {
  appCode = appCode.replace(
    `          onClick={() => void togglePanel(!snapshot.panelOpen)}
        >`,
    `          onClick={() => void togglePanel(!snapshot.panelOpen)}
          onDoubleClick={() => {
            // Trigger random reaction
            if (window.milo?.requestSuggestion) {
              // But we don't want an API call, just a local state change.
              // We can just use the existing reaction or play a sound for now.
              void window.milo.copyReply("double-click");
            }
          }}
        >`
  );
  fs.writeFileSync(appPath, appCode, "utf8");
  console.log("Double click added.");
}
