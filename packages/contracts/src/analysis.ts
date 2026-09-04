import { z } from "zod";

export const toneSchema = z.enum([
  "standard",
  "romantic",
  "witty",
  "professional",
  "warm",
  "confident",
  "playful",
  "direct",
]);
export const relationshipStageSchema = z.enum(["new_match", "first_dates", "dating", "relationship", "conflict"]);
export const replyCategorySchema = z.enum(["safe", "confident", "playful"]);

export const replySchema = z.object({
  category: replyCategorySchema,
  text: z.string().max(280),
  why_it_works: z.string().min(1).max(360),
});

export const analysisResultSchema = z.object({
  conversation_status: z.enum(["clear", "unclear", "unsafe"]),
  detected_language: z.string().min(1).max(80),
  brief_context: z.string().max(500),
  warning: z.string().max(500).nullable(),
  replies: z.array(replySchema).length(3),
}).superRefine((value, ctx) => {
  const categories = new Set(value.replies.map((reply) => reply.category));
  if (categories.size !== 3 || !["safe", "confident", "playful"].every((category) => categories.has(category as never))) {
    ctx.addIssue({ code: "custom", message: "Replies must contain exactly one safe, confident and playful choice", path: ["replies"] });
  }
  if (value.conversation_status === "unsafe" && value.replies.some((reply) => reply.text.trim().length > 0)) {
    ctx.addIssue({ code: "custom", message: "Unsafe results cannot include ordinary reply suggestions", path: ["replies"] });
  }
  if (value.conversation_status !== "unsafe" && value.replies.some((reply) => reply.text.trim().length === 0)) {
    ctx.addIssue({ code: "custom", message: "Normal results require non-empty replies", path: ["replies"] });
  }
});

export const analysisFormSchema = z.object({
  tone: toneSchema,
  relationshipStage: relationshipStageSchema,
  optionalContext: z.string().max(500).default(""),
});

export type AnalysisResult = z.infer<typeof analysisResultSchema>;
export type Tone = z.infer<typeof toneSchema>;
export type RelationshipStage = z.infer<typeof relationshipStageSchema>;

function providerReplyJsonSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["text", "why_it_works"],
    properties: {
      text: { type: "string", maxLength: 280 },
      why_it_works: { type: "string", maxLength: 360 },
    },
  } as const;
}

export const analysisJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["conversation_status", "detected_language", "brief_context", "warning", "replies"],
  properties: {
    conversation_status: { type: "string", enum: ["clear", "unclear", "unsafe"] },
    detected_language: { type: "string" },
    brief_context: { type: "string" },
    warning: { type: ["string", "null"] },
    replies: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: providerReplyJsonSchema(),
    },
  },
} as const;
