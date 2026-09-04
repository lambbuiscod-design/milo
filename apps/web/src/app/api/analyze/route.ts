import { headers } from "next/headers";
import { getMfaAuthState, mfaApiFailure } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { analysisFormSchema, analysisResultSchema } from "@milo/contracts";
import { containsHighRiskContext } from "@milo/security";
import { isE2EMode } from "@/lib/runtime-mode";
import { ImageProcessingError, sanitizeImage, validateImageFile } from "@/lib/image";
import { analyzeWithOpenRouter, OpenRouterAnalysisError } from "@/lib/openrouter";
import { extractConversationText, OcrProcessingError } from "@/lib/ocr";
import { getUsageForUser } from "@/lib/usage";
import { MAX_ANALYZE_BODY_BYTES } from "@/lib/image-upload";
import { consumeDistributedRateLimit } from "@/lib/supabase/rate-limit";
import { env } from "@/lib/env";
import { recordAnalyticsEvent } from "@/lib/analytics";
import {
  readFormDataWithinLimit,
  rejectCrossOriginMutation,
  requestBodyErrorResponse,
} from "@/lib/http-security";

export const runtime = "nodejs";
export const maxDuration = 90;

class AnalyzeRouteError extends Error {
  constructor(
    public readonly code: "DATABASE_UNAVAILABLE" | "PAYWALL",
    public readonly status: 402 | 503,
    public readonly clientMessage: string,
  ) {
    super(code);
    this.name = "AnalyzeRouteError";
  }
}

