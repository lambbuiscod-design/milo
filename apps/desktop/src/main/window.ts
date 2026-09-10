import { existsSync, lstatSync, readdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  BrowserWindow,
  type Session,
  type WebContents,
  net,
} from "electron";
import { COLLAPSED_OVERLAY_SIZE } from "./overlay-controller";
import {
  CONTENT_SECURITY_POLICY,
  MILO_COMPANION_ENTRY,
  MILO_RENDERER_ENTRY,
  SECURE_WEB_PREFERENCES,
  isAllowedApplicationUrl,
  resolveProtocolAssetPath,
} from "./security-policy";

const MAX_PACKAGED_ASSETS = 256;

export function createOverlayWindow(preloadPath: string): BrowserWindow {
  return new BrowserWindow({
    width: COLLAPSED_OVERLAY_SIZE.width,
    height: COLLAPSED_OVERLAY_SIZE.height,
    show: false,
    transparent: true,
    backgroundColor: "#00000000",
    frame: false,
    title: "Milo",
    alwaysOnTop: true,
    focusable: false,
    fullscreenable: false,
    maximizable: false,
    minimizable: true,
    resizable: false,
    hasShadow: false,
    autoHideMenuBar: true,
    webPreferences: {
      ...SECURE_WEB_PREFERENCES,
      preload: preloadPath,
    },
  });
}

export function createCompanionWindow(preloadPath: string): BrowserWindow {
  return new BrowserWindow({
    width: 250,
    height: 300,
    show: false,
    transparent: true,
    backgroundColor: "#00000000",
    frame: false,
    title: "Milo Companion",
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    resizable: false,
    autoHideMenuBar: true,
    focusable: false,
    fullscreenable: false,
    maximizable: false,
    minimizable: false,
    webPreferences: {
      ...SECURE_WEB_PREFERENCES,
      preload: preloadPath,
    },
  });
}

export function hardenRendererSession(rendererSession: Session): void {
  rendererSession.setPermissionCheckHandler(() => false);
  rendererSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
  rendererSession.setDisplayMediaRequestHandler((_request, callback) => {
    callback({});
  });
  rendererSession.on("will-download", (event, item) => {
    event.preventDefault();
    item.cancel();
  });
  rendererSession.webRequest.onBeforeRequest(
    {
      urls: [
        "http://*/*",
        "https://*/*",
        "ws://*/*",
        "wss://*/*",
        "ftp://*/*",
        "file://*/*",
      ],
    },
    (_details, callback) => callback({ cancel: true }),
  );
}

export function hardenWebContents(contents: WebContents): void {
  const denyNavigation = (event: Electron.Event, url?: string): void => {
    if (url === undefined || !isAllowedApplicationUrl(url)) event.preventDefault();
  };

  contents.setWindowOpenHandler(() => ({ action: "deny" }));
  contents.on("will-navigate", (event, url) => denyNavigation(event, url));
  contents.on("will-frame-navigate", (details) => denyNavigation(details, details.url));
  contents.on("will-redirect", (event, url) => denyNavigation(event, url));
  contents.on("will-attach-webview", (event) => event.preventDefault());
  contents.on("devtools-opened", () => contents.closeDevTools());
  contents.on("before-input-event", (event, input) => {
    if (input.key === "F12" || (input.control && input.shift && input.key.toLowerCase() === "i")) {
      event.preventDefault();
    }
  });
}

export function registerRendererProtocol(rendererSession: Session, rendererRoot: string): void {
  const assetManifest = createAssetManifest(rendererRoot);

  rendererSession.protocol.handle("milo", async (request) => {
    const resolved = resolveProtocolAssetPath(rendererRoot, request.url);
    if (request.method !== "GET" || resolved === null || !assetManifest.has(resolved)) {
      return secureResponse("Not found", 404);
    }

    const response = await net.fetch(pathToFileURL(resolved).toString());
    const headers = new Headers(response.headers);
    applySecurityHeaders(headers);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  });
}

export async function loadRenderer(window: BrowserWindow): Promise<void> {
  await window.loadURL(MILO_RENDERER_ENTRY);
}

export async function loadCompanion(window: BrowserWindow): Promise<void> {
  await window.loadURL(MILO_COMPANION_ENTRY);
}

function createAssetManifest(rendererRoot: string): ReadonlySet<string> {
  const manifest = new Set<string>();
  const root = path.resolve(rendererRoot);
  if (!existsSync(root)) throw new Error("MILO_RENDERER_ASSETS_MISSING");

  const visit = (directory: string, depth: number): void => {
    if (depth > 4 || manifest.size > MAX_PACKAGED_ASSETS) {
      throw new Error("MILO_RENDERER_ASSET_MANIFEST_INVALID");
    }
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const candidate = path.join(directory, entry.name);
      const metadata = lstatSync(candidate);
      if (metadata.isSymbolicLink()) throw new Error("MILO_RENDERER_ASSET_MANIFEST_INVALID");
      if (entry.isDirectory()) visit(candidate, depth + 1);
      else if (entry.isFile()) manifest.add(path.resolve(candidate));
      if (manifest.size > MAX_PACKAGED_ASSETS) {
        throw new Error("MILO_RENDERER_ASSET_MANIFEST_INVALID");
      }
    }
  };

  visit(root, 0);
  if (!manifest.has(path.join(root, "index.html"))) {
    throw new Error("MILO_RENDERER_ASSETS_MISSING");
  }
  return manifest;
}

function secureResponse(body: string, status: number): Response {
  const headers = new Headers({ "Content-Type": "text/plain; charset=utf-8" });
  applySecurityHeaders(headers);
  return new Response(body, { status, headers });
}

function applySecurityHeaders(headers: Headers): void {
  headers.set("Content-Security-Policy", CONTENT_SECURITY_POLICY);
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
}
