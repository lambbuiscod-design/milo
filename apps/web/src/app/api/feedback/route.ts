import { z } from "zod";
import { getMfaAuthState, mfaApiFailure } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isE2EMode } from "@/lib/runtime-mode";
import {
  readJsonWithinLimit,
  rejectCrossOriginMutation,
  requestBodyErrorResponse,
} from "@/lib/http-security";

const schema = z.object({ analysisId: z.string().uuid(), category: z.enum(["safe", "confident", "playful"]), value: z.enum(["helpful", "not_helpful"]) });

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
    return requestBodyErrorResponse(error, "The feedback request is too large.") ??
      Response.json({ error: "Invalid feedback" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid feedback" }, { status: 400 });
  if (isE2EMode()) return Response.json({ saved: true });
  const admin = createAdminClient();
  if (!admin) return Response.json({ error: "Feedback is not configured" }, { status: 503 });
  const { data: reply, error: replyError } = await admin.from("replies").select("id,analyses!inner(user_id)").eq("analysis_id", parsed.data.analysisId).eq("category", parsed.data.category).eq("analyses.user_id", user.id).maybeSingle();
  if (replyError) {
    console.error("[api/feedback] ownership lookup failed", { userId: user.id, errorType: replyError.code });
    return Response.json({ error: "Feedback is temporarily unavailable" }, { status: 503 });
  }
  if (!reply) return Response.json({ error: "Reply not found" }, { status: 404 });
  const { error } = await admin.from("feedback").upsert({ reply_id: reply.id, user_id: user.id, value: parsed.data.value }, { onConflict: "reply_id,user_id" });
  return error ? Response.json({ error: "Could not save feedback" }, { status: 500 }) : Response.json({ saved: true });
}
