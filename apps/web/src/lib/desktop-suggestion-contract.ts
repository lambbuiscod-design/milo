import { z } from "zod";
import { relationshipStageSchema, replyCategorySchema, toneSchema } from "@milo/contracts";

const MAX_MESSAGES = 8;
const MAX_MESSAGE_CHARS = 1_000;
const messageTextSchema = z.string().trim().min(1).max(MAX_MESSAGE_CHARS).refine(
  (value) => !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/.test(value),
  "Message contains unsupported control characters",
);

/**
 * The desktop contract deliberately has no sender name, timestamp, image,
 * window identity, or client-supplied entitlement fields.
 */
export const desktopSuggestionRequestSchema = z.object({
  requestId: z.string().uuid(),
  clientVersion: z.string().trim().min(1).max(32),
  tone: toneSchema,
  relationshipStage: relationshipStageSchema,
  messages: z.array(
    z.object({
      role: z.enum(["self", "other", "unknown"]),
      text: messageTextSchema,
    }).strict(),
  ).min(1).max(MAX_MESSAGES),
}).strict().superRefine((value, ctx) => {
  const totalCharacters = value.messages.reduce((total, message) => total + message.text.length, 0);
  if (totalCharacters > 4_000) {
    ctx.addIssue({ code: "custom", message: "Conversation context is too large", path: ["messages"] });
  }
});

export const desktopSuggestionResponseSchema = z.object({
  requestId: z.string().uuid(),
  conversationStatus: z.enum(["clear", "unclear", "unsafe"]),
  detectedLanguage: z.string().min(1).max(80),
  briefContext: z.string().max(500),
  warning: z.string().max(500).nullable(),
  replies: z.array(z.object({
    category: replyCategorySchema,
    text: z.string().max(280),
    whyItWorks: z.string().min(1).max(360),
  }).strict()).length(3),
  remaining: z.number().int().min(0).max(150),
}).strict().superRefine((value, ctx) => {
  const categories = new Set(value.replies.map((reply) => reply.category));
  if (categories.size !== 3 || !["safe", "confident", "playful"].every((category) => categories.has(category as never))) {
    ctx.addIssue({ code: "custom", message: "Exactly one safe, confident and playful reply is required", path: ["replies"] });
  }
  if (value.conversationStatus === "unsafe" && value.replies.some((reply) => reply.text.trim().length > 0)) {
    ctx.addIssue({ code: "custom", message: "Unsafe results cannot include ordinary replies", path: ["replies"] });
  }
  if (value.conversationStatus !== "unsafe" && value.replies.some((reply) => reply.text.trim().length === 0)) {
    ctx.addIssue({ code: "custom", message: "Normal results require non-empty replies", path: ["replies"] });
  }
});

export type DesktopSuggestionRequest = z.infer<typeof desktopSuggestionRequestSchema>;
export type DesktopSuggestionResponse = z.infer<typeof desktopSuggestionResponseSchema>;
