// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = resolve(import.meta.dirname, "../..");
const routeSource = readFileSync(resolve(webRoot, "src/app/api/v1/suggest/route.ts"), "utf8");
const authSource = readFileSync(resolve(webRoot, "src/lib/desktop-auth.ts"), "utf8");
const migrationSource = readFileSync(resolve(webRoot, "../../supabase/migrations/20260829090000_desktop_suggestions.sql"), "utf8");

describe("desktop suggestion server boundary", () => {
  it("uses bearer auth and rejects image/multipart paths", () => {
    expect(routeSource).toContain("authenticateDesktopRequest(request)");
    expect(authSource).toContain('get("authorization")');
    expect(authSource).toContain("Bearer");
    expect(authSource).toContain("getClaims(accessToken)");
    expect(routeSource).toContain('application/json');
    expect(routeSource).not.toContain("readFormDataWithinLimit");
    expect(routeSource).not.toContain("File");
    expect(routeSource).not.toContain("image");
  });

  it("keeps provider output and conversation text out of persistence/logging", () => {
    expect(routeSource).toContain("suggestWithOpenRouter");
    expect(routeSource).toContain("complete_desktop_suggestion");
    expect(routeSource).not.toContain("console.log");
    expect(routeSource).not.toContain("console.error");
    expect(routeSource).not.toContain("p_replies");
    expect(migrationSource).toContain("create table public.desktop_suggestions");
    expect(migrationSource).not.toContain("reply_text");
    expect(migrationSource).not.toContain("conversation_text");
    expect(migrationSource).not.toContain("transcript");
  });

  it("uses strict structured validation, rate limits, and server-owned quota RPCs", () => {
    expect(routeSource).toContain("desktopSuggestionRequestSchema.safeParse");
    expect(routeSource).toContain("desktopSuggestionResponseSchema.parse");
    expect(routeSource).toContain('scope: "desktop_suggest_user"');
    expect(routeSource).toContain('scope: "desktop_suggest_ip"');
    expect(routeSource).toContain('p_expected_stripe_price_id');
    expect(migrationSource).toContain("revoke all on public.desktop_suggestions");
    expect(migrationSource).toContain("grant execute on function public.reserve_desktop_suggestion");
    expect(migrationSource).toContain("grant execute on function public.complete_desktop_suggestion");
    expect(migrationSource).toContain("created_at < now() - interval '2 minutes'");
  });
});
