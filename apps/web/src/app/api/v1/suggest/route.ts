import { headers } from "next/headers";
import { containsHighRiskContext } from "@milo/security";
import { isE2EMode } from "@/lib/runtime-mode";
import { env } from "@/lib/env";
import { authenticateDesktopRequest, desktopAuthFailure } from "@/lib/desktop-auth";
import { desktopSuggestionRequestSchema, desktopSuggestionResponseSchema, type DesktopSuggestionRequest } from "@/lib/desktop-suggestion-contract";
import { createAdminClient } from "@/lib/supabase/admin";
import { consumeDistributedRateLimit } from "@/lib/supabase/rate-limit";
import { readJsonWithinLimit, requestBodyErrorResponse } from "@/lib/http-security";
import { getUsageForUser } from "@/lib/usage";
import { OpenRouterAnalysisError, suggestWithOpenRouter } from "@/lib/openrouter";

export const runtime = "nodejs";
export const maxDuration = 45;

const MAX_BODY_BYTES = 16 * 1024;

function privateJson(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      Pragma: "no-cache",
    },
  });
}

function failure(message: string, code: string, status: number) {
  return privateJson({ error: message, code }, status);
}

function safetyResult(requestId: string, remaining: number) {
  return desktopSuggestionResponseSchema.parse({
    requestId,
    conversationStatus: "unsafe",
    detectedLanguage: "Unknown",
    briefContext: "This conversation requires a safety-first response.",
    warning: "Milo cannot help create coercive, threatening, exploitative or self-harm-related messages. If anyone may be in immediate danger, contact local emergency services or a trusted professional.",
    replies: ["safe", "confident", "playful"].map((category) => ({
      category,
      text: "",
      whyItWorks: "Ordinary dating suggestions are disabled for this safety-sensitive situation.",
    })),
    remaining,
  });
}

function normalizeProviderResult(requestId: string, remaining: number, result: Awaited<ReturnType<typeof suggestWithOpenRouter>>["result"]) {
  return desktopSuggestionResponseSchema.parse({
    requestId,
    conversationStatus: result.conversation_status,
    detectedLanguage: result.detected_language,
    briefContext: result.brief_context,
    warning: result.warning,
    replies: result.replies.map((reply) => ({
      category: reply.category,
      text: reply.text,
      whyItWorks: reply.why_it_works,
    })),
    remaining,
  });
}

function getClientIp(request: Request, headerStore: Headers) {
  return headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headerStore.get("x-real-ip") ??
    request.headers.get("cf-connecting-ip") ??
    "unknown";
}

async function markFailed(admin: NonNullable<ReturnType<typeof createAdminClient>>, id: string, userId: string) {
  await admin.from("desktop_suggestions").update({ status: "failed" }).eq("id", id).eq("user_id", userId);
}

