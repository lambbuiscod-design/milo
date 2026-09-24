import fs from "fs";

const appPath = "apps/desktop/src/renderer/App.tsx";
let appCode = fs.readFileSync(appPath, "utf8");

const oldRoomView = `{appViewState === "room" && (
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

const newRoomView = `{appViewState === "room" && (
            <div className="settings-layout">
              <div className="settings-header">
                <h2>Milo's Room</h2>
                <button className="text-button" type="button" onClick={() => setAppViewState("home")}>Done</button>
              </div>
              <div className="settings-body" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                <div style={{ position: "relative", width: "100%", height: 200, backgroundColor: "var(--bg-surface)", overflow: "hidden", borderRadius: "var(--radius-small)" }}>
                  {snapshot.settings.room?.items?.map(item => (
                    <div key={item.id} style={{ position: "absolute", left: item.x, top: item.y, transform: \`scale(\${item.scale})\`, fontSize: 32 }}>
                      {item.id === "plant" ? "🪴" : item.id === "rug" ? "🟫" : item.id === "lamp" ? "🛋️" : "📦"}
                    </div>
                  ))}
                  <div style={{ position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)" }}>
                    <MiloCat state={snapshot.state} appearance={snapshot.settings.appearance} />
                  </div>
                </div>
                <div className="settings-block" style={{ marginTop: 16 }}>
                  <h3 className="settings-block__title">Furniture</h3>
                  <div className="tone-cards-grid">
                    {["plant", "rug", "lamp"].map(id => {
                      const hasItem = snapshot.settings.room?.items?.some(i => i.id === id);
                      return (
                        <button
                          key={id}
                          className={\`tone-card \${hasItem ? "tone-card--selected" : ""}\`}
                          onClick={() => {
                            const items = snapshot.settings.room?.items || [];
                            const newItems = hasItem ? items.filter(i => i.id !== id) : [...items, { id, x: Math.random() * 200 + 20, y: Math.random() * 100 + 20, scale: 1 }];
                            void updateSettings({ room: { ...snapshot.settings.room, items: newItems } as any });
                          }}
                        >
                          <div className="tone-card__text"><strong>{id}</strong></div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}`;

if (appCode.includes(oldRoomView)) {
  appCode = appCode.replace(oldRoomView, newRoomView);
  fs.writeFileSync(appPath, appCode, "utf8");
  console.log("Room editor added.");
} else {
  console.log("Could not find old room view.");
}
