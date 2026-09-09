# Milo

For pinned tool setup, reproducible native packaging and the distinction
between local verification and production approval, read [the release contract](docs/RELEASE.md).

Milo is evolving into a privacy-first Windows desktop companion while preserving the existing screenshot-based web coach. The website remains the account, authentication, billing and cloud/API control plane. The Windows companion is delivered incrementally under the approved plan in `docs/exec-plans/active/windows-p0.md`.

Milo never stores uploaded screenshots or extracted original conversations. Images are validated, sanitized in memory and read by private in-process OCR. Only the temporary OCR transcript and optional context are sent to OpenRouter; image and transcript buffers are cleared when practical. Milo never sends messages automatically.

## Stack

- Next.js 16 App Router, React 19, TypeScript and Tailwind CSS 4
- Supabase Auth, Postgres and Row Level Security
- Private in-process Tesseract OCR with bundled English language data, followed by OpenRouter `deepseek/deepseek-v4-flash-0731` with strict JSON schema plus Zod validation
- Stripe Checkout, Customer Portal and verified/idempotent webhooks
- Vitest, Testing Library and Playwright
- Vercel-compatible Node.js route handlers
- pnpm workspace packages for shared contracts, pure AI helpers, security rules and synthetic fixtures

## Repository layout

```text
apps/web                 Next.js website and server/API control plane
packages/contracts       Shared Zod schemas and types
packages/ai              Pure provider serialization/normalization helpers
packages/security        Pure safety policy and deterministic checks
packages/test-fixtures   Synthetic-only evaluation fixtures
supabase                 Additive migrations and pgTAP security tests
e2e/web                  Mocked and optimized-production browser tests
docs                     Architecture, invariants, decisions and execution plans
```

The Electron desktop shell is implemented under `apps/desktop`; Windows-native extraction remains a later phase under `native/windows`.

## Local setup

Requirements: Node.js 24.19.0 and pnpm 10.34.5. Native Windows development will additionally require the .NET 10.0.302 SDK when that project lands.

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local
pnpm dev
```

To open the complete mocked product flow without email, database or Stripe setup, run:

```bash
pnpm preview:local
```

Then open `http://127.0.0.1:3101`. This command enables Milo's local-only test identity, AI and billing path. Production builds reject this mode; never use it for a preview or production deployment.

On Windows, copy `apps/web/.env.example` to `apps/web/.env.local` in File Explorer or open `apps/web/.env.local` with Notepad. Never paste secret keys into chat, source code or terminal command history.

The public demo at `/demo` uses a fixed fictional conversation and makes no AI request.

## OpenRouter

1. Create an inference key at OpenRouter and add credits or a suitable limit.
2. Set `OPENROUTER_API_KEY` in `apps/web/.env.local`.
3. Set `OPENROUTER_MODEL=deepseek/deepseek-v4-flash-0731`. Milo pins this model so deployments cannot silently drift to a different model.
4. Set `OPENROUTER_PROVIDER_ALLOWLIST` to the comma-separated provider IDs reviewed for privacy and structured-output support. Milo fails closed when this list is empty; it never uses unrestricted provider fallback.
   This endpoint accepts text, so Milo first extracts the visible screenshot text inside the server process. The temporary OCR transcript is sent to DeepSeek for analysis, but is never written to the database, logs, or analytics.
5. Keep the key server-side; never prefix it with `NEXT_PUBLIC_`.

The analysis route does not send screenshot files to OpenRouter. It requests zero-data-retention routing and denies providers that collect prompts; OpenRouter/provider policy and endpoint availability must still be reviewed before launch.

## Desktop suggestion API

The Windows client will call `/api/v1/suggest` with an HTTPS bearer access token, the configured `x-milo-client-id`, and JSON containing up to eight normalized messages (4,000 Unicode characters total), a tone, relationship stage, client version, and opaque request ID. The route rejects multipart/image input, requires an AAL2 eligible account, applies distributed user/IP limits, and returns three validated suggestions without storing transcript or reply text. Configure `MILO_DESKTOP_CLIENT_ID` to the registered public desktop OAuth client ID and apply the additive `desktop_suggestions` migration before enabling the client.

