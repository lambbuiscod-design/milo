import "server-only";
import Stripe from "stripe";
import { env } from "@/lib/env";

export function getStripe() {
  if (!env.STRIPE_SECRET_KEY) return null;
  return new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: "2026-07-29.dahlia",
    appInfo: { name: "Milo", version: "1.0.0" },
    maxNetworkRetries: 2,
    timeout: 20_000,
    typescript: true,
  });
}
