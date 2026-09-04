import type { DesktopCapturerSource } from "electron";
import type {
  SelectedWindowSummary,
  WindowCandidate,
} from "../shared/contracts";
import type { NativeWindowIdentity } from "./native-helper-client";

const MAX_WINDOW_CANDIDATES = 20;
const MAX_WINDOW_TITLE_LENGTH = 120;

export type InternalSelectedWindow = Readonly<{
  sourceId: string;
  publicSummary: SelectedWindowSummary;
  nativeIdentity: NativeWindowIdentity | null;
}>;

export type ChatAppType = "whatsapp" | "discord" | "telegram" | "slack" | "other";

const WHATSAPP_REGEX = /(?:^|\b|\(|- )WhatsApp(?:\b|\)| -|$)/i;
const DISCORD_REGEX = /(?:^|\b|\(|- )Discord(?:\b|\)| -|\||$)/i;
const TELEGRAM_REGEX = /(?:^|\b|\(|- )Telegram(?:\b|\)| -|$)/i;
const SLACK_REGEX = /(?:^|\b|\(|- )Slack(?:\b|\)| -|$)/i;

export function detectChatAppType(title: string): ChatAppType {
  if (WHATSAPP_REGEX.test(title)) return "whatsapp";
  if (DISCORD_REGEX.test(title)) return "discord";
  if (TELEGRAM_REGEX.test(title)) return "telegram";
  if (SLACK_REGEX.test(title)) return "slack";
  return "other";
}

export function sortWindowCandidates(candidates: readonly WindowCandidate[]): WindowCandidate[] {
  return [...candidates].sort((a, b) => {
    const aChat = detectChatAppType(a.title) !== "other" ? 1 : 0;
    const bChat = detectChatAppType(b.title) !== "other" ? 1 : 0;
    return bChat - aChat;
  });
}

export function toWindowCandidates(
  sources: readonly Pick<DesktopCapturerSource, "id" | "name">[],
  excludedSourceId: string,
): WindowCandidate[] {
  const candidates: WindowCandidate[] = [];
  const observedIds = new Set<string>();

  for (const source of sources) {
    if (source.id === excludedSourceId || !isWindowSourceId(source.id) || observedIds.has(source.id)) {
      continue;
    }
    const title = normalizeWindowTitle(source.name);
    if (!title) continue;
    observedIds.add(source.id);
    candidates.push({ sourceId: source.id, title });
  }

  return sortWindowCandidates(candidates).slice(0, MAX_WINDOW_CANDIDATES);
}

export function selectFreshWindow(
  sourceId: string,
  candidates: readonly WindowCandidate[],
): InternalSelectedWindow | null {
  const selected = candidates.find((candidate) => candidate.sourceId === sourceId);
  if (!selected) return null;
  return {
    sourceId: selected.sourceId,
    publicSummary: {
      available: true,
      title: selected.title,
      processId: null,
    },
    nativeIdentity: null,
  };
}

export function bindNativeWindowIdentity(
  selected: InternalSelectedWindow,
  identities: readonly NativeWindowIdentity[],
): InternalSelectedWindow | null {
  const hwnd = windowHandleFromSourceId(selected.sourceId);
  if (hwnd === null) return null;
  const identity = identities.find((candidate) => candidate.hwnd === hwnd);
  if (!identity) return null;
  return {
    ...selected,
    publicSummary: { ...selected.publicSummary, processId: identity.pid },
    nativeIdentity: identity,
  };
}

export function windowHandleFromSourceId(value: string): number | null {
  if (!isWindowSourceId(value)) return null;
  const hwnd = Number(value.split(":", 3)[1]);
  return Number.isSafeInteger(hwnd) && hwnd > 0 ? hwnd : null;
}

export function isWindowSourceId(value: string): boolean {
  return /^window:[1-9][0-9]*:[0-9]+$/.test(value) && value.length <= 64;
}

export function normalizeWindowTitle(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_WINDOW_TITLE_LENGTH);
}
