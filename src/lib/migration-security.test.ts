// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationDirectory = join(process.cwd(), "supabase/migrations");
const migration = readdirSync(migrationDirectory)
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => readFileSync(join(migrationDirectory, file), "utf8"))
  .join("\n");

describe("Supabase migration security", () => {
  it("enables RLS on every exposed application table", () => {
    for (const table of ["profiles", "subscriptions", "analyses", "replies", "feedback", "usage_periods", "analytics_events", "stripe_events"]) {
      expect(migration).toContain(`alter table public.${table} enable row level security;`);
    }
  });
  it("restricts ownership policies with auth.uid", () => {
    expect(migration).toMatch(/Users read own analyses[\s\S]+auth\.uid\(\)/);
    expect(migration).toMatch(/Users read own replies[\s\S]+analyses\.user_id = \(select auth\.uid\(\)\)/);
  });
  it("allows only the service role to run atomic completion", () => {
    expect(migration).toMatch(/revoke all on function public\.complete_analysis[\s\S]+from public, anon, authenticated/);
    expect(migration).toMatch(/grant execute on function public\.complete_analysis[\s\S]+to service_role/);
  });
  it("binds paid entitlement to the configured Stripe price and active period", () => {
    expect(migration).toContain("p_expected_stripe_price_id text default null");
    expect(migration).toContain("stripe_price_id = p_expected_stripe_price_id");
    expect(migration).toContain("current_period_start <= now()");
    expect(migration).toContain("current_period_end > now()");
  });
  it("deletes all user-linked analytics when the profile is deleted", () => {
    expect(migration).toMatch(/analytics_events_user_id_fkey[\s\S]+references public\.profiles\(id\) on delete cascade/);
  });
  it("keeps analytics privacy-bounded and database-authoritative", () => {
    expect(migration).toContain("analytics_events_properties_contract");
    expect(migration).toContain("analytics_events_dedupe_key_is_opaque");
    expect(migration).toContain("analytics_events_dedupe_key_idx");
    expect(migration).toMatch(/record_analysis_analytics[\s\S]+after insert or update of status on public\.analyses/);
    expect(migration).toMatch(/record_feedback_analytics[\s\S]+after insert on public\.feedback/);
    expect(migration).toMatch(/record_subscription_analytics[\s\S]+after insert or update of status, stripe_subscription_id, cancel_at_period_end[\s\S]+on public\.subscriptions/);
    expect(migration).toMatch(/revoke all on table public\.analytics_events from public, anon, authenticated/);
  });
  it("keeps distributed rate-limit state private and service-only", () => {
    expect(migration).toContain("create table private.rate_limit_windows");
    expect(migration).toContain("key_hash ~ '^[0-9a-f]{64}$'");
    expect(migration).toMatch(/revoke all on function public\.consume_rate_limit[\s\S]+from public, anon, authenticated/);
    expect(migration).toMatch(/grant execute on function public\.consume_rate_limit[\s\S]+to service_role/);
  });
  it("allows only one live model analysis per user", () => {
    expect(migration).toMatch(/create unique index analyses_one_pending_per_user_idx[\s\S]+on public\.analyses \(user_id\)[\s\S]+where status = 'pending'/);
    expect(migration).toContain("created_at < now() - interval '2 minutes'");
  });
  it("prevents optional conversation context from being retained", () => {
    expect(migration).toContain("analyses_optional_context_is_ephemeral");
    expect(migration).toContain("check (optional_context is null)");
  });
  it("computes admin aggregates server-side without PostgREST row truncation", () => {
    expect(migration).toContain("create function public.get_admin_metrics");
    expect(migration).toContain("count(distinct user_id)");
    expect(migration).toContain("sum(estimated_cost)");
    expect(migration).toMatch(/revoke all on function public\.get_admin_metrics\(text\)[\s\S]+from public, anon, authenticated/);
    expect(migration).toMatch(/grant execute on function public\.get_admin_metrics\(text\)[\s\S]+to service_role/);
  });
  it("explicitly grants authenticated users read-only Data API access", () => {
    expect(migration).toMatch(/revoke all on table[\s\S]+from anon, authenticated/);
    expect(migration).toMatch(/grant select on table[\s\S]+to authenticated/);
    expect(migration).not.toMatch(/grant (?:insert|update|delete|all)[^;]+to authenticated/i);
  });
  it("requires AAL2 reads after a user enrolls a verified MFA factor", () => {
    for (const table of ["profiles", "subscriptions", "analyses", "replies", "feedback", "usage_periods"]) {
      expect(migration).toMatch(new RegExp(`on public\\.${table}[\\s\\S]+?as restrictive[\\s\\S]+?auth\\.mfa_factors`));
    }
    expect(migration).toContain("coalesce((select auth.jwt())->>'aal', 'aal1')");
    expect(migration).toContain("status = 'verified'");
  });
  it("looks up MFA factors through a current-user-only definer helper", () => {
    expect(migration).toMatch(/create function private\.user_has_verified_mfa\(\)[\s\S]+stable[\s\S]+security definer[\s\S]+set search_path = ''/);
    expect(migration).toMatch(/from auth\.mfa_factors[\s\S]+user_id = \(select auth\.uid\(\)\)/);
    expect(migration).toMatch(/revoke all on function private\.user_has_verified_mfa\(\)[\s\S]+from public, anon, authenticated/);
    expect(migration).toMatch(/grant execute on function private\.user_has_verified_mfa\(\)[\s\S]+to authenticated/);
    expect(migration).toMatch(/alter policy "MFA protects profile reads"[\s\S]+private\.user_has_verified_mfa\(\)/);
  });
});
