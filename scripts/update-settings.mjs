import fs from "fs";

const appPath = "apps/desktop/src/renderer/App.tsx";
let appCode = fs.readFileSync(appPath, "utf8");

// First, add the settingsTab state.
if (!appCode.includes("const [settingsTab, setSettingsTab]")) {
  appCode = appCode.replace(
    `const [appViewState, setAppViewState] = useState<"home" | "settings" | "workspace">("home");`,
    `const [appViewState, setAppViewState] = useState<"home" | "settings" | "workspace">("home");
  const [settingsTab, setSettingsTab] = useState("general");`
  );
}

const startMarker = '<div className="settings-layout">';
const endMarker = '</div>\n          )}';

const startIdx = appCode.indexOf(startMarker);
const endIdx = appCode.indexOf(endMarker, startIdx);

if (startIdx !== -1 && endIdx !== -1) {
  const newSettingsLayout = `<div className="settings-layout">
              <div className="settings-header">
                <h2>Settings</h2>
                <button className="text-button" type="button" onClick={() => setAppViewState("home")}>
                  Done
                </button>
              </div>
              <div className="settings-body-split">
                <div className="settings-sidebar">
                  {["general", "milo", "sound", "display", "companion", "privacy", "data"].map((tab) => (
                    <button
                      key={tab}
                      className={\`settings-tab \${settingsTab === tab ? "settings-tab--active" : ""}\`}
                      onClick={() => setSettingsTab(tab)}
                    >
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                  ))}
                </div>
                <div className="settings-content">
                  {settingsTab === "general" && (
                    <div className="settings-block">
                      <h3 className="settings-block__title">General</h3>
                      <label className="checkbox-row"><input type="checkbox" /><span>Start Milo with computer</span></label>
                      <label className="checkbox-row"><input type="checkbox" /><span>Start minimized</span></label>
                    </div>
                  )}
                  {settingsTab === "milo" && (
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
                                if (sound.playClick) sound.playClick();
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
                  )}
                  {settingsTab === "sound" && (
                    <div className="settings-block">
                      <h3 className="settings-block__title">Sound Feedback</h3>
                      <label className="checkbox-row">
                        <input
                          type="checkbox"
                          checked={snapshot.settings.soundEnabled ?? true}
                          onChange={(e) => {
                            const enabled = e.target.checked;
                            if (enabled && sound.playClick) sound.playClick();
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
                            if (sound.playClick) sound.playClick();
                            void updateSettings({ noticeSoundEnabled: e.target.checked });
                          }}
                        />
                        <span>Play sound when Milo notices activity</span>
                      </label>
                    </div>
                  )}
                  {settingsTab === "display" && (
                    <div className="settings-block">
                      <h3 className="settings-block__title">Display & Motion</h3>
                      <div className="select-row">
                        <span>Theme preference</span>
                        <select
                          value={snapshot.settings.theme ?? "system"}
                          onChange={(e) => {
                            if (sound.playClick) sound.playClick();
                            void updateSettings({ theme: e.target.value as any });
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
                            if (sound.playClick) sound.playClick();
                            void updateSettings({ motion: e.target.value as any });
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
                            if (sound.playClick) sound.playClick();
                            void updateSettings({ showWatchingIndicator: e.target.checked });
                          }}
                        />
                        <span>Show watching indicator badge</span>
                      </label>
                    </div>
                  )}
                  {settingsTab === "companion" && (
                    <div className="settings-block">
                      <h3 className="settings-block__title">Companion Mode</h3>
                      <div className="select-row">
                        <span>Docking mode</span>
                        <select
                          value={snapshot.settings.dockMode ?? "follow-window"}
                          onChange={(e) => {
                            if (sound.playClick) sound.playClick();
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
                            if (sound.playClick) sound.playClick();
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
                  )}
                  {settingsTab === "privacy" && (
                    <div className="settings-block">
                      <h3 className="settings-block__title">Privacy</h3>
                      <div className="privacy-expanded">
                        <h4>What Milo can see</h4>
                        <ul>
                          <li>✓ Selected window</li>
                          <li className="disabled">✕ Other windows</li>
                          <li className="disabled">✕ Desktop</li>
                          <li className="disabled">✕ Password fields</li>
                        </ul>
                        <h4>Processing</h4>
                        <p>● On device</p>
                      </div>
                    </div>
                  )}
                  {settingsTab === "data" && (
                    <div className="settings-block">
                      <h3 className="settings-block__title">Data</h3>
                      <button className="button button--secondary">Export Milo settings</button>
                      <button className="button button--danger" style={{marginTop: 8}}>Reset everything</button>
                    </div>
                  )}
                </div>
              </div>
            </div>`;

  appCode = appCode.substring(0, startIdx) + newSettingsLayout + appCode.substring(endIdx);
  fs.writeFileSync(appPath, appCode, "utf8");
  console.log("Settings layout updated.");
} else {
  console.error("Could not find bounds.", { startIdx, endIdx });
}
