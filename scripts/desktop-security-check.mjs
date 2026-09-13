import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
export const repositoryRoot = path.resolve(scriptDirectory, "..");

export const expectedPreloadMethods = Object.freeze([
  "askMilo",
  "copyReply",
  "exportLocalData",
  "getSettings",
  "getSnapshot",
  "nudgePosition",
  "onNavigate",
  "onStateChanged",
  "openAccount",
  "openContextMenu",
  "pauseWatching",
  "previewContext",
  "previewState",
  "quit",
  "resetLocalData",
  "resetPosition",
  "selectWindow",
  "setPanelOpen",
  "signIn",
  "signOut",
  "triggerCharacterAction",
  "updateSettings",
]);

const requiredDesktopPaths = [
  "package.json",
  "forge.config.ts",
  "src/main/index.ts",
  "src/main/security-policy.ts",
  "src/main/window.ts",
  "src/preload/index.ts",
  "index.html",
];

const requiredBrowserWindowSettings = [
  ["nodeIntegration", "false"],
  ["contextIsolation", "true"],
  ["sandbox", "true"],
  ["webSecurity", "true"],
  ["webviewTag", "false"],
  ["navigateOnDragDrop", "false"],
];

const requiredCspDirectives = [
  ["default-src", "'none'"],
  ["script-src", "'self'"],
  ["style-src", "'self'"],
  ["img-src", "'self' data:"],
  ["connect-src", "'none'"],
  ["frame-src", "'none'"],
  ["object-src", "'none'"],
  ["worker-src", "'none'"],
  ["media-src", "'none'"],
  ["form-action", "'none'"],
  ["base-uri", "'none'"],
];

const requiredFuses = [
  ["RunAsNode", "false"],
  ["EnableCookieEncryption", "true"],
  ["EnableNodeOptionsEnvironmentVariable", "false"],
  ["EnableNodeCliInspectArguments", "false"],
  ["EnableEmbeddedAsarIntegrityValidation", "true"],
  ["OnlyLoadAppFromAsar", "true"],
  ["LoadBrowserProcessSpecificV8Snapshot", "false"],
  ["GrantFileProtocolExtraPrivileges", "false"],
  ["WasmTrapHandlers", "false"],
];

const forbiddenServerSecretNames = [
  "OPENAI_API_KEY",
  "OPENROUTER_API_KEY",
  "RATE_LIMIT_HASH_SECRET",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function collectSourceFiles(directory) {
  const files = [];
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    if ([".vite", "coverage", "dist", "node_modules", "out"].includes(entry.name)) {
      continue;
    }

    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectSourceFiles(entryPath)));
    } else if (/\.(?:c|m)?(?:j|t)sx?$|\.html$|\.json$/.test(entry.name)) {
      files.push(entryPath);
    }
  }

  return files;
}

function normalizePolicy(value) {
  return value.replace(/\s+/g, " ").replace(/\s*;\s*/g, ";").trim();
}

