export const MAX_CONTEXT_MESSAGES = 8;
export const MAX_CONTEXT_CHARACTERS = 4_000;
const MAX_MESSAGE_CHARACTERS = 600;

export type NormalizedConversationContext = Readonly<{
  text: string;
  messageCount: number;
  truncated: boolean;
  participantNamesRemoved: boolean;
}>;

export type ContextNormalizationOptions = Readonly<{
  maxMessages?: 4 | 6 | 8;
  removeParticipantNames?: boolean;
}>;

/**
 * Reduces local UI Automation/OCR output to the smallest useful recent excerpt.
 * The returned value is ephemeral and must never be logged or persisted.
 */
export function normalizeRecentContext(rawText: string, options: ContextNormalizationOptions = {}): NormalizedConversationContext {
  const maxMessages = options.maxMessages ?? MAX_CONTEXT_MESSAGES;
  const removeParticipantNames = options.removeParticipantNames ?? false;
  let participantNamesRemoved = false;
  const normalizedLines = rawText
    .replace(/\r\n?/gu, "\n")
    .split("\n")
    .map(normalizeLine)
    .map((line) => {
      if (!removeParticipantNames) return line;
      const redacted = redactParticipantName(line);
      participantNamesRemoved ||= redacted !== line;
      return redacted;
    })
    .filter((line): line is string => line.length > 0);

  const deduplicated: string[] = [];
  for (const line of normalizedLines) {
    if (deduplicated.at(-1) !== line) deduplicated.push(line);
  }

  const recent = deduplicated.slice(-maxMessages);
  const bounded: string[] = [];
  let remaining = MAX_CONTEXT_CHARACTERS;

  for (let index = recent.length - 1; index >= 0 && remaining > 0; index -= 1) {
    const separatorLength = bounded.length === 0 ? 0 : 1;
    const available = remaining - separatorLength;
    if (available <= 0) break;

    const line = recent[index] ?? "";
    const suffix = line.length <= available ? line : line.slice(-available);
    bounded.unshift(suffix);
    remaining -= suffix.length + separatorLength;
  }

  const text = bounded.join("\n");
  return {
    text,
    messageCount: bounded.length,
    truncated:
      normalizedLines.length !== deduplicated.length ||
      deduplicated.length > recent.length ||
      recent.join("\n") !== text,
    participantNamesRemoved,
  };
}

function normalizeLine(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, "")
    .replace(/[\t ]+/gu, " ")
    .trim()
    .slice(0, MAX_MESSAGE_CHARACTERS);
}

function redactParticipantName(value: string): string {
  const match = /^(?<name>[\p{L}][\p{L}\p{M}\p{N} ._'’-]{0,79})\s*:\s+(?<message>.+)$/u.exec(value);
  return match?.groups?.message === undefined ? value : `Participant: ${match.groups.message}`;
}
