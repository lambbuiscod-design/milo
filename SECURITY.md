# Milo security policy

Milo handles private conversation screenshots, so security and data minimization are release requirements. This document describes implemented controls and the external controls that must be configured before production. It is not a claim that the service is unhackable or independently certified.

## Reporting a vulnerability

Do not disclose a suspected vulnerability in a public issue. After this folder is published as its own GitHub repository, enable GitHub Private Vulnerability Reporting and use **Security → Report a vulnerability**. The repository owner must configure a private fallback contact before accepting production users.

Include the affected route or component, reproduction steps, impact, and any safe proof of concept. Do not access other users' data, run denial-of-service tests, or retain screenshots or secrets encountered during testing.

## Implemented application controls

- Supabase sessions are validated server-side; privileged database and Stripe operations use server-only credentials.
- Users who enroll TOTP are gated at Supabase AAL2 across protected pages and APIs; restrictive RLS policies also deny their AAL1 tokens direct Data API reads.
- Cookie-authenticated mutation routes require an exact same-origin `Origin` and reject cross-site Fetch Metadata.
- Stripe webhooks are exempt from browser-origin checks and instead require Stripe's raw-body signature plus idempotent event receipts.
- JSON, multipart uploads, and webhook bodies are read through hard byte limits, including chunked bodies without `Content-Length`.
- Screenshot MIME, byte size, decoded dimensions, and pixel count are validated. Images are re-encoded without metadata, never written to persistent storage, and temporary buffers are cleared when practical.
- A per-request CSP nonce with `strict-dynamic` protects scripts; clickjacking, MIME-sniffing, referrer, browser-feature, HSTS, and private-cache headers are also configured.
- Model output is constrained and schema-validated. Screenshot text is treated as untrusted prompt content.
- RLS and explicit database grants isolate user rows; subscription and usage mutations are server-controlled.
- Logs contain operational identifiers and error classes, not screenshot bodies, extracted conversations, generated replies, API keys, Stripe signatures, or raw webhook bodies.
- Production cannot enable the local E2E identity or reset behavior because `MILO_E2E_MODE` is disabled whenever `NODE_ENV=production`.
- The lockfile is committed, vulnerable transitive versions are overridden, and CI runs dependency audit, lint, type checks, tests, Dependabot, and CodeQL.

## Production release gates

These controls live outside the source tree and must be verified for every environment:

1. Store OpenRouter, Supabase secret, and Stripe secrets only in encrypted Vercel environment variables. Scope them to the required environments and rotate any value ever pasted into chat, logs, source control, or screenshots.
2. In Supabase Auth, allow only the exact production callback URL, configure custom SMTP on a verified Milo sending domain, verify SPF/DKIM and DMARC alignment, enable abuse-resistant email rate limits and CAPTCHA, keep access-token lifetime short, and enable leaked-password/session protections where available. Test inbox delivery and the complete magic-link callback with multiple mailbox providers; an HTTP 200 from the send request is not delivery evidence.
3. Magic-link authentication alone proves access to one email account and must not be described as MFA. Verify Milo's TOTP enrollment, backup-factor, AAL2 challenge, removal, page/API gate and RLS behavior with real non-production accounts before claiming the two-step feature is operational.
4. Configure Stripe's production webhook URL, pin the expected event types, verify the signing secret, configure the Customer Portal, and rehearse signing-secret rotation.
5. Enable Vercel Firewall protections, bot/rate controls for `/login`, `/api/analyze`, and billing mutations, deployment protection for non-production environments, and log redaction. Enable privacy-reviewed runtime error monitoring and the scheduled public production smoke. Alert on sustained 401/403/429/5xx spikes, authentication-email failures, analysis timeouts, webhook failures and abnormal provider spend.
6. Enable GitHub branch protection, required `Security and quality gates` and `CodeQL` checks, secret scanning with push protection, Dependabot security updates, and Private Vulnerability Reporting. The files under `.github/` activate only after Milo is published as its own repository.
7. Use HTTPS only, verify the CSP in report tooling and browser console, confirm HSTS on the production hostname, and retest OAuth/magic-link, upload, Checkout, Portal, webhook, and deletion flows after every policy change.
8. Define incident owners, breach-notification obligations, backup/restore testing, log retention, and deletion SLAs before handling real user data. Privacy Policy and Terms require legal review.

## Deployment and monitoring evidence

Before marking a release production-ready, retain a private release record containing:

- the Git commit and Vercel deployment IDs, final HTTPS origin, certificate check and rollback target;
- passing required GitHub checks, optimized production build, production Playwright suite and manual **Production smoke** run;
- the exact environment names configured in Vercel, without copying their secret values into the record;
- Supabase migration parity, Auth callback allowlist, custom-SMTP sender domain and mailbox-delivery test date;
- Stripe mode, price ID, webhook endpoint/event list and a successful test lifecycle;
- monitoring owner, alert destinations, error-retention/redaction settings and the most recent synthetic-check result;
- confirmation that Privacy and Terms no longer contain `Replace before launch` text and have completed qualified review.

The public synthetic workflow is deliberately credential-free. It proves only HTTPS/public-surface availability, expected security headers, legal-page publication and anonymous route protection. It does not prove email delivery, database access, AI generation, payments, MFA or deletion; those require the credentialed integration run above.

## Routine verification

Run at least:

```bash
pnpm install --frozen-lockfile
pnpm audit --prod --audit-level moderate
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
pnpm test:e2e:production
pnpm smoke:openrouter
MILO_PRODUCTION_URL=https://milo.example pnpm smoke:production
```

Review Supabase security advisors, Stripe webhook failures, Vercel security events, dependency alerts, and CodeQL findings before each release and weekly while production is active.
