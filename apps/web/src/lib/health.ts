export type RuntimeReadiness = {
  openRouterKey: boolean;
  rateLimitSecret: boolean;
  stripePrice: boolean;
  stripeSecret: boolean;
  stripeWebhookSecret: boolean;
  supabaseAdmin: boolean;
  supabasePublic: boolean;
};

export function isRuntimeReady(readiness: RuntimeReadiness) {
  return Object.values(readiness).every(Boolean);
}
