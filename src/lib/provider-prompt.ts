/**
 * Serializes OCR as valid JSON while removing literal HTML/XML delimiters.
 * JSON.parse restores the exact transcript for model interpretation.
 */
export function serializeUntrustedTranscript(transcript: string) {
  return JSON.stringify(transcript)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026");
}
