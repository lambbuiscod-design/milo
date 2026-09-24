import fs from "fs";

const appPath = "apps/desktop/src/renderer/App.tsx";
let appCode = fs.readFileSync(appPath, "utf8");

const replacement = `
          {appViewState === "home" ? (
            <div className="home-layout">
              <div className="home-header">
                <h2>Milo</h2>
                <button className="icon-button" type="button" aria-label="Settings" onClick={() => setAppViewState("settings")}>
                  <SettingsIcon />
                </button>
              </div>
              <div className="home-hero">
                <div className="home-hero__cat">
                  <MiloCat state={snapshot.state} />
                </div>
                <h3>Welcome back!</h3>
                <button className="button button--primary" type="button" onClick={() => void togglePanel(false)}>
                  Open Desktop Milo
                </button>
              </div>
              <div className="home-actions">
                <button className="button button--secondary" type="button">Milo Room</button>
                <button className="button button--secondary" type="button">Customize</button>
              </div>
              <div className="home-stats">
                <span>❤️ Friendship Lv. 7</span>
                <span>🔥 4 days</span>
              </div>
              <div className="home-privacy">
                <ShieldIcon />
                <div>
                  <strong>Milo's Eyes</strong>
                  <span>{selectedWindowTitle ?? "Selected window only"}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="settings-layout">
              <div className="settings-header">
                <h2>Settings</h2>
                <button className="text-button" type="button" onClick={() => setAppViewState("home")}>
                  Done
                </button>
              </div>
              <div className="settings-body">
                {/* Existing settings go here, we will preserve the old disclosure body */}
                <div className="settings-grid">
                  <div className="settings-block">
                    <h3 className="settings-block__title">Personality Tone</h3>
                    <p className="settings-desc">Choose how Milo shapes Safe, Confident, and Playful replies.</p>
                    <div className="tone-cards-grid">
                      {(["standard", "romantic", "witty", "professional"] as const).map((toneKey) => {
                        const meta = TONE_PROFILE_METADATA[toneKey];
                        const isSelected = (snapshot.settings.activeTone ?? "standard") === toneKey;
                        return (
                          <button
                            key={toneKey}
                            type="button"
                            className={\`tone-card \${isSelected ? "tone-card--selected" : ""}\`}
                            onClick={() => {
                              sound.playClick();
                              void updateSettings({ activeTone: toneKey });
                            }}
                          >
                            <span className="tone-card__emoji">{meta.emoji}</span>
                            <div className="tone-card__text">
                              <strong>{meta.title}</strong>
                              <small>{meta.description}</small>
                            </div>
                            {isSelected && <span className="tone-card__check"><CheckIcon /></span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="settings-block">
                    <h3 className="settings-block__title">Sound Feedback</h3>
                    <p className="settings-desc">Subtle synthesized feedback for actions (100–300ms).</p>
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={snapshot.settings.soundEnabled ?? true}
                        onChange={(e) => {
                          const enabled = e.target.checked;
                          sound.setEnabled(enabled);
                          if (enabled) sound.playClick();
                          void updateSettings({ soundEnabled: enabled });
                        }}
                      />
                      <span>Enable UI sounds</span>
                    </label>
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={snapshot.settings.noticeSoundEnabled ?? false}
                        disabled={!(snapshot.settings.soundEnabled ?? true)}
                        onChange={(e) => {
                          sound.playClick();
                          void updateSettings({ noticeSoundEnabled: e.target.checked });
                        }}
                      />
                      <span>Play sound when Milo notices activity</span>
                    </label>
                  </div>

                  <div className="settings-block">
                    <h3 className="settings-block__title">Display & Motion</h3>
                    <p className="settings-desc">Adjust how Milo looks and animates.</p>
                    <div className="select-row">
                      <span>Theme preference</span>
                      <select
                        value={snapshot.settings.theme ?? "system"}
                        onChange={(e) => {
                          sound.playClick();
                          void updateSettings({ theme: e.target.value as ThemePreference });
                        }}
                      >
                        <option value="system">System default</option>
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                      </select>
                    </div>
                    <div className="select-row">
                      <span>Animations</span>
                      <select
                        value={snapshot.settings.motion ?? "system"}
                        onChange={(e) => {
                          sound.playClick();
                          void updateSettings({ motion: e.target.value as MotionPreference });
                        }}
                      >
                        <option value="system">System default</option>
                        <option value="full">Full motion</option>
                        <option value="reduced">Reduced motion</option>
                      </select>
                    </div>
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={snapshot.settings.showWatchingIndicator ?? true}
                        onChange={(e) => {
                          sound.playClick();
                          void updateSettings({ showWatchingIndicator: e.target.checked });
                        }}
                      />
                      <span>Show watching indicator badge</span>
                    </label>
                  </div>

                  <div className="settings-block">
                    <h3 className="settings-block__title">Companion Mode</h3>
                    <p className="settings-desc">How Milo behaves on your desktop.</p>
                    <div className="select-row">
                      <span>Docking mode</span>
                      <select
                        value={snapshot.settings.dockMode ?? "follow-window"}
                        onChange={(e) => {
                          sound.playClick();
                          void updateSettings({ dockMode: e.target.value as any });
                        }}
                      >
                        <option value="follow-window">Follow active window</option>
                        <option value="fixed">Fixed position</option>
                      </select>
                    </div>
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={snapshot.settings.isPinned ?? true}
                        onChange={(e) => {
                          sound.playClick();
                          void updateSettings({ isPinned: e.target.checked });
                        }}
                      />
                      <span>Always on top</span>
                    </label>
                    <div className="range-row">
                      <div className="range-header">
                        <span>Resting opacity</span>
                        <span>{Math.round((snapshot.settings.opacity ?? 1) * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.2"
                        max="1"
                        step="0.1"
                        value={snapshot.settings.opacity ?? 1}
                        onChange={(e) => {
                          void updateSettings({ opacity: parseFloat(e.target.value) });
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
`;

const startIndex = appCode.indexOf('<div className="desktop-layout">');
const endIndex = appCode.indexOf('<footer className="panel__footer">');

if (startIndex === -1 || endIndex === -1) {
  console.error("Could not find start or end index.");
  process.exit(1);
}

appCode = appCode.substring(0, startIndex) + replacement + "\n" + appCode.substring(endIndex);

fs.writeFileSync(appPath, appCode, "utf8");
console.log("Updated App.tsx successfully.");