function safetyBlockedResult() {
  return analysisResultSchema.parse({
    conversation_status: "unsafe",
    detected_language: "Unknown",
    brief_context: "The submitted conversation requires a safety-first response.",
    warning: "Milo cannot help create coercive, threatening, exploitative or self-harm-related messages. If anyone may be in immediate danger, contact local emergency services or a trusted professional.",
    replies: ["safe", "confident", "playful"].map((category) => ({
      category,
      text: "",
      why_it_works: "Ordinary dating suggestions are disabled for this safety-sensitive situation.",
    })),
  });
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const originError = rejectCrossOriginMutation(request);
  if (originError) return originError;

  const auth = await getMfaAuthState();
  if (auth.status !== "authorized") return mfaApiFailure(auth);
  const user = auth.user;
  if (isE2EMode()) {
    let form: FormData;
    try {
      form = await readFormDataWithinLimit(request, MAX_ANALYZE_BODY_BYTES);
    } catch (error) {
      return requestBodyErrorResponse(error, "The prepared screenshot is too large to upload safely.") ??
        Response.json({ error: "Could not read the upload.", code: "INVALID_REQUEST_BODY" }, { status: 400 });
    }
    const file = form.get("image");
    if (!(file instanceof File)) return Response.json({ error: "Choose a screenshot first.", code: "IMAGE_REQUIRED" }, { status: 400 });
    const imageError = validateImageFile(file);
    if (imageError) return Response.json({ error: imageError, code: "INVALID_IMAGE" }, { status: 400 });
    const mockContext = String(form.get("optionalContext") ?? "");
    if (mockContext.includes("force-error")) return Response.json({ error: "Mock provider failure", code: "ANALYSIS_FAILED" }, { status: 422 });
    const { consumeE2EUsage, e2eAnalysisResult, getE2EUsageState } = await import("@/lib/e2e-mocks");
    const currentUsage = getE2EUsageState(user.id);
    if (currentUsage.remaining <= 0) return Response.json({ error: "You've used all analyses in your current plan.", code: "PAYWALL" }, { status: 402 });
    if (mockContext.includes("unsafe-test")) return Response.json({ analysisId: "00000000-0000-4000-8000-000000000099", result: { ...e2eAnalysisResult, conversation_status: "unsafe", warning: "This situation needs safety-focused support, not an ordinary dating reply.", replies: e2eAnalysisResult.replies.map((reply) => ({ ...reply, text: "" })) }, remaining: currentUsage.remaining });
    const updatedUsage = consumeE2EUsage(user.id);
    return Response.json({ analysisId: "00000000-0000-4000-8000-000000000099", result: e2eAnalysisResult, remaining: updatedUsage.remaining });
  }
  const admin = createAdminClient();
  if (!admin) return Response.json({ error: "Milo's database connection is not configured yet.", code: "NOT_CONFIGURED" }, { status: 503 });

  const headerStore = await headers();
  const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headerStore.get("x-real-ip") ??
    "unknown";
  let userRate;
  let ipRate: { allowed: boolean } = { allowed: true };
  try {
    [userRate, ipRate] = await Promise.all([
      consumeDistributedRateLimit({
        scope: "analyze_user",
        key: user.id,
        limit: 8,
        windowSeconds: 600,
      }),
      ip === "unknown"
        ? Promise.resolve({ allowed: true })
        : consumeDistributedRateLimit({
            scope: "analyze_ip",
            key: ip,
            limit: 200,
            windowSeconds: 86_400,
          }),
    ]);
  } catch (error) {
    console.error("[api/analyze] rate-limit check failed", { userId: user.id, error: error instanceof Error ? error.name : "Unknown error" });
    return Response.json({ error: "Milo's request protection is temporarily unavailable. Try again shortly.", code: "RATE_LIMIT_UNAVAILABLE" }, { status: 503 });
  }
  if (!userRate.allowed || !ipRate.allowed) return Response.json({ error: "Milo needs a short pause. Try again later.", code: "RATE_LIMIT" }, { status: 429 });

  let usage;
  try {
    usage = await getUsageForUser(user.id);
  } catch (error) {
    console.error("[api/analyze] entitlement check failed", {
      userId: user.id,
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
    return Response.json(
      { error: "Milo could not verify your allowance. Try again shortly.", code: "ENTITLEMENT_UNAVAILABLE" },
      { status: 503 },
    );
  }
  if (usage.remaining <= 0) {
    try {
      await recordAnalyticsEvent(admin, {
        userId: user.id,
        eventName: "paywall_viewed",
        properties: { surface: "analysis_limit" },
        dedupeSource: `analysis_limit:${Math.floor(Date.now() / 3_600_000)}`,
      });
    } catch (error) {
      console.error("[api/analyze] paywall analytics failed", {
        userId: user.id,
        errorType: error instanceof Error ? error.name : "UnknownError",
      });
    }
    return Response.json({ error: "You've used all analyses in your current plan.", code: "PAYWALL" }, { status: 402 });
  }

  let analysisId: string | null = null;
  let imageBuffer: Buffer | null = null;
  try {
    const form = await readFormDataWithinLimit(request, MAX_ANALYZE_BODY_BYTES);
    const parsedForm = analysisFormSchema.safeParse({
      tone: form.get("tone"), relationshipStage: form.get("relationshipStage"), optionalContext: form.get("optionalContext") ?? "",
    });
    if (!parsedForm.success) return Response.json({ error: "Check the selected tone, relationship stage and context.", code: "INVALID_FORM" }, { status: 400 });
    const file = form.get("image");
    if (!(file instanceof File)) return Response.json({ error: "Choose a screenshot first.", code: "IMAGE_REQUIRED" }, { status: 400 });
    const imageError = validateImageFile(file);
    if (imageError) return Response.json({ error: imageError, code: "INVALID_IMAGE" }, { status: 400 });

    const staleCutoff = new Date(Date.now() - 2 * 60_000).toISOString();
    const { error: staleError } = await admin
      .from("analyses")
      .update({ status: "failed" })
      .eq("user_id", user.id)
      .eq("status", "pending")
      .lt("created_at", staleCutoff);
    if (staleError) throw new AnalyzeRouteError("DATABASE_UNAVAILABLE", 503, "Milo could not start the analysis. Try again shortly.");

    const { data: pending, error: insertError } = await admin.from("analyses").insert({ user_id: user.id, selected_tone: parsedForm.data.tone, relationship_stage: parsedForm.data.relationshipStage, optional_context: null, status: "pending", model: env.OPENROUTER_MODEL }).select("id").single();
    if (insertError?.code === "23505") {
      return Response.json(
        { error: "Milo is already analyzing another screenshot for this account.", code: "ANALYSIS_IN_PROGRESS" },
        { status: 409 },
      );
    }
    if (insertError) throw new AnalyzeRouteError("DATABASE_UNAVAILABLE", 503, "Milo could not start the analysis. Try again shortly.");
    analysisId = pending.id;

    if (containsHighRiskContext(parsedForm.data.optionalContext)) {
      const blocked = safetyBlockedResult();
      const { error: blockedError } = await admin.from("analyses").update({ status: "blocked" }).eq("id", analysisId).eq("user_id", user.id);
      if (blockedError) throw new AnalyzeRouteError("DATABASE_UNAVAILABLE", 503, "Milo found a safety concern but could not save the result. Try again shortly.");
      return Response.json({ analysisId, result: blocked, remaining: usage.remaining });
    }

    const sanitized = await sanitizeImage(file);
    imageBuffer = sanitized.buffer;
    const conversationText = await extractConversationText(sanitized.buffer);
    if (containsHighRiskContext(conversationText)) {
      const blocked = safetyBlockedResult();
      const { error: blockedError } = await admin
        .from("analyses")
        .update({ status: "blocked" })
        .eq("id", analysisId)
        .eq("user_id", user.id);
      if (blockedError) {
        throw new AnalyzeRouteError(
          "DATABASE_UNAVAILABLE",
          503,
          "Milo found a safety concern but could not save the result. Try again shortly.",
        );
      }
      return Response.json({ analysisId, result: blocked, remaining: usage.remaining });
    }
    const analyzed = await analyzeWithOpenRouter({ conversationText, ...parsedForm.data });
    if (analyzed.result.conversation_status === "unsafe") {
      const { error: blockedError } = await admin.from("analyses").update({
        status: "blocked",
        model: analyzed.model,
        input_tokens: analyzed.usage.inputTokens,
        output_tokens: analyzed.usage.outputTokens,
        estimated_cost: analyzed.usage.estimatedCost,
      }).eq("id", analysisId).eq("user_id", user.id);
      if (blockedError) throw new AnalyzeRouteError("DATABASE_UNAVAILABLE", 503, "Milo found a safety concern but could not save the result. Try again shortly.");
      console.info("[api/analyze] blocked", { analysisId, userId: user.id, durationMs: Date.now() - startedAt });
      return Response.json({ analysisId, result: analyzed.result, remaining: usage.remaining });
    }
    const { error: completionError } = await admin.rpc("complete_analysis", {
      p_analysis_id: analysisId,
      p_user_id: user.id,
      p_model: analyzed.model,
      p_input_tokens: analyzed.usage.inputTokens,
      p_output_tokens: analyzed.usage.outputTokens,
      p_estimated_cost: analyzed.usage.estimatedCost,
      p_expected_stripe_price_id: env.STRIPE_PRICE_ID ?? null,
      p_replies: analyzed.result.replies,
    });
    if (completionError) {
      if (completionError.message.includes("allowance")) {
        throw new AnalyzeRouteError("PAYWALL", 402, "You've used all analyses in your current plan.");
      }
      throw new AnalyzeRouteError("DATABASE_UNAVAILABLE", 503, "Milo generated replies but could not save them. Your allowance was not consumed; try again shortly.");
    }
    console.info("[api/analyze] completed", { analysisId, userId: user.id, status: analyzed.result.conversation_status, durationMs: Date.now() - startedAt });
    return Response.json({ analysisId, result: analyzed.result, remaining: Math.max(0, usage.remaining - 1) });
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error, "The prepared screenshot is too large to upload safely.");
    if (bodyError) return bodyError;
    if (analysisId) {
      const { error: failedStatusError } = await admin
        .from("analyses")
        .update({ status: "failed" })
        .eq("id", analysisId)
        .eq("user_id", user.id);
      if (failedStatusError) {
        console.error("[api/analyze] failed-status persistence failed", {
          analysisId,
          userId: user.id,
          errorType: failedStatusError.code ?? "DatabaseError",
        });
      }
    }
    console.error("[api/analyze] failed", {
      analysisId,
      userId: user.id,
      errorType: error instanceof Error ? error.name : "UnknownError",
      errorCode: error instanceof OpenRouterAnalysisError || error instanceof AnalyzeRouteError ? error.code : "UNEXPECTED",
      durationMs: Date.now() - startedAt,
    });
    if (error instanceof ImageProcessingError) {
      return Response.json({ error: error.message, code: "INVALID_IMAGE" }, { status: 422 });
    }
    if (error instanceof OcrProcessingError) {
      const message = error.code === "OCR_UNCLEAR"
        ? "Milo could not read enough conversation text. Try a sharper screenshot with the message bubbles visible."
        : error.code === "OCR_TIMEOUT"
          ? "Milo took too long to read that screenshot. Try a smaller or clearer image."
          : "Milo's screenshot reader is temporarily unavailable. Try again shortly.";
      return Response.json({ error: message, code: error.code }, { status: error.status });
    }
    if (error instanceof OpenRouterAnalysisError) {
      const message = error.code === "PROVIDER_TIMEOUT"
        ? "Milo's reply service took too long. Try again in a moment."
        : error.code === "INVALID_MODEL_OUTPUT"
          ? "Milo received an invalid reply format. Your allowance was not consumed; try again."
          : "Milo's reply service is temporarily unavailable. Try again shortly.";
      return Response.json({ error: message, code: error.code }, { status: error.status });
    }
    if (error instanceof AnalyzeRouteError) {
      return Response.json({ error: error.clientMessage, code: error.code }, { status: error.status });
    }
    return Response.json(
      { error: "Milo could not complete the analysis. Your allowance was not consumed; try again shortly.", code: "ANALYSIS_FAILED" },
      { status: 500 },
    );
  } finally {
    imageBuffer?.fill(0);
  }
}