## Supabase

1. Create a Supabase project.
2. In the project **Connect** dialog, copy the Project URL and publishable key into:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
3. Create/copy a new Supabase secret key into `SUPABASE_SECRET_KEY`. It is server-only and bypasses RLS; never expose it to the browser.
4. Generate a separate random value of at least 32 characters for `RATE_LIMIT_HASH_SECRET`. Milo uses it only to HMAC pseudonymous rate-limit keys; keep it server-side and stable across deployments.
5. Link the CLI and apply migrations:

```bash
pnpm dlx supabase@latest login
pnpm dlx supabase@latest link --project-ref YOUR_PROJECT_REF
pnpm dlx supabase@latest db push
pnpm dlx supabase@latest migration list
```

6. In **Authentication → URL Configuration**, set the Site URL to `http://localhost:3000` locally and add `http://localhost:3000/auth/callback` as an allowed redirect. Add the production Vercel URLs before deployment.
7. Keep email magic links enabled. In the project Auth MFA settings, keep TOTP enrollment, challenge and verification enabled.
8. For production, enable Supabase security-notification email templates for MFA enrollment and removal when that feature is available for your project.

### Supabase OAuth authorization path

The Windows client is a public OAuth client and does not contain a client secret. Register one public Supabase OAuth client per environment with an exact loopback callback, then set:

- `MILO_DESKTOP_CLIENT_ID` to that registered client ID.
- `MILO_DESKTOP_REDIRECT_URI` to the exact callback, for example `http://127.0.0.1:43821/oauth/callback`.

Enable the Supabase OAuth 2.1 server and set its authorization URL path to `/oauth/consent`. Supabase sends the browser to Milo’s first-party consent page with a bounded `authorization_id`. If the user is not signed in, Milo carries only that internal consent destination through the magic-link callback; after sign-in, an eligible adult must complete MFA at AAL2 before the request can be approved. The page displays the registered client and the allowlisted `openid`, `email` and `profile` scopes, with explicit **Approve** and **Deny** actions.

Milo calls Supabase Auth JS `getAuthorizationDetails`, `approveAuthorization` or `denyAuthorization` with browser redirects disabled, then validates the returned one-time-code/error URL against the exact registered loopback origin and path before navigating. It never renders tokens, accepts arbitrary `next` URLs, stores authorization requests, or logs authorization IDs, callback URLs or user content. Configure the OAuth client and callback in each Supabase environment before enabling desktop sign-in; the route fails closed when either Milo OAuth environment variable is missing.

### Production email delivery gate

The default Supabase mail service is suitable for initial development, not a public launch. Before inviting external users:

1. Choose a transactional-email provider and verify a dedicated sending domain that Milo controls.
2. Publish and verify the provider's SPF and DKIM records. Publish a DMARC policy and monitor alignment and complaint reports.
3. Configure the provider's SMTP credentials in Supabase Auth. Store them only in Supabase, never in Milo's repository or Vercel client-visible variables.
4. Use a recognizable sender name and monitored reply/support address. Keep magic-link templates free of tracking pixels and unnecessary personal data.
5. Configure Supabase email rate limits and CAPTCHA/abuse controls before increasing traffic.
6. Send real non-production magic links to at least Gmail, Outlook and one additional mailbox provider. Confirm inbox placement, the exact HTTPS callback host, one-time use, expiration, and the generic success/error experience.
7. Enable provider alerts for bounces, blocks and complaint-rate spikes. Record the tested sender domain, date and owner in the private release record.

Do not claim that login is production-ready until this gate is complete. A successful API response from Supabase proves only that the request was accepted, not that the email reached the user.

Magic links are passwordless single-factor authentication. They must not be described as MFA. See [SECURITY.md](./SECURITY.md) for the AAL2 MFA release gate and Supabase dashboard controls.

