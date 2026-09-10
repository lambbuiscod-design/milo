import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CONTENT_SECURITY_POLICY,
  MILO_RENDERER_PARTITION,
  SECURE_WEB_PREFERENCES,
  isAllowedApplicationUrl,
  isTrustedSenderDescriptor,
  resolveProtocolAssetPath,
} from "../src/main/security-policy";
import { PRELOAD_METHOD_ALLOWLIST as API_ALLOWLIST } from "../src/shared/contracts";

describe("Electron renderer security policy", () => {
  it("pins all renderer process protections and a non-persistent partition", () => {
    expect(SECURE_WEB_PREFERENCES).toMatchObject({
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      webviewTag: false,
      navigateOnDragDrop: false,
      allowRunningInsecureContent: false,
      enableWebSQL: false,
      devTools: false,
      partition: "milo:overlay",
    });
    expect(MILO_RENDERER_PARTITION.startsWith("persist:")).toBe(false);
  });

  it("uses a deny-by-default, network-free CSP", () => {
    for (const directive of [
      "default-src 'none'",
      "script-src 'self'",
      "connect-src 'none'",
      "frame-src 'none'",
      "child-src 'none'",
      "object-src 'none'",
    ]) {
      expect(CONTENT_SECURITY_POLICY).toContain(directive);
    }
    expect(CONTENT_SECURITY_POLICY).not.toContain("'unsafe-inline'");
    expect(CONTENT_SECURITY_POLICY).not.toContain("http:");
  });

  it("accepts only the exact local application origin", () => {
    expect(isAllowedApplicationUrl("milo://app/index.html")).toBe(true);
    expect(isAllowedApplicationUrl("milo://app/assets/app.js")).toBe(true);
    expect(isAllowedApplicationUrl("file:///private.html")).toBe(false);
    expect(isAllowedApplicationUrl("https://app/index.html")).toBe(false);
    expect(isAllowedApplicationUrl("milo://evil/index.html")).toBe(false);
    expect(isAllowedApplicationUrl("milo://user@app/index.html")).toBe(false);
    expect(isAllowedApplicationUrl("milo://app:444/index.html")).toBe(false);
  });

  it("rejects traversal and backslash asset requests", () => {
    const root = path.resolve("C:/packaged/renderer");
    expect(resolveProtocolAssetPath(root, "milo://app/index.html")).toBe(path.join(root, "index.html"));
    expect(resolveProtocolAssetPath(root, "milo://app/%5c..%5csecret")).toBeNull();
    expect(resolveProtocolAssetPath(root, "milo://app/assets/app.js?remote=true")).toBeNull();
  });

  it("requires the expected top frame, webContents, and origin for IPC", () => {
    expect(isTrustedSenderDescriptor({ senderId: 7, expectedSenderId: 7, isMainFrame: true, url: "milo://app/index.html" })).toBe(true);
    expect(isTrustedSenderDescriptor({ senderId: 8, expectedSenderId: 7, isMainFrame: true, url: "milo://app/index.html" })).toBe(false);
    expect(isTrustedSenderDescriptor({ senderId: 7, expectedSenderId: 7, isMainFrame: false, url: "milo://app/index.html" })).toBe(false);
    expect(isTrustedSenderDescriptor({ senderId: 7, expectedSenderId: 7, isMainFrame: true, url: "https://attacker.invalid" })).toBe(false);
  });

  it("exposes only the reviewed preload domain methods", () => {
    expect(API_ALLOWLIST).toEqual([
      "getSnapshot",
      "selectWindow",
      "previewContext",
      "pauseWatching",
      "askMilo",
      "copyReply",
      "getSettings",
      "updateSettings",
      "openAccount",
      "signIn",
      "signOut",
      "setPanelOpen",
      "previewState",
      "nudgePosition",
      "resetPosition",
      "openContextMenu",
      "quit",
      "onStateChanged",
      "triggerCharacterAction",
    ]);
    expect(API_ALLOWLIST).not.toContain("send");
    expect(API_ALLOWLIST).not.toContain("invoke");
    expect(API_ALLOWLIST).not.toContain("exec");
  });
});
