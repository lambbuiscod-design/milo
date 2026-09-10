import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  Menu,
  app,
  protocol,
  session,
  type BrowserWindow,
} from "electron";
import { registerDesktopIpc } from "./desktop-ipc";
import { closeDatabase } from "./db";
import { OverlayController } from "./overlay-controller";
import {
  MILO_PROTOCOL_SCHEME,
  MILO_RENDERER_PARTITION,
} from "./security-policy";
import { ContentFreeSettingsStore } from "./settings-store";
import { NativeHelperClient } from "./native-helper-client";
import { AuthSession } from "./auth-session";
import { createAuthBrowserOpener } from "./electron-auth-browser";
import { createElectronRefreshTokenStore } from "./electron-auth-store";
import { createNodeLoopbackCallbackServer } from "./loopback-callback-server";
import { DesktopSuggestionClient } from "./desktop-suggestion-client";
import { createAccountBrowserOpener } from "./electron-account-browser";
import { CompanionPositionManager } from "./companion-position-manager";
import {
  createCompanionWindow,
  createOverlayWindow,
  hardenRendererSession,
  hardenWebContents,
  loadCompanion,
  loadRenderer,
  registerRendererProtocol,
} from "./window";

process.env.ELECTRON_ENABLE_SECURITY_WARNINGS = "true";

declare const __MILO_API_BASE_URL__: string;
declare const __MILO_DESKTOP_CLIENT_ID__: string;
declare const __MILO_SUPABASE_ORIGIN__: string;

protocol.registerSchemesAsPrivileged([
  {
    scheme: MILO_PROTOCOL_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: false,
      corsEnabled: false,
      stream: true,
      codeCache: true,
    },
  },
]);
app.enableSandbox();

const hasSingleInstanceLock = app.requestSingleInstanceLock();
let overlayWindow: BrowserWindow | null = null;
let companionWindow: BrowserWindow | null = null;
let companionPositionManager: CompanionPositionManager | null = null;

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.showInactive();
    if (companionWindow && !companionWindow.isDestroyed()) companionWindow.showInactive();
  });

  app.on("web-contents-created", (_event, contents) => {
    hardenWebContents(contents);
  });

  app.on("certificate-error", (event, _webContents, _url, _error, _certificate, callback) => {
    event.preventDefault();
    callback(false);
  });

  void app
    .whenReady()
    .then(async () => {
      app.setAppUserModelId("com.milo.desktop");
      Menu.setApplicationMenu(null);

      const rendererSession = session.fromPartition(MILO_RENDERER_PARTITION, { cache: false });
      hardenRendererSession(rendererSession);

      const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
      const rendererRoot = path.resolve(moduleDirectory, "../renderer/main_window");
      const preloadPath = path.resolve(moduleDirectory, "preload.cjs");
      registerRendererProtocol(rendererSession, rendererRoot);

      const settingsStore = new ContentFreeSettingsStore(app.getPath("userData"));
      const publicClientId = __MILO_DESKTOP_CLIENT_ID__;
      const supabaseOrigin = __MILO_SUPABASE_ORIGIN__;
      const apiBaseUrl = __MILO_API_BASE_URL__;
      let authSession: AuthSession | null = null;
      let suggestionClient: DesktopSuggestionClient | null = null;
      let accountOpener: ReturnType<typeof createAccountBrowserOpener> | null = null;
      if (publicClientId && supabaseOrigin) {
        try {
          authSession = new AuthSession(
            { supabaseOrigin, clientId: publicClientId },
            {
              openExternal: createAuthBrowserOpener(supabaseOrigin),
              createCallbackServer: createNodeLoopbackCallbackServer,
              refreshTokenStore: createElectronRefreshTokenStore(app.getPath("userData")),
            },
          );
          await authSession.restore().catch(() => undefined);
        } catch {
          authSession = null;
        }
      }
      if (publicClientId && apiBaseUrl) {
        try {
          suggestionClient = new DesktopSuggestionClient({
            apiBaseUrl,
            clientId: publicClientId,
            clientVersion: app.getVersion(),
            allowInsecureLocalhost: !app.isPackaged,
          });
        } catch {
          suggestionClient = null;
        }
      }
      if (apiBaseUrl) {
        try {
          accountOpener = createAccountBrowserOpener(apiBaseUrl, !app.isPackaged);
        } catch {
          accountOpener = null;
        }
      }
      const window = createOverlayWindow(preloadPath);
      overlayWindow = window;
      const overlay = new OverlayController(window, settingsStore);
      overlay.initialize();

      const companion = createCompanionWindow(preloadPath);
      companionWindow = companion;
      companionPositionManager = new CompanionPositionManager({
        userDataDirectory: app.getPath("userData"),
      });
      companionPositionManager.attachWindow(companion);
      const companionPosition = companionPositionManager.loadInitialPosition();
      companion.setBounds({ ...companionPosition, width: 250, height: 300 }, false);

      const nativeHelper = new NativeHelperClient({
        pathContext: {
          appPath: app.getAppPath(),
          resourcesPath: process.resourcesPath,
          isPackaged: app.isPackaged,
        },
      });
      const disposeIpc = registerDesktopIpc({
        window,
        companionWindow: companion,
        overlay,
        settingsStore,
        nativeHelper,
        authSession,
        suggestionClient,
        accountOpener,
      });

      window.setAlwaysOnTop(true, "floating");
      window.once("ready-to-show", () => window.showInactive());
      window.webContents.on("render-process-gone", () => app.quit());
      window.on("closed", () => {
        disposeIpc();
        nativeHelper.dispose();
        void authSession?.dispose();
        overlay.dispose();
        overlayWindow = null;
      });

      companion.setAlwaysOnTop(true, "floating");
      companion.once("ready-to-show", () => companion.showInactive());
      companion.webContents.on("render-process-gone", () => app.quit());
      companion.on("closed", () => {
        companionPositionManager?.dispose();
        companionPositionManager = null;
        companionWindow = null;
      });

      await Promise.all([loadRenderer(window), loadCompanion(companion)]);
    })
    .catch(() => {
      app.exit(1);
    });
}

app.on("window-all-closed", () => app.quit());

app.on("will-quit", () => {
  companionPositionManager?.flush();
  closeDatabase();
});