The migration creates profiles, subscriptions, analyses, replies, feedback, usage periods, analytics events and Stripe event receipts. Every exposed table has RLS. Users receive read access only to their owned records; trusted server routes perform writes. The `complete_analysis` function atomically rechecks and consumes the allowance after a successful model response.

### Two-step verification

Signed-in users can enroll one or more TOTP authenticator factors from `/account`. The QR code, setup secret and six-digit verification code exist only in the browser component while setup is open and are sent directly to Supabase Auth. Milo does not send them through its own API, put them in analytics or store them in the application database.

After a user verifies a factor, Milo requires an AAL2 session for the dashboard, admin page, billing, analyses, feedback, analytics and account deletion. Restrictive RLS policies also prevent an enrolled account's AAL1 token from reading Milo records directly through the Data API. Removing a verified factor requires AAL2 and refreshes the session immediately.

Supabase does not provide recovery codes for TOTP. Tell users to add a backup authenticator on a separate device or securely store a backup setup key. Test enrollment, sign-out, magic-link sign-in, `/mfa` challenge, backup-factor selection and removal with a real non-production account before launch.

## Stripe

1. Start in Stripe test mode.
2. Create a product named **Milo Plus** with a recurring monthly price of **€5.99**.
3. Copy its `price_...` value to `STRIPE_PRICE_ID` and the test secret key to `STRIPE_SECRET_KEY`.
4. Enable the Customer Portal in Stripe test settings.
   - Allow customers to update payment methods and cancel subscriptions.
   - Keep product switching disabled unless every allowed destination price is intentionally supported by Milo.
5. Forward local webhooks:

```bash
stripe login
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

6. Copy the displayed `whsec_...` value to `STRIPE_WEBHOOK_SECRET`.
7. Subscribe the production endpoint to:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`

Set the webhook destination API version to `2026-07-29.dahlia`, matching the pinned Stripe SDK version used by this project. Test-mode and live-mode webhook destinations have different `whsec_...` secrets; configure the secret for the same mode as `STRIPE_SECRET_KEY`.

The webhook reads the raw request body, verifies Stripe's signature, claims each event with a retryable processing lease, and records completion before returning success. Duplicate deliveries cannot process concurrently, failed events remain retryable, and the handler retrieves the current Subscription from Stripe so out-of-order deliveries do not apply stale snapshot data.

Before going live, complete a real Stripe test-mode lifecycle: start two simultaneous Checkout requests (only one subscription should be created), complete Checkout, confirm Milo Plus appears after the webhook, open the Customer Portal, schedule cancellation, and verify access ends only after Stripe reports the subscription period/status change.

## Admin metrics

Set `ADMIN_EMAILS` to a comma-separated allowlist. `/admin` shows aggregate usage, conversion, MRR and cost metrics only. It never displays screenshots, original conversations or generated reply text.

## Tests and verification

```bash
pnpm audit --prod --audit-level moderate
pnpm typecheck
pnpm lint
pnpm test
pnpm exec playwright install chromium
pnpm test:e2e
pnpm build
pnpm test:e2e:production
pnpm smoke:openrouter
```

`pnpm test:e2e` starts an isolated `.next-e2e-dev` development server with deterministic mocks for identity, AI and Stripe. Production code rejects the test mode even if `MILO_E2E_MODE` is set. Never set `MILO_E2E_MODE` in Preview or Production.

After `pnpm build`, `pnpm test:e2e:production` starts the actual optimized production server with E2E bypass disabled. It verifies secure headers, dashboard protection, legal pages, the public demo and desktop/360px layouts. `pnpm smoke:openrouter` uses a synthetic image to exercise bundled OCR and the exact pinned OpenRouter model against Milo's production result contract; it never contains real conversation data.

The GitHub database job rebuilds Supabase from all migrations and runs the pgTAP suite. That suite verifies RLS isolation, exactly five lifetime free successes, the sixth rejection, 150 paid successes, the 151st rejection, and paid-period rollover.

