import fs from "fs";

const storePath = "apps/desktop/src/main/settings-store.ts";
let storeCode = fs.readFileSync(storePath, "utf8");

if (!storeCode.includes("addXp(amount: number)")) {
  storeCode = storeCode.replace(
    /setOverlayPosition\(displayId: string, position: Point\): void {/,
    `addXp(amount: number): void {
    const current = this.#settings.progress;
    let newXp = current.xp + amount;
    let newLevel = current.level;

    while (true) {
      let threshold = 100;
      if (newLevel === 2) threshold = 250;
      else if (newLevel === 3) threshold = 500;
      else if (newLevel >= 4) threshold = 1000 * (newLevel - 3);

      if (newXp >= threshold) {
        newXp -= threshold;
        newLevel++;
      } else {
        break;
      }
    }

    this.#settings = persistedSettingsSchema.parse({
      ...this.#settings,
      progress: {
        ...current,
        xp: newXp,
        level: newLevel
      }
    });
    this.#write();
  }

  setOverlayPosition(displayId: string, position: Point): void {`
  );
  fs.writeFileSync(storePath, storeCode, "utf8");
  console.log("settings-store.ts updated with addXp.");
}

const ipcPath = "apps/desktop/src/main/desktop-ipc.ts";
let ipcCode = fs.readFileSync(ipcPath, "utf8");

if (!ipcCode.includes("settingsStore.addXp")) {
  // Add 1 XP on askMilo
  ipcCode = ipcCode.replace(
    /const suggestion = await suggestionClient\.generateSuggestions\(\{ context \}\);/,
    `settingsStore.addXp(1);
      const suggestion = await suggestionClient.generateSuggestions({ context });`
  );
  // Add 5 XP on copyReply
  ipcCode = ipcCode.replace(
    /const suggestion = activeSuggestions\.find\(\(s\) => s\.id === input\.suggestionId\);/,
    `settingsStore.addXp(5);
    const suggestion = activeSuggestions.find((s) => s.id === input.suggestionId);`
  );
  fs.writeFileSync(ipcPath, ipcCode, "utf8");
  console.log("desktop-ipc.ts updated with XP hooks.");
}