export async function POST(request: Request) {
  const auth = await authenticateDesktopRequest(request);
  if (auth.status !== "authorized") return desktopAuthFailure(auth.status);

  if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
    return failure("Milo desktop suggestions accept JSON only.", "JSON_REQUIRED", 415);
  }

  let body: unknown;
  try {
    body = await readJsonWithinLimit(request, MAX_BODY_BYTES);
  } catch (error) {
    return requestBodyErrorResponse(error, "The suggestion request is too large.") ?? failure("The request body is invalid.", "INVALID_REQUEST_BODY", 400);
  }
  const parsed = desktopSuggestionRequestSchema.safeParse(body);
  if (!parsed.success) return failure("The suggestion request is invalid.", "INVALID_REQUEST", 400);
  const input: DesktopSuggestionRequest = parsed.data;
  const joinedText = input.messages.map((message) => message.text).join("\n");

  let remaining: number;
  if (isE2EMode()) {
    const { consumeE2EUsage, e2eAnalysisResult, getE2EUsageState } = await import("@/lib/e2e-mocks");
    const current = getE2EUsageState(auth.user.id);
    if (current.remaining <= 0) return failure("You've used all desktop suggestions in your current plan.", "PAYWALL", 402);
    if (containsHighRiskContext(joinedText)) return privateJson(safetyResult(input.requestId, current.remaining));
    remaining = consumeE2EUsage(auth.user.id).remaining;
    return privateJson(normalizeProviderResult(input.requestId, remaining, e2eAnalysisResult));
  }

  const admin = createAdminClient();
  if (!admin || !env.MILO_DESKTOP_CLIENT_ID) return failure("Milo desktop suggestions are not configured yet.", "NOT_CONFIGURED", 503);

  const headerStore = await headers();
  const ip = getClientIp(request, headerStore);
  try {
    const [userRate, ipRate] = await Promise.all([
      consumeDistributedRateLimit({ scope: "desktop_suggest_user", key: auth.user.id, limit: 20, windowSeconds: 600 }),
      ip === "unknown" ? Promise.resolve({ allowed: true }) : consumeDistributedRateLimit({ scope: "desktop_suggest_ip", key: ip, limit: 100, windowSeconds: 86_400 }),
    ]);
    if (!userRate.allowed || !ipRate.allowed) return failure("Milo needs a short pause. Try again later.", "RATE_LIMIT", 429);
  } catch {
    return failure("Milo's request protection is temporarily unavailable. Try again shortly.", "RATE_LIMIT_UNAVAILABLE", 503);
  }

  let usage;
  try {
    usage = await getUsageForUser(auth.user.id);
  } catch {
    return failure("Milo could not verify your allowance. Try again shortly.", "ENTITLEMENT_UNAVAILABLE", 503);
  }
  if (usage.remaining <= 0) return failure("You've used all desktop suggestions in your current plan.", "PAYWALL", 402);
  if (containsHighRiskContext(joinedText)) return privateJson(safetyResult(input.requestId, usage.remaining));

  const reserve = await admin.rpc("reserve_desktop_suggestion", {
    p_user_id: auth.user.id,
    p_request_id: input.requestId,
    p_selected_tone: input.tone,
    p_relationship_stage: input.relationshipStage,
    p_model: env.OPENROUTER_MODEL,
    p_expected_stripe_price_id: env.STRIPE_PRICE_ID ?? null,
  });
  if (reserve.error) {
    const message = reserve.error.message.toLowerCase();
    if (message.includes("allowance")) return failure("You've used all desktop suggestions in your current plan.", "PAYWALL", 402);
    if (message.includes("progress") || message.includes("request")) return failure("Milo is already preparing a suggestion. Try again shortly.", "SUGGESTION_IN_PROGRESS", 409);
    return failure("Milo could not start the suggestion. Try again shortly.", "SUGGESTION_UNAVAILABLE", 503);
  }
  const reservation = Array.isArray(reserve.data) ? reserve.data[0] : reserve.data;
  const suggestionId = reservation?.suggestion_id;
  if (typeof suggestionId !== "string" || !Number.isInteger(reservation?.remaining)) {
    return failure("Milo could not start the suggestion. Try again shortly.", "SUGGESTION_UNAVAILABLE", 503);
  }

  try {
    const generated = await suggestWithOpenRouter({ messages: input.messages, tone: input.tone, relationshipStage: input.relationshipStage });
    if (generated.result.conversation_status === "unsafe") {
      await admin.from("desktop_suggestions").update({ status: "blocked", model: generated.model, input_tokens: generated.usage.inputTokens, output_tokens: generated.usage.outputTokens, estimated_cost: generated.usage.estimatedCost }).eq("id", suggestionId).eq("user_id", auth.user.id);
      return privateJson(normalizeProviderResult(input.requestId, usage.remaining, generated.result));
    }
    const completed = await admin.rpc("complete_desktop_suggestion", {
      p_suggestion_id: suggestionId,
      p_user_id: auth.user.id,
      p_model: generated.model,
      p_input_tokens: generated.usage.inputTokens,
      p_output_tokens: generated.usage.outputTokens,
      p_estimated_cost: generated.usage.estimatedCost,
      p_expected_stripe_price_id: env.STRIPE_PRICE_ID ?? null,
    });
    if (completed.error || !Number.isInteger(completed.data)) {
      await markFailed(admin, suggestionId, auth.user.id);
      return failure("Milo generated a suggestion but could not update your allowance. Try again shortly.", "SUGGESTION_COMPLETION_FAILED", 503);
    }
    return privateJson(normalizeProviderResult(input.requestId, completed.data, generated.result));
  } catch (error) {
    await markFailed(admin, suggestionId, auth.user.id);
    if (error instanceof OpenRouterAnalysisError) {
      const message = error.code === "PROVIDER_TIMEOUT" ? "Milo's reply service took too long. Try again in a moment." : "Milo's reply service is temporarily unavailable. Try again shortly.";
      return failure(message, error.code, error.status);
    }
    return failure("Milo could not complete the suggestion. Try again shortly.", "SUGGESTION_FAILED", 500);
  }
}