function unwrapExpression(expression) {
  let current = expression;
  while (
    ts.isAsExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isParenthesizedExpression(current) ||
    ts.isTypeAssertionExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function objectLiteralForExpression(sourceFile, expression) {
  const unwrapped = unwrapExpression(expression);
  if (ts.isObjectLiteralExpression(unwrapped)) {
    return unwrapped;
  }

  if (
    ts.isCallExpression(unwrapped) &&
    ts.isPropertyAccessExpression(unwrapped.expression) &&
    unwrapped.expression.expression.getText(sourceFile) === "Object" &&
    unwrapped.expression.name.text === "freeze" &&
    unwrapped.arguments[0]
  ) {
    return objectLiteralForExpression(sourceFile, unwrapped.arguments[0]);
  }

  if (!ts.isIdentifier(unwrapped)) {
    return null;
  }

  let resolved = null;
  const visit = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === unwrapped.text &&
      node.initializer
    ) {
      resolved = objectLiteralForExpression(sourceFile, node.initializer);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return resolved;
}

export function extractPreloadMethods(source, fileName = "preload.ts") {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const exposedObjects = [];

  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "exposeInMainWorld"
    ) {
      const [worldName, exposedExpression] = node.arguments;
      const objectLiteral = exposedExpression
        ? objectLiteralForExpression(sourceFile, exposedExpression)
        : null;
      const name = worldName && ts.isStringLiteralLike(worldName) ? worldName.text : null;
      const methods = [];
      let hasSpread = false;

      if (objectLiteral) {
        for (const property of objectLiteral.properties) {
          if (ts.isSpreadAssignment(property)) {
            hasSpread = true;
            continue;
          }
          const propertyName = property.name;
          if (propertyName && (ts.isIdentifier(propertyName) || ts.isStringLiteralLike(propertyName))) {
            methods.push(propertyName.text);
          }
        }
      }

      exposedObjects.push({ name, methods: methods.sort(), hasSpread, resolved: Boolean(objectLiteral) });
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  return exposedObjects;
}

function requireText(failures, text, expression, description) {
  if (!expression.test(text)) {
    failures.push(description);
  }
}

function forbidText(failures, text, expression, description) {
  if (expression.test(text)) {
    failures.push(description);
  }
}

export async function inspectDesktopSource(root = repositoryRoot) {
  const desktopRoot = path.join(root, "apps", "desktop");
  const failures = [];

  if (!(await exists(desktopRoot))) {
    return {
      desktopRoot,
      failures: ["apps/desktop is missing; the desktop security gate fails closed."],
      sourceFileCount: 0,
    };
  }

  for (const relativePath of requiredDesktopPaths) {
    if (!(await exists(path.join(desktopRoot, relativePath)))) {
      failures.push(`Missing required desktop contract file: apps/desktop/${relativePath}`);
    }
  }

  const packagePath = path.join(desktopRoot, "package.json");
  if (await exists(packagePath)) {
    let packageJson;
    try {
      packageJson = JSON.parse(await readFile(packagePath, "utf8"));
    } catch (error) {
      failures.push(`apps/desktop/package.json is invalid JSON: ${error.message}`);
    }

    if (packageJson) {
      if (packageJson.name !== "@milo/desktop") {
        failures.push("Desktop package name must be @milo/desktop.");
      }
      if (packageJson.private !== true) {
        failures.push("Desktop package must be private.");
      }
      for (const scriptName of ["build", "package", "test", "typecheck"]) {
        if (typeof packageJson.scripts?.[scriptName] !== "string") {
          failures.push(`Desktop package must define a ${scriptName} script.`);
        }
      }
      const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
      for (const dependency of [
        "@electron-forge/cli",
        "@electron-forge/plugin-vite",
        "@electron/fuses",
        "electron",
      ]) {
        if (typeof dependencies[dependency] !== "string") {
          failures.push(`Desktop package must pin ${dependency}.`);
        }
      }
      if (typeof dependencies["@electron/fuses"] === "string" && !/^2\./.test(dependencies["@electron/fuses"])) {
        failures.push("Electron 43 packaging must use @electron/fuses 2.x so every current fuse is understood.");
      }
    }
  }

  let sourceFiles = [];
  try {
    sourceFiles = await collectSourceFiles(desktopRoot);
  } catch (error) {
    failures.push(`Could not enumerate desktop source: ${error.message}`);
  }

  const sourceByPath = new Map();
  for (const filePath of sourceFiles) {
    sourceByPath.set(filePath, await readFile(filePath, "utf8"));
  }
  const allSource = [...sourceByPath.values()].join("\n");

  for (const [setting, value] of requiredBrowserWindowSettings) {
    requireText(
      failures,
      allSource,
      new RegExp(`\\b${setting}\\s*:\\s*${value}\\b`),
      `BrowserWindow policy must explicitly set ${setting}: ${value}.`,
    );
  }
  requireText(
    failures,
    allSource,
    /\bdevTools\s*:\s*(?:false|!\s*app\.isPackaged)\b/,
    "BrowserWindow policy must disable devTools in production.",
  );
  requireText(
    failures,
    allSource,
    /\bpartition\s*:\s*(?:["'](?!persist:)[^"']+["']|MILO_RENDERER_PARTITION)\b/,
    "BrowserWindow must use an explicit non-persistent session partition.",
  );
  forbidText(failures, allSource, /\bpartition\s*:\s*["']persist:/, "Persistent renderer partitions are forbidden.");
  forbidText(failures, allSource, /MILO_RENDERER_PARTITION\s*=\s*["']persist:/, "Renderer partition constants must remain non-persistent.");

  const insecureSettings = [
    [/\bnodeIntegration\s*:\s*true\b/, "nodeIntegration: true is forbidden."],
    [/\bcontextIsolation\s*:\s*false\b/, "contextIsolation: false is forbidden."],
    [/\bsandbox\s*:\s*false\b/, "sandbox: false is forbidden."],
    [/\bwebSecurity\s*:\s*false\b/, "webSecurity: false is forbidden."],
    [/\bwebviewTag\s*:\s*true\b/, "webviewTag: true is forbidden."],
    [/\ballowRunningInsecureContent\s*:\s*true\b/, "Insecure Chromium content is forbidden."],
    [/--(?:disable-web-security|no-sandbox)|ignore-certificate-errors/, "Insecure Chromium CLI switches are forbidden."],
    [/ELECTRON_DISABLE_SECURITY_WARNINGS/, "Electron security warnings may not be disabled."],
  ];
  for (const [expression, description] of insecureSettings) {
    forbidText(failures, allSource, expression, description);
  }

  const mainIndexPath = path.join(desktopRoot, "src", "main", "index.ts");
  if (await exists(mainIndexPath)) {
    const mainIndex = await readFile(mainIndexPath, "utf8");
    const enableSandboxIndex = mainIndex.search(/app\s*\.\s*enableSandbox\s*\(/);
    const readyIndexes = [
      mainIndex.search(/app\s*\.\s*whenReady\s*\(/),
      mainIndex.search(/app\s*\.\s*on\s*\(\s*["']ready["']/),
    ].filter((index) => index >= 0);
    const firstReadyIndex = readyIndexes.length > 0 ? Math.min(...readyIndexes) : -1;
    if (enableSandboxIndex < 0) {
      failures.push("Main process must call app.enableSandbox().");
    } else if (firstReadyIndex < 0 || enableSandboxIndex > firstReadyIndex) {
      failures.push("app.enableSandbox() must run before application readiness.");
    }
  }

  requireText(failures, allSource, /protocol\.handle\s*\(\s*["']milo["']/, "Main must register the milo application protocol.");
  requireText(failures, allSource, /milo:\/\/app(?:\/|["'])/, "Privileged renderer content must use the exact milo://app origin.");
  forbidText(failures, allSource, /\.loadURL\s*\(\s*[`"']https?:\/\//, "BrowserWindow may not load remote HTTP(S) content.");
  forbidText(failures, allSource, /\.loadFile\s*\(/, "Production renderer content may not use file:// via loadFile().");
  forbidText(failures, allSource, /VITE_DEV_SERVER_URL|MAIN_WINDOW_VITE_DEV_SERVER_URL|\.loadURL\s*\(\s*[`"']file:\/\//, "Every desktop mode must load exact milo://app content, never a dev HTTP or file URL.");
  requireText(failures, allSource, /decodeURIComponent/, "Custom protocol handling must decode and validate requested paths.");
  requireText(failures, allSource, /path\.(?:relative|resolve)\s*\(/, "Custom protocol handling must enforce traversal-safe path containment.");

  for (const eventName of ["will-attach-webview", "will-frame-navigate", "will-navigate", "will-redirect"]) {
    requireText(failures, allSource, new RegExp(`["']${eventName}["']`), `Main must deny ${eventName}.`);
  }
  requireText(failures, allSource, /setWindowOpenHandler\s*\(/, "Main must install a window-open deny handler.");
  requireText(failures, allSource, /action\s*:\s*["']deny["']/, "Window-open handler must return deny.");
  requireText(failures, allSource, /setPermissionRequestHandler\s*\(/, "Main must deny permission requests.");
  requireText(failures, allSource, /setPermissionCheckHandler\s*\(/, "Main must deny permission checks.");
  requireText(failures, allSource, /["']will-download["']/, "Main must deny renderer downloads.");
  requireText(failures, allSource, /webRequest\.onBeforeRequest\s*\(/, "Main must deny renderer network requests outside the local application protocol.");
  requireText(failures, allSource, /preventDefault\s*\(/, "Navigation and attachment denial must call preventDefault().");

  const policyPath = path.join(desktopRoot, "src", "main", "security-policy.ts");
  const htmlPath = path.join(desktopRoot, "index.html");
  for (const [label, filePath] of [["main policy", policyPath], ["renderer meta policy", htmlPath]]) {
    if (!(await exists(filePath))) {
      continue;
    }
    const normalized = normalizePolicy(await readFile(filePath, "utf8"));
    for (const [directive, value] of requiredCspDirectives) {
      if (!normalized.includes(`${directive} ${value}`)) {
        failures.push(`Desktop ${label} must contain CSP directive: ${directive} ${value}`);
      }
    }
    if (label === "renderer meta policy" && !/http-equiv=["']Content-Security-Policy["']/i.test(normalized)) {
      failures.push("Renderer HTML must include a Content-Security-Policy meta element.");
    }
  }

  const forgePath = path.join(desktopRoot, "forge.config.ts");
  if (await exists(forgePath)) {
    const forgeSource = await readFile(forgePath, "utf8");
    requireText(failures, forgeSource, /postPackage\s*:/, "Forge must flip fuses in a postPackage hook before signing.");
    requireText(failures, forgeSource, /flipFuses\s*\(/, "Forge postPackage must call @electron/fuses flipFuses().");
    requireText(failures, forgeSource, /strictlyRequireAllFuses\s*:\s*true\b/, "Forge must strictly require every configured fuse.");
    for (const [fuse, value] of requiredFuses) {
      requireText(
        failures,
        forgeSource,
        new RegExp(`\\b${fuse}\\s*\\]\\s*:\\s*(?:${value})\\b`),
        `Forge fuse policy must set ${fuse}: ${value}.`,
      );
    }
  }

  const preloadPath = path.join(desktopRoot, "src", "preload", "index.ts");
  if (await exists(preloadPath)) {
    const preloadSource = await readFile(preloadPath, "utf8");
    const exposedObjects = extractPreloadMethods(preloadSource, preloadPath);
    if (exposedObjects.length !== 1) {
      failures.push("Preload must expose exactly one contextBridge surface.");
    } else {
      const [exposed] = exposedObjects;
      if (exposed.name !== "milo") {
        failures.push("Preload contextBridge world name must be milo.");
      }
      if (!exposed.resolved || exposed.hasSpread) {
        failures.push("Preload surface must be a statically reviewable object without spreads.");
      }
      if (JSON.stringify(exposed.methods) !== JSON.stringify([...expectedPreloadMethods].sort())) {
        failures.push(
          `Preload surface must expose only: ${[...expectedPreloadMethods].sort().join(", ")}. Found: ${exposed.methods.join(", ") || "none"}.`,
        );
      }
    }
  }

  requireText(failures, allSource, /ipcMain\.handle\s*\(/, "Desktop domain operations must use handled, request/response IPC.");
  requireText(failures, allSource, /senderFrame/, "IPC validation must inspect senderFrame.");
  requireText(failures, allSource, /mainFrame/, "IPC validation must require the top frame.");
  requireText(failures, allSource, /webContents/, "IPC validation must bind the expected webContents.");
  requireText(failures, allSource, /new URL\s*\([^)]*senderFrame[^)]*\.url|senderFrame[^\n]*\.url/, "IPC validation must parse the sender frame URL.");
  requireText(failures, allSource, /MILO_PROTOCOL_SCHEME\s*=\s*["']milo["']/, "Desktop must pin the milo protocol scheme.");
  requireText(failures, allSource, /\.protocol[^\n]*(?:===|!==)[^\n]*(?:MILO_PROTOCOL_SCHEME|["']milo:["'])/, "IPC validation must require the exact milo: protocol.");
  requireText(failures, allSource, /\.host(?:name)?[^\n]*(?:===|!==)[^\n]*["']app["']/, "IPC validation must require the exact app host.");
  requireText(failures, allSource, /(?:safeParse|\.parse\s*\(|parseIpc)/, "IPC inputs must be schema-validated before use.");

  const sharedSource = [...sourceByPath.entries()]
    .filter(([filePath]) => /[\\/]src[\\/]shared[\\/]/.test(filePath) && !/\.(?:spec|test)\./.test(filePath))
    .map(([, source]) => source)
    .join("\n");
  const objectSchemaCount = (sharedSource.match(/\bz\.object\s*\(/g) ?? []).length;
  const strictSchemaCount = (sharedSource.match(/\.strict\s*\(/g) ?? []).length;
  if (objectSchemaCount === 0 || strictSchemaCount < objectSchemaCount) {
    failures.push("Every shared Zod object schema must use .strict() so unknown IPC/settings fields fail closed.");
  }

  const settingsSource = [...sourceByPath.entries()]
    .filter(([filePath]) => /settings/i.test(path.basename(filePath)) && !/\.(?:spec|test)\./.test(filePath))
    .map(([, source]) => source)
    .join("\n");
  for (const forbiddenSetting of [
    "clipboard",
    "conversation",
    "hwnd",
    "ocrText",
    "participantName",
    "pid",
    "refreshToken",
    "reply",
    "transcript",
    "uiaText",
    "windowTitle",
  ]) {
    if (new RegExp(`\\b${forbiddenSetting}\\s*[?:]`, "i").test(settingsSource)) {
      failures.push(`Persisted settings may not define content-bearing field: ${forbiddenSetting}`);
    }
  }

  const rendererAndPreloadSource = [...sourceByPath.entries()]
    .filter(([filePath]) => /[\\/](?:preload|renderer)[\\/]/.test(filePath))
    .map(([, source]) => source)
    .join("\n");
  for (const [expression, description] of [
    [/\bfetch\s*\(/, "Renderer/preload must not perform direct fetch calls."],
    [/\bXMLHttpRequest\b|\bWebSocket\b/, "Renderer/preload must not expose direct network clients."],
    [/\b(?:readFile|writeFile|exec|execFile|spawn|openPath)\s*\(/, "Renderer/preload must not use generic file, shell, or process operations."],
    [/clipboard\.read/, "Desktop must never read the existing clipboard."],
  ]) {
    forbidText(failures, rendererAndPreloadSource, expression, description);
  }

  for (const secretName of forbiddenServerSecretNames) {
    if (allSource.includes(secretName)) {
      failures.push(`Server-only secret name may not enter desktop source: ${secretName}`);
    }
  }
  for (const [label, expression] of [
    ["OpenRouter credential value", /sk-or-v1-[A-Za-z0-9_-]{16,}/],
    ["Stripe credential value", /(?:sk_(?:live|test)|rk_(?:live|test)|whsec)_[A-Za-z0-9]{12,}/],
    ["Supabase secret value", /sb_secret_[A-Za-z0-9_-]{12,}/],
    ["private key material", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
    ["provider or billing SDK", /@openrouter\/sdk|["'](?:openai|stripe)["']/],
  ]) {
    if (expression.test(allSource)) {
      failures.push(`Desktop source contains forbidden ${label}.`);
    }
  }

  return { desktopRoot, failures, sourceFileCount: sourceFiles.length };
}

async function main() {
  const result = await inspectDesktopSource();
  if (result.failures.length > 0) {
    console.error("Desktop source security check failed:");
    for (const failure of result.failures) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Desktop source security check passed (${result.sourceFileCount} reviewed source/config files).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main();
}
