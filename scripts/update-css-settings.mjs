import fs from "fs";

const cssPath = "apps/desktop/src/renderer/styles.css";
let cssCode = fs.readFileSync(cssPath, "utf8");

const newCss = `
/* Settings Split Layout */
.settings-body-split {
  display: flex;
  height: 400px;
  border-top: 1px solid var(--border-subtle);
  margin-top: -12px;
}

.settings-sidebar {
  width: 120px;
  display: flex;
  flex-direction: column;
  padding: 12px 12px 12px 0;
  border-right: 1px solid var(--border-subtle);
}

.settings-tab {
  background: transparent;
  border: none;
  text-align: left;
  padding: 8px 12px;
  border-radius: 6px;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s;
}

.settings-tab:hover {
  background: var(--surface-hover);
}

.settings-tab--active {
  background: var(--surface-selected);
  color: var(--text);
  font-weight: 600;
}

.settings-content {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
}

.privacy-expanded ul {
  list-style: none;
  padding: 0;
  margin: 8px 0;
}
.privacy-expanded li {
  margin-bottom: 4px;
}
.privacy-expanded li.disabled {
  color: var(--text-muted);
}
`;

cssCode += newCss;

fs.writeFileSync(cssPath, cssCode, "utf8");
console.log("Updated styles.css successfully.");
