import { env, hasSupabaseConfig } from "@/lib/env";
import { isRuntimeReady } from "@/lib/health";

export const runtime = "nodejs";

export function GET() {
  const ready = isRuntimeReady({
    openRouterKey: Boolean(env.OPENROUTER_API_KEY),
    rateLimitSecret: Boolean(env.RATE_LIMIT_HASH_SECRET),
    stripePrice: Boolean(env.STRIPE_PRICE_ID),
    stripeSecret: Boolean(env.STRIPE_SECRET_KEY),
    stripeWebhookSecret: Boolean(env.STRIPE_WEBHOOK_SECRET),
    supabaseAdmin: Boolean(env.SUPABASE_SECRET_KEY),
    supabasePublic: hasSupabaseConfig(),
  });
  return Response.json(
    { status: ready ? "ok" : "not_ready" },
    {
      status: ready ? 200 : 503,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
