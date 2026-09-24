import fs from "fs";

const storePath = "apps/desktop/src/main/settings-store.ts";
let storeCode = fs.readFileSync(storePath, "utf8");

if (!storeCode.includes("lastXpTime")) {
  storeCode = storeCode.replace(
    /addXp\(amount: number\): void \{/,
    `#lastXpTime = 0;
  #dailyXp = 0;
  #xpDay = "";

  addXp(amount: number): void {
    const now = Date.now();
    const today = new Date().toDateString();

    if (this.#xpDay !== today) {
      this.#xpDay = today;
      this.#dailyXp = 0;
    }

    // Rate limit: max 1 per 2 seconds, max 20 per day
    if (now - this.#lastXpTime < 2000) return;
    if (this.#dailyXp >= 20) return;

    this.#lastXpTime = now;
    this.#dailyXp += amount;
`
  );
  fs.writeFileSync(storePath, storeCode, "utf8");
  console.log("XP anti-spam added.");
}
