import fs from "fs";

const indexPath = "apps/desktop/src/main/index.ts";
let indexCode = fs.readFileSync(indexPath, "utf8");

if (!indexCode.includes("daily streak logic")) {
  indexCode = indexCode.replace(
    /export async function startMiloDesktop\(\) \{/,
    `export async function startMiloDesktop() {
  // daily streak logic
  try {
    const s = settingsStore.getSettings();
    const lastOpened = s.progress?.firstMetAt;
    if (lastOpened) {
      const today = new Date().toDateString();
      const last = new Date(lastOpened).toDateString();
      if (today !== last) {
        settingsStore.addXp(10); // 10 XP daily checkin
        const diff = Date.now() - new Date(lastOpened).getTime();
        const days = diff / (1000 * 60 * 60 * 24);
        let newStreak = (s.progress?.currentStreak ?? 0);
        if (days <= 2) {
          newStreak += 1;
        } else {
          newStreak = 0; // broken streak
        }
        void settingsStore.update({
          progress: {
            ...s.progress,
            currentStreak: newStreak,
            firstMetAt: new Date().toISOString()
          }
        });
      }
    }
  } catch (err) {
    // ignore
  }`
  );
  fs.writeFileSync(indexPath, indexCode, "utf8");
  console.log("index.ts updated with daily streak.");
}
