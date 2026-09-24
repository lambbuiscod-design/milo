import fs from "fs";

const appPath = "apps/desktop/src/renderer/App.tsx";
let appCode = fs.readFileSync(appPath, "utf8");

appCode = appCode.replace(
  `              </div>
            </div></div>
          )}`,
  `              </div>
            </div>
          )}`
);

appCode = appCode.replace(
  /useState<"home" \| "settings" \| "workspace">/,
  `useState<"home" | "settings" | "workspace" | "room" | "customize">`
);

appCode = appCode.replace(
  /<button className="button button--secondary" type="button">Milo Room<\/button>/,
  `<button className="button button--secondary" type="button" onClick={() => setAppViewState("room")}>Milo Room</button>`
);
appCode = appCode.replace(
  /<button className="button button--secondary" type="button">Customize<\/button>/,
  `<button className="button button--secondary" type="button" onClick={() => setAppViewState("customize")}>Customize</button>`
);

// We should only replace the FIRST occurrence in the hero, not all of them, or it might break other files?
// Let's replace the one in home-hero
appCode = appCode.replace(
  `<div className="home-hero__cat">
                  <MiloCat state={snapshot.state} />`,
  `<div className="home-hero__cat">
                  <MiloCat state={snapshot.state} appearance={snapshot.settings.appearance} />`
);

const newViews = `
          {appViewState === "customize" && (
            <div className="settings-layout">
              <div className="settings-header">
                <h2>Customize Milo</h2>
                <button className="text-button" type="button" onClick={() => setAppViewState("home")}>Done</button>
              </div>
              <div className="settings-body">
                <div className="home-hero">
                  <div className="home-hero__cat" style={{ transform: "scale(1.5)", marginBottom: 16 }}>
                    <MiloCat state={snapshot.state} appearance={snapshot.settings.appearance} />
                  </div>
                </div>
                <div className="settings-block">
                  <h3 className="settings-block__title">Fur Color</h3>
                  <div className="tone-cards-grid">
                    {(["charcoal", "slate", "mauve", "caramel"] as const).map((fur) => {
                      const isSelected = snapshot.settings.appearance?.fur === fur;
                      return (
                        <button
                          key={fur}
                          className={\`tone-card \${isSelected ? "tone-card--selected" : ""}\`}
                          onClick={() => {
                            if (sound.playClick) sound.playClick();
                            void updateSettings({ appearance: { ...(snapshot.settings.appearance as any), fur } });
                          }}
                        >
                          <div className="tone-card__text">
                            <strong>{fur.charAt(0).toUpperCase() + fur.slice(1)}</strong>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="settings-block">
                  <h3 className="settings-block__title">Animation Personality</h3>
                  <div className="tone-cards-grid">
                    {(["calm", "energetic", "chaotic", "sleepy"] as const).map((personality) => {
                      const isSelected = snapshot.settings.appearance?.animationPersonality === personality;
                      return (
                        <button
                          key={personality}
                          className={\`tone-card \${isSelected ? "tone-card--selected" : ""}\`}
                          onClick={() => {
                            if (sound.playClick) sound.playClick();
                            void updateSettings({ appearance: { ...(snapshot.settings.appearance as any), animationPersonality: personality } });
                          }}
                        >
                          <div className="tone-card__text">
                            <strong>{personality.charAt(0).toUpperCase() + personality.slice(1)}</strong>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {appViewState === "room" && (
            <div className="settings-layout">
              <div className="settings-header">
                <h2>Milo's Room</h2>
                <button className="text-button" type="button" onClick={() => setAppViewState("home")}>Done</button>
              </div>
              <div className="settings-body" style={{ textAlign: "center", padding: 24 }}>
                <p style={{ color: "var(--text-muted)" }}>This is Milo's personal space. (Coming soon)</p>
                <div style={{ marginTop: 24, fontSize: 13, color: "var(--text)" }}>
                  <p><strong>Level {snapshot.settings.progress?.level ?? 1}</strong></p>
                  <p>{snapshot.settings.progress?.xp ?? 0} XP</p>
                  <p>{snapshot.settings.progress?.currentStreak ?? 0} Day Streak 🔥</p>
                </div>
              </div>
            </div>
          )}`;

const endSettingsLayout = `              </div>
            </div>
          )}`;

const endIdx = appCode.indexOf(endSettingsLayout);
if (endIdx !== -1) {
  appCode = appCode.substring(0, endIdx + endSettingsLayout.length) + "\n" + newViews + appCode.substring(endIdx + endSettingsLayout.length);
  fs.writeFileSync(appPath, appCode, "utf8");
  console.log("Customization views added.");
} else {
  console.error("Could not find end of settings layout", appCode.substring(840, 855));
}
