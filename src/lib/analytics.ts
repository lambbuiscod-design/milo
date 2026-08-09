import "server-only";

import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

type PrivacySafeAnalyticsEvent =
  | {
      eventName: "reply_copied";
      properties: { category: "safe" | "confident" | "playful" };
    }
  | {
      eventName: "paywall_viewed";
      properties: { surface: "analysis_limit" };
    }
  | {
      eventName: "checkout_started";
      properties?: never;
    };

export function createAnalyticsDedupeKey(
  userId: string,
  eventName: PrivacySafeAnalyticsEvent["eventName"],
  source: string,
) {
  return createHash("sha256")
    .update(`milo-analytics-v1\0${userId}\0${eventName}\0${source}`)
    .digest("hex");
}
/**
 * Records an event without ever accepting arbitrary analytics properties.
 * The source is represented only by a one-way digest in Postgres.
 */
export async function recordAnalyticsEvent(
  admin: AdminClient,
  input: PrivacySafeAnalyticsEvent & {
    userId: string;
    dedupeSource?: string;
  },
) {
  const { error } = await admin.from("analytics_events").insert({
    user_id: input.userId,
    event_name: input.eventName,
    properties: input.properties ?? {},
    dedupe_key: input.dedupeSource
      ? createAnalyticsDedupeKey(
          input.userId,
          input.eventName,
          input.dedupeSource,
        )
      : null,
  });

  if (!error) return { recorded: true, duplicate: false } as const;
  if (input.dedupeSource && error.code === "23505") {
    return { recorded: false, duplicate: true } as const;
  }
  throw new Error("ANALYTICS_EVENT_WRITE_FAILED");
}
