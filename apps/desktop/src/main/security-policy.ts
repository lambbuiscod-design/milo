import path from "node:path";

export const MILO_PROTOCOL_SCHEME = "milo";
export const MILO_RENDERER_ORIGIN = "milo://app";
export const MILO_RENDERER_ENTRY = `${MILO_RENDERER_ORIGIN}/index.html`;
export const MILO_RENDERER_PARTITION = "milo:overlay";

export const CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "child-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'none'",
  "object-src 'none'",
  "media-src 'none'",
  "worker-src 'none'",
].join("; ");

export const SECURE_WEB_PREFERENCES = Object.freeze({
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
  spellcheck: false,
  partition: MILO_RENDERER_PARTITION,
});

export function isAllowedApplicationUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    return (
      url.protocol === `${MILO_PROTOCOL_SCHEME}:` &&
      url.hostname === "app" &&
      url.port === "" &&
      url.username === "" &&
      url.password === ""
    );
  } catch {
    return false;
  }
}

export function resolveProtocolAssetPath(rendererRoot: string, rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    if (!isAllowedApplicationUrl(rawUrl) || url.search || url.hash) return null;
    const decoded = decodeURIComponent(url.pathname);
    if (decoded.includes("\0") || decoded.includes("\\")) return null;
    const relativePath = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
    const normalized = path.posix.normalize(relativePath);
    if (normalized === ".." || normalized.startsWith("../") || path.posix.isAbsolute(normalized)) {
      return null;
    }
    const root = path.resolve(rendererRoot);
    const candidate = path.resolve(root, ...normalized.split("/"));
    const rootPrefix = `${root}${path.sep}`.toLocaleLowerCase("en-US");
    const normalizedCandidate = candidate.toLocaleLowerCase("en-US");
    return normalizedCandidate === root.toLocaleLowerCase("en-US") || normalizedCandidate.startsWith(rootPrefix)
      ? candidate
      : null;
  } catch {
    return null;
  }
}

export type SenderDescriptor = Readonly<{
  senderId: number;
  expectedSenderId: number;
  isMainFrame: boolean;
  url: string;
}>;

export function isTrustedSenderDescriptor(sender: SenderDescriptor): boolean {
  return (
    sender.senderId === sender.expectedSenderId &&
    sender.isMainFrame &&
    isAllowedApplicationUrl(sender.url)
  );
}

export function shouldDenyRendererRequest(rawUrl: string): boolean {
  return !isAllowedApplicationUrl(rawUrl);
}
