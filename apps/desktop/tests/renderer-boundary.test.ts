import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function rendererSources(): string {
  const rendererRoot = path.resolve("src/renderer");
  return readdirSync(rendererRoot)
    .filter((name) => /\.(?:ts|tsx)$/.test(name))
    .map((name) => readFileSync(path.join(rendererRoot, name), "utf8"))
    .join("\n");
}

describe("renderer privilege boundary", () => {
  it("contains no Node, Electron, generic IPC, network, or browser persistence primitives", () => {
    const source = rendererSources();
    for (const forbidden of [
      /from\s+["']electron["']/,
      /from\s+["']node:/,
      /\bipcRenderer\b/,
      /\bprocess\./,
      /\bBuffer\b/,
      /\brequire\s*\(/,
      /\bfetch\s*\(/,
      /\bXMLHttpRequest\b/,
      /\bWebSocket\b/,
      /\blocalStorage\b/,
      /\bsessionStorage\b/,
      /\bindexedDB\b/,
    ]) {
      expect(source).not.toMatch(forbidden);
    }
  });

  it("labels the live privacy boundary in visible copy", () => {
    const source = rendererSources();
    expect(source).toContain("Selected window only");
    expect(source).toContain("Milo's Eyes");
  });

  it("keeps the premium desktop regions and privacy affordances in the renderer", () => {
    const source = rendererSources();
    expect(source).toContain('className="home-layout"');
    expect(source).toContain('className="home-actions"');
    expect(source).toContain('className="settings-layout"');
  });
});
