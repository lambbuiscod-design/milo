import { getMfaAuthState, mfaApiFailure } from "@/lib/auth";
import { clientAnalyticsEventSchema } from "@/lib/analytics-contract";
import { recordAnalyticsEvent } from "@/lib/analytics";
import { createAdminClient } from "@/lib/supabase/admin";
import { consumeDistributedRateLimit } from "@/lib/supabase/rate-limit";
import { getUsageForUser } from "@/lib/usage";
import { isE2EMode } from "@/lib/runtime-mode";
import {
  readJsonWithinLimit,
  rejectCrossOriginMutation,
  requestBodyErrorResponse,
} from "@/lib/http-security";

export async function POST(request: Request) {
  const originError = rejectCrossOriginMutation(request);
  if (originError) return originError;

  const auth = await getMfaAuthState();
  if (auth.status !== "authorized") return mfaApiFailure(auth);
  const user = auth.user;
  let body: unknown;
  try {
    body = await readJsonWithinLimit(request);
  } catch (error) {
    return requestBodyErrorResponse(error, "The analytics request is too large.") ??
      Response.json({ error: "Invalid event" }, { status: 400 });
  }
  const parsed = clientAnalyticsEventSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid event" }, { status: 400 });
  if (isE2EMode()) return Response.json({ received: true, duplicate: false });

  const admin = createAdminClient();
  if (!admin) {
    return Response.json(
      { error: "Analytics is not configured" },
      { status: 503 },
    );
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  try {
    const rate = await consumeDistributedRateLimit({
      scope: "analytics",
      key: `${user.id}:${ip}`,
      limit: 40,
      windowSeconds: 600,
    });
    if (!rate.allowed) {
      return Response.json(
        { error: "Too many event requests" },
        { status: 429 },
      );
    }

    if (parsed.data.event === "reply_copied") {
      const { data: analysis, error: analysisError } = await admin
        .from("analyses")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (analysisError) throw new Error("ANALYTICS_OWNERSHIP_CHECK_FAILED");
      if (!analysis) {
        return Response.json({ error: "Reply not found" }, { status: 404 });
      }

      const { data: reply, error: replyError } = await admin
        .from("replies")
        .select("id")
        .eq("analysis_id", analysis.id)
        .eq("category", parsed.data.category)
        .maybeSingle();
      if (replyError) throw new Error("ANALYTICS_OWNERSHIP_CHECK_FAILED");
      if (!reply) {
        return Response.json({ error: "Reply not found" }, { status: 404 });
      }

      const bucket = Math.floor(Date.now() / 5_000);
      const result = await recordAnalyticsEvent(admin, {
        userId: user.id,
        eventName: "reply_copied",
        properties: { category: parsed.data.category },
        dedupeSource: `${reply.id}:${bucket}`,
      });
      return Response.json({ received: true, duplicate: result.duplicate });
    }

    const usage = await getUsageForUser(user.id);
    if (usage.remaining > 0) {
      return Response.json(
        { error: "The analysis limit has not been reached" },
        { status: 409 },
      );
    }
    const hourBucket = Math.floor(Date.now() / 3_600_000);
    const result = await recordAnalyticsEvent(admin, {
      userId: user.id,
      eventName: "paywall_viewed",
      properties: { surface: parsed.data.surface },
      dedupeSource: `${parsed.data.surface}:${hourBucket}`,
    });
    return Response.json({ received: true, duplicate: result.duplicate });
  } catch (error) {
    console.error("[api/events] failed", {
      userId: user.id,
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
    return Response.json({ error: "Could not record event" }, { status: 503 });
  }
}