For an optional real integration smoke test, configure test Supabase, OpenRouter and Stripe credentials, run `pnpm dev`, sign in with a real email, and analyze a synthetic screenshot containing no personal data.

## Vercel deployment

1. Push the `milo` directory to a private GitHub repository and let `Security and quality gates` plus `CodeQL` pass. Protect `main` with those required checks.
2. Import that repository into Vercel as a Next.js project. Set **Root Directory** to `apps/web`, enable source files outside the Root Directory for workspace packages, use `main` as the production branch and enable preview deployments for pull requests.
3. Add every variable from `apps/web/.env.example` except `MILO_E2E_MODE`; set `NEXT_PUBLIC_APP_URL` to the final HTTPS production origin. Use separate test credentials for Preview and live credentials only for Production.
4. Add the exact production callback URL to Supabase Auth. Add preview callbacks only when they are intentionally protected and use a non-production Supabase project.
5. Add the production Stripe webhook URL and update `STRIPE_WEBHOOK_SECRET` in Vercel. Keep Stripe key, price and webhook secret in the same mode.
6. Deploy a preview, run the automated browser suite against the local production build, and manually inspect the preview before merging.
7. Deploy `main`, wait for Vercel status `READY`, verify the assigned domain and certificate, then set the GitHub Actions repository variable `MILO_PRODUCTION_URL` to the final HTTPS origin.
8. Run the **Production smoke** workflow manually. Its hourly schedule checks public pages, security headers, anonymous dashboard protection and legal-placeholder removal without using user credentials.
9. Complete a real sign-in, MFA, synthetic screenshot analysis, Checkout, webhook entitlement, Portal cancellation and account-deletion test. A green build or public smoke does not replace this credentialed integration test.

Run the same public check from a trusted terminal with:

```bash
MILO_PRODUCTION_URL=https://milo.example pnpm smoke:production
```

On PowerShell, set the variable only for the current terminal session before running `pnpm smoke:production`. Do not put keys or tokens in this public URL variable.

### Production monitoring checklist

- Confirm Vercel build and runtime logs are accessible to the incident owner and contain no screenshot, OCR transcript, generated reply, email address, API key or webhook body.
- Enable Vercel Web Analytics and Speed Insights only with privacy-safe configuration; never attach conversation or generated-reply text to events.
- Configure an error tracker or log drain with source maps and environment/release tagging. Review its data residency, retention and redaction before enabling it.
- Alert on sustained 401, 403, 429 and 5xx rates, analysis timeouts, Stripe webhook failures, Supabase Auth email failures, and abnormal OpenRouter or Stripe spend.
- Keep the hourly **Production smoke** workflow enabled and assign an owner for failed scheduled runs. It intentionally fails while legal launch placeholders remain.
- Verify rollback access and rehearse promoting the last known-good Vercel deployment without changing database migrations.
- Review Vercel security events, Supabase advisors, Stripe webhook delivery, email-provider bounces/complaints, dependency alerts and CodeQL at least weekly.

## Launch checklist

Run `pnpm release:check` before creating a production deployment. It reports missing variable names, Git/Vercel linkage, legal placeholders and worktree state without printing secret values. A passing automated check does not replace the manual SMTP, callback, Stripe lifecycle, legal-review or HTTPS gates below.

- Complete every production release gate in [SECURITY.md](./SECURITY.md). The GitHub security workflows activate only after this folder is published as its own repository.
- Replace the legal placeholders in `/privacy` and `/terms` after qualified review.
- Confirm the selected OpenRouter model/provider's logging and retention settings.
- Configure spend limits in OpenRouter and Stripe webhook alerts.
- Confirm the `consume_rate_limit` migration is deployed; analysis abuse protection fails closed against this distributed Postgres limiter.
- Run Supabase database/security advisors against the linked project.
- Keep screenshots and message text out of analytics and logs.
