import "server-only";

import { createHmac } from "node:crypto";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export type DistributedRateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

type RateLimitRow = {
  allowed: boolean;
  remaining: number;
  reset_at: string;
};

/**
 * Atomically consumes a fixed-window rate-limit token in Postgres. The raw
 * user/IP key never leaves the application process; only its keyed HMAC digest is
 * persisted. Database failures intentionally throw so callers can fail closed
 * before spending money on an AI request.
 */
export async function consumeDistributedRateLimit(input: {
  scope: string;
  key: string;
  limit?: number;
  windowSeconds?: number;
}): Promise<DistributedRateLimitResult> {
  const limit = input.limit ?? 8;
  const windowSeconds = input.windowSeconds ?? 10 * 60;

  if (!/^[a-z0-9:_-]{1,64}$/.test(input.scope)) {
    throw new Error("Invalid distributed rate-limit scope.");
  }
  if (!input.key || limit < 1 || limit > 1000 || windowSeconds < 1 || windowSeconds > 86_400) {
    throw new Error("Invalid distributed rate-limit configuration.");
  }

  const admin = createAdminClient();
  if (!admin) throw new Error("Distributed rate limiting is not configured.");
  if (!env.RATE_LIMIT_HASH_SECRET) {
    throw new Error("Distributed rate-limit hashing is not configured.");
  }

  const keyHash = createHmac("sha256", env.RATE_LIMIT_HASH_SECRET)
    .update(input.key)
    .digest("hex");
  const { data, error } = await admin.rpc("consume_rate_limit", {
    p_scope: input.scope,
    p_key_hash: keyHash,
    p_limit: Math.trunc(limit),
    p_window_seconds: Math.trunc(windowSeconds),
  });

  if (error) throw new Error("Distributed rate-limit check failed.");
  const row = (Array.isArray(data) ? data[0] : data) as RateLimitRow | null;
  if (!row || typeof row.allowed !== "boolean" || !Number.isFinite(row.remaining)) {
    throw new Error("Distributed rate-limit response was invalid.");
  }

  const resetAt = Date.parse(row.reset_at);
  if (!Number.isFinite(resetAt)) throw new Error("Distributed rate-limit reset time was invalid.");

  return {
    allowed: row.allowed,
    remaining: Math.max(0, row.remaining),
    resetAt,
  };
}
