const REPLY_ORDER = ["safe", "confident", "playful"] as const;

export function attachReplyCategories(value: unknown): unknown {
  if (!value || typeof value !== "object" || !("replies" in value)) return value;

  const result = value as Record<string, unknown>;
  if (!Array.isArray(result.replies)) return value;

  return {
    ...result,
    replies: result.replies.map((reply, index) => {
      if (!reply || typeof reply !== "object" || index >= REPLY_ORDER.length) return reply;
      return { ...(reply as Record<string, unknown>), category: REPLY_ORDER[index] };
    }),
  };
}
