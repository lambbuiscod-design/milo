import { z } from "zod";

export const analyticsReplyCategorySchema = z.enum([
  "safe",
  "confident",
  "playful",
]);

/**
 * Only browser-observable actions belong on the client analytics endpoint.
 * Account, analysis, feedback, checkout and subscription lifecycle events are
 * recorded by trusted server/database transitions instead.
 */
export const clientAnalyticsEventSchema = z.discriminatedUnion("event", [
  z
    .object({
      event: z.literal("reply_copied"),
      category: analyticsReplyCategorySchema,
    })
    .strict(),
  z
    .object({
      event: z.literal("paywall_viewed"),
      surface: z.literal("analysis_limit"),
    })
    .strict(),
]);

export type ClientAnalyticsEvent = z.infer<typeof clientAnalyticsEventSchema>;
