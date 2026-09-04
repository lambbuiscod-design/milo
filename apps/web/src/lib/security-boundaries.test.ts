// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import { buildContentSecurityPolicy } from "@/lib/content-security-policy";

const root = resolve(import.meta.dirname, "../..");
const browserMutationRoutes = [
  "src/app/api/analyze/route.ts",
  "src/app/api/feedback/route.ts",
  "src/app/api/events/route.ts",
  "src/app/api/billing/checkout/route.ts",
  "src/app/api/billing/portal/route.ts",
  "src/app/api/account/delete/route.ts",
];

describe("production security boundaries", () => {
  it("guards every cookie-authenticated browser mutation against CSRF", () => {
    for (const route of browserMutationRoutes) {
      const source = readFileSync(resolve(root, route), "utf8");
      expect(source, route).toContain("rejectCrossOriginMutation(request)");
    }
  });

  it("keeps the Stripe webhook on raw signed and bounded body verification", () => {
    const source = readFileSync(
      resolve(root, "src/app/api/webhooks/stripe/route.ts"),
      "utf8",
    );
    expect(source).toContain("readTextWithinLimit(request, 1_000_000)");
    expect(source).toContain("stripe.webhooks.constructEvent(rawBody, signature");
    expect(source).not.toContain("rejectCrossOriginMutation(request)");
    expect(source).not.toContain("request.text()");
  });

  it("removes the Stripe customer before deleting application identity data", () => {
    const source = readFileSync(
      resolve(root, "src/app/api/account/delete/route.ts"),
      "utf8",
    );
    const customerDeletion = source.indexOf("stripe.customers.del");
    const identityDeletion = source.indexOf("admin.auth.admin.deleteUser");
    expect(customerDeletion).toBeGreaterThan(-1);
    expect(identityDeletion).toBeGreaterThan(customerDeletion);
  });

  it("prevents concurrent model spend for the same account", () => {
    const source = readFileSync(
      resolve(root, "src/app/api/analyze/route.ts"),
      "utf8",
    );
    expect(source).toContain('insertError?.code === "23505"');
    expect(source).toContain('code: "ANALYSIS_IN_PROGRESS"');
    expect(source).toContain('scope: "analyze_user"');
    expect(source).toContain('scope: "analyze_ip"');
  });

  it("sets browser hardening and private API cache headers", async () => {
    const rules = await nextConfig.headers?.();
    expect(nextConfig.poweredByHeader).toBe(false);
    expect(rules).toBeDefined();

    const globalHeaders = new Map(
      rules?.find((rule) => rule.source === "/:path*")?.headers.map((header) => [
        header.key,
        header.value,
      ]),
    );
    expect(globalHeaders.get("X-Content-Type-Options")).toBe("nosniff");
    expect(globalHeaders.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");

    const apiHeaders = new Map(
      rules?.find((rule) => rule.source === "/api/:path*")?.headers.map((header) => [
        header.key,
        header.value,
      ]),
    );
    expect(apiHeaders.get("Cache-Control")).toContain("no-store");
    expect(apiHeaders.get("Content-Security-Policy")).toContain("default-src 'none'");
  });

  it("uses a per-request strict script nonce without unsafe-inline scripts", () => {
    const nonce = "dGVzdC1ub25jZS0xMjM0NTY3ODkw";
    const productionPolicy = buildContentSecurityPolicy(nonce, false);
    const scriptDirective = productionPolicy
      .split("; ")
      .find((directive) => directive.startsWith("script-src "));

    expect(scriptDirective).toContain(`'nonce-${nonce}'`);
    expect(scriptDirective).toContain("'strict-dynamic'");
    expect(scriptDirective).not.toContain("'unsafe-inline'");
    expect(scriptDirective).not.toContain("'unsafe-eval'");
    expect(productionPolicy).toContain("script-src-attr 'none'");
    expect(productionPolicy).toContain("upgrade-insecure-requests");
    expect(productionPolicy).toContain("style-src 'self' 'unsafe-inline'");
    expect(productionPolicy).not.toContain("style-src-elem");

    const developmentPolicy = buildContentSecurityPolicy(nonce, true);
    expect(developmentPolicy).toContain("'unsafe-eval'");
    expect(developmentPolicy).not.toContain("upgrade-insecure-requests");
    expect(() => buildContentSecurityPolicy("too-short", false)).toThrow("Invalid CSP nonce");

    const proxySource = readFileSync(resolve(root, "src/proxy.ts"), "utf8");
    expect(proxySource).toContain('requestHeaders.set("x-nonce", nonce)');
    expect(proxySource).toContain('response.headers.set("Content-Security-Policy"');
  });

  it("keeps optional context ephemeral and free credits separate from paid usage", () => {
    const analyze = readFileSync(resolve(root, "src/app/api/analyze/route.ts"), "utf8");
    const usage = readFileSync(resolve(root, "src/lib/usage.ts"), "utf8");
    expect(analyze).toContain("optional_context: null");
    expect(analyze).not.toContain("optional_context: parsedForm.data.optionalContext");
    expect(usage).toContain('.from("usage_periods")');
    expect(usage).toContain('"1970-01-01T00:00:00.000Z"');
  });

  it("promotes adult confirmation through a signed first-party proof only", () => {
    const eligibility = readFileSync(resolve(root, "src/lib/auth-eligibility.ts"), "utf8");
    const login = readFileSync(resolve(root, "src/app/login/actions.ts"), "utf8");
    const callback = readFileSync(resolve(root, "src/app/auth/callback/route.ts"), "utf8");
    expect(eligibility).toContain("user.app_metadata?.adult_confirmed === true");
    expect(eligibility).not.toContain("user_metadata");
    expect(login).toContain("createAdultAttestation(email");
    expect(login).not.toContain("data: { adult_confirmed: true }");
    expect(callback).toContain("verifyAdultAttestation(");
    expect(callback).toContain("admin.auth.admin.updateUserById(");
  });

  it("screens OCR transcript safety before ordinary model generation", () => {
    const analyze = readFileSync(resolve(root, "src/app/api/analyze/route.ts"), "utf8");
    const ocr = analyze.indexOf("extractConversationText(sanitized.buffer)");
    const transcriptSafety = analyze.indexOf("containsHighRiskContext(conversationText)");
    const provider = analyze.indexOf("analyzeWithOpenRouter({ conversationText");
    expect(ocr).toBeGreaterThan(-1);
    expect(transcriptSafety).toBeGreaterThan(ocr);
    expect(provider).toBeGreaterThan(transcriptSafety);
  });
});
