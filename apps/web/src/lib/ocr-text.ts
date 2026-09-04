const MAX_OCR_CHARACTERS = 12_000;

export function normalizeOcrText(value: string) {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_OCR_CHARACTERS);
}

export function isUsefulConversationText(value: string) {
  const alphanumeric = value.match(/[\p{L}\p{N}]/gu)?.length ?? 0;
  return value.length >= 10 && alphanumeric >= 6;
}
