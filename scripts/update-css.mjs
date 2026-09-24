import fs from "fs";

const cssPath = "apps/desktop/src/renderer/styles.css";
let cssCode = fs.readFileSync(cssPath, "utf8");

const newCss = `
/* ==========================================================================
   Home Redesign
   ========================================================================== */

.home-layout {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
}

.home-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-subtle);
}

.home-header h2 {
  font-size: 18px;
  font-weight: 700;
  margin: 0;
  color: var(--text);
}

.home-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 12px;
  padding: 24px 0;
}

.home-hero__cat {
  width: 96px;
  height: 96px;
}

.home-hero h3 {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
  color: var(--text);
}

.home-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
}

.home-stats {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin: 12px 0;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-muted);
}

.home-privacy {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--surface-muted);
  border-radius: 12px;
  margin-top: 12px;
}

.home-privacy svg {
  color: var(--accent);
  width: 20px;
  height: 20px;
}

.home-privacy div {
  display: flex;
  flex-direction: column;
}

.home-privacy strong {
  font-size: 13px;
  color: var(--text);
}

.home-privacy span {
  font-size: 11px;
  color: var(--text-muted);
}

/* Settings Layout */
.settings-layout {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-subtle);
}

.settings-header h2 {
  font-size: 18px;
  font-weight: 700;
  margin: 0;
}

.settings-body {
  overflow-y: auto;
  max-height: 400px;
}
`;

cssCode += newCss;

fs.writeFileSync(cssPath, cssCode, "utf8");
console.log("Updated styles.css successfully.");
