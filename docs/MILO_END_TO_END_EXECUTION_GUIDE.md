# Milo end-to-end completion guide

Last updated: 2026-09-24

## Purpose

This is the ordered runbook for taking the existing Milo Windows MVP from its current repository state to a controlled, signed public release. It is not a rebuild plan. Each prompt tells Codex to inspect existing work, preserve completed features, implement only the missing phase, verify it, and stop at credentials, legal approval, or other real external blockers.

Run every prompt from the canonical repository:

`C:\Users\abdul\Desktop\Buisness codex\Milo_Final_Delivery\milo`

Use one Codex task for the sequence when possible. Paste one prompt, wait for its verification report, resolve any stated blocker, and only then paste the next prompt.

## Non-negotiable rules for every phase

- Keep Milo Windows-first. Do not add macOS, mobile apps, browser extensions, or unrelated assistant features.
- Preserve Electron security: `nodeIntegration=false`, `contextIsolation=true`, `sandbox=true`, strict CSP, validated IPC, fixed external origins, and narrow preload APIs.
- The user selects exactly one window. Use UI Automation first and selected-window capture plus local OCR only as fallback.
- Screenshots remain local. Raw OCR text, conversation transcripts, participant names, generated replies, clipboard contents, and credentials must not be logged or stored in the cloud.
- Send only bounded recent text to the first-party backend when the user explicitly clicks Milo or uses the approved hotkey.
- Return Safe, Confident, and Playful suggestions. Milo never automatically pastes or sends a message.
- Never paste production secrets into Codex chat. Enter secrets directly into local secret stores or provider dashboards.
- Use pinned Node 24.19.0, pnpm 10.34.5, and .NET SDK 10.0.302.
- Preserve uncommitted work until it has been classified. Never use destructive Git commands.
- Do not declare a phase complete without its evidence commands passing.

## Accounts and decisions the owner must prepare

Prepare these outside source control:

1. GitHub account with access to `lambbuiscod-design/milo`.
2. Production or staging Supabase project.
3. SMTP provider and verified sending domain/address.
4. Stripe account with test mode available.
5. OpenRouter account with a production key and reviewed provider choices.
6. Vercel account and a production domain or temporary HTTPS staging domain.
7. Authenticode code-signing certificate or selected certificate provider.
8. Legal reviewer for Privacy Policy, Terms, AI disclosure, age restriction, and data-processing language.

Do not send passwords, API keys, webhook secrets, signing certificates, or recovery codes in chat.

## Prompt 1 — Stabilize the current worktree

```text
Continue Milo from the current canonical repository only:
C:\Users\abdul\Desktop\Buisness codex\Milo_Final_Delivery\milo

This is a stabilization phase, not a feature build.

Inspect AGENTS.md, git status, the current diff, untracked files, docs/PROJECT_STATUS.md, docs/TODO.md, docs/RELEASE.md, and docs/SECURITY-INVARIANTS.md before editing.

Classify every current change as:
- intended product work,
- generated build output/log,
- one-off migration or transformation script,
- secret-risk file,
- or unknown/user work.

Preserve all intended landing-page/UI work. Do not delete or overwrite unknown user work. Remove or ignore only confirmed generated artifacts and logs. Keep reusable scripts only when they are documented, safe, and referenced by the project; otherwise ask before deleting anything that may contain original logic.

Scan source and Git history for credentials without printing secret values. If a credential is found, report only its path/type and require rotation.

Reconcile package.json and pnpm-lock.yaml. Do not upgrade dependencies unless an exact incompatibility or vulnerability requires it.

Run:
- pnpm install --frozen-lockfile
- pnpm lint
- pnpm typecheck
- pnpm test
- pnpm build
- git diff --check

Fix real regressions. Do not weaken tests or security. When the intended change set is clean and verified, create a focused commit and push it to the configured upstream. Do not commit secrets, .env files, logs, dependencies, or generated installers.

Finish with only:
CHANGES PRESERVED
FILES CLEANED OR IGNORED
SECURITY FINDINGS
TEST RESULTS
COMMIT/PUSH RESULT
BLOCKERS
```

Done when: the intended source changes are reviewable, temporary artifacts are handled safely, the lockfile matches manifests, checks pass, and the branch has a documented clean checkpoint.

## Prompt 2 — Correct the website product story

```text
Work only in the canonical Milo repository. Inspect the current landing page and existing design system before editing. Preserve its polished dark premium visual direction, mascot quality, responsive structure, and working components.

Correct the website so it accurately sells the implemented product: a privacy-first Windows relationship and dating reply companion.

Remove or rewrite unsupported claims about general studying, coding, voice control, Pomodoro/focus tools, broad screen understanding, automatic context awareness, macOS availability, sub-second responses, or shortcuts that do not match the app.

The page must clearly explain this real flow:
1. Install Milo on Windows.
2. Explicitly select one chat window.
3. Milo extracts recent visible text locally using UI Automation first and local OCR fallback.
4. The user clicks Milo or uses the approved Ctrl+Shift+M hotkey.
5. Milo returns Safe, Confident, and Playful suggestions.
6. The user edits/copies manually; Milo never auto-sends.

Include accurate privacy language, five free analyses, the configured paid plan, honest Windows availability, and clear login/download CTAs. Do not add fake ratings, testimonials, user counts, scarcity, guaranteed dating outcomes, manipulation language, or claims that Milo knows another person's feelings.

Use consistent vector icons for structural UI instead of emoji. Keep keyboard navigation, visible focus, reduced motion, dark/light contrast, 44px targets, and 360px responsiveness.

Add or update tests for navigation, product claims, privacy copy, CTA destinations, responsive behavior, and reduced motion. Verify there are no broken links or horizontal overflow.

Run lint, typecheck, web tests, Playwright at 360px and desktop widths, and the web production build. Fix all failures. Commit and push only this coherent website phase.

Report:
DONE
REMOVED UNSUPPORTED CLAIMS
ACCESSIBILITY/RESPONSIVE RESULTS
TEST RESULTS
COMMIT
BLOCKERS
```

Done when: a visitor understands Milo in five seconds and every visible claim is implemented or clearly marked as future roadmap.

## Prompt 3 — Re-establish the complete local release baseline

```text
Audit Milo at the current revision after the website changes. Do not add product features.

Use the pinned toolchain and execute pnpm release:verify exactly as defined by docs/RELEASE.md. If it fails, reproduce each failure, fix its root cause, add or repair tests when appropriate, and restart the affected verification. Do not bypass assertions, relax Electron security, skip artifact scans, or hide failures.

Also verify:
- no secrets in tracked files, bundles, source maps, installer, logs, or fixtures;
- no screenshot/OCR/reply content in telemetry or persistence;
- the installer remains unsigned and clearly labeled internal-only;
- generated output remains untracked;
- git status is clean after the verified commit.

Update PROJECT_STATUS.md and TODO.md with exact counts and dates only after evidence passes. Commit and push the verified checkpoint.

Report only:
RELEASE VERIFY RESULT
FIXED
TEST/BUILD COUNTS
SECURITY SCAN
ARTIFACTS
COMMIT
BLOCKERS
```

Done when: `pnpm release:verify` passes for the exact committed revision.

## Prompt 4 — Configure and validate Supabase

```text
Configure Milo's real Supabase staging environment end to end while preserving the existing schema and additive migration history.

First inspect the current Supabase migrations, RLS tests, desktop authentication flow, OAuth consent/callback routes, MFA policy, adult eligibility checks, rate-limit RPCs, and account deletion saga. Do not rewrite applied migrations.

Before any secret is needed, give me the exact dashboard/terminal field where I must enter it. Never ask me to paste a secret into chat and never place service-role credentials in Electron or public environment variables.

Complete or guide me through:
- staging project creation/linking;
- public URL and publishable key configuration;
- server-only secret key configuration;
- exact web redirect/callback URLs;
- exact high-port 127.0.0.1 desktop OAuth callback/client configuration;
- verified email and SMTP configuration;
- MFA/AAL2 behavior;
- server-owned 18+ eligibility metadata;
- deployment of every existing migration;
- pgTAP/RLS/security tests;
- rate-limit HMAC secret configuration;
- account deletion and subscription cleanup boundaries.

Use synthetic test users and synthetic conversations only. Do not store real chats, screenshots, OCR text, names, or generated replies.

Run database reset/tests in a disposable environment first, then staging migration deployment, authentication smoke tests, token refresh/revocation, MFA enrollment/challenge, wrong-client rejection, RLS cross-user denial, and content-free suggestion reservation/completion tests.

Stop only when I must enter a credential, approve an external dashboard action, or choose a production setting. After I complete that action, continue from the same state.

Report:
CONFIGURED
MIGRATIONS APPLIED
AUTH/MFA RESULTS
RLS/PGTAP RESULTS
MANUAL ACTIONS I COMPLETED
BLOCKERS
```

Done when: staging authentication, MFA policy, RLS, migrations, rate limiting, and desktop token validation work with real Supabase services.

## Prompt 5 — Configure and validate Stripe billing

```text
Configure Milo's Stripe test-mode subscription lifecycle using the existing server-authoritative implementation. Do not put Stripe secrets in Electron or browser code.

Inspect the current Checkout, Customer Portal, webhook verification, idempotency/lease handling, subscription synchronization, entitlement rules, quota periods, cancellation handling, and account deletion flow before changing code.

Guide me to create or select one €5.99 monthly recurring price in Stripe test mode. Tell me exactly where to enter STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, and STRIPE_PRICE_ID without exposing them in chat or Git.

Configure the webhook endpoint and required event types. Verify signatures, replay protection, duplicate and reordered events, checkout completion, subscription update/deletion, renewal, failed payment behavior, cancellation at period end, Portal access, and account deletion cancellation.

Confirm:
- free plan receives exactly five lifetime successful analyses;
- failed generations do not consume allowance;
- paid plan receives the configured monthly allowance;
- the client cannot forge plan or subscription status;
- Milo never creates usage-based overage charges;
- cancellation and renewal are reflected server-side.

Use Stripe test clocks/test cards where helpful. Mock tests must remain green, and complete at least one real test-mode lifecycle with content-free logs.

Run billing unit tests, webhook tests, web E2E, typecheck, lint, and production build. Commit and push safe source/config-documentation changes only, never secrets.

Report:
STRIPE TEST CONFIGURATION
LIFECYCLE RESULTS
ENTITLEMENT/QUOTA RESULTS
TEST RESULTS
COMMIT
BLOCKERS
```

Done when: signup-to-payment-to-cancellation works in Stripe test mode and webhook state is authoritative.

## Prompt 6 — Configure and validate OpenRouter

```text
Configure Milo's staging OpenRouter integration using the existing text-only /api/v1/suggest path.

Inspect the current provider client, model configuration, structured schema, safety instructions, provider allowlist, ZDR/data-collection controls, timeout/retry behavior, quota reservation/refund, and log redaction before editing.

Help me choose a reviewed text model/provider combination based on privacy, structured-output support, latency, reliability, and cost. Do not send screenshots or images to OpenRouter. Do not enable tools, browsing, shell access, file access, unrestricted fallback, or provider training.

Tell me where to enter OPENROUTER_API_KEY, OPENROUTER_MODEL, and OPENROUTER_PROVIDER_ALLOWLIST outside chat and source control.

Require:
- explicit provider allowlist;
- fallback disabled;
- required parameter support;
- zero-data-retention/data-collection denial;
- bounded messages and request size;
- prompt-injection resistance;
- exact Safe/Confident/Playful schema;
- safety blocking for minors, exploitation, coercion, threats, abuse, and self-harm;
- no transcript/reply persistence or logging;
- no quota consumption on provider failure or malformed output.

Run all provider mocks plus a small real staging smoke with a synthetic conversation. Record only request ID, status, latency, model/provider, token counts, and estimated cost.

Commit and push code/documentation changes only.

Report:
MODEL/PROVIDER DECISION
PRIVACY CONTROLS
LIVE SMOKE RESULT
COST PER SUCCESSFUL REQUEST
TEST RESULTS
COMMIT
BLOCKERS
```

Done when: a synthetic authenticated staging request returns valid structured suggestions without content persistence or logging.

## Prompt 7 — Deploy the staging web control plane

```text
Deploy the existing Milo Next.js web application to Vercel as staging. Do not create a second application or repository.

Inspect next.config.ts, vercel.json, proxy/middleware, environment validation, CSP, health route, Supabase callbacks, Stripe webhook URL, OAuth consent flow, and current Git branch before deployment.

Link the canonical repository to one Vercel project. Configure all production/staging environment variables through Vercel secret settings, never through committed files or chat. NEXT_PUBLIC_APP_URL must be the exact non-local HTTPS origin.

Configure Supabase redirects and Stripe webhook endpoints to the deployed HTTPS origin. Verify that secrets remain server-only and are absent from client bundles, source maps, logs, and deployment output.

Run pnpm release:check and fix every code/configuration issue that can be fixed locally. Then deploy staging and test:
- landing page;
- login and callback;
- MFA;
- dashboard/account pages;
- health endpoint;
- suggestion endpoint authentication;
- Checkout/Portal redirects;
- Privacy and Terms routes;
- security headers and no-store responses.

Do not call staging production-ready merely because deployment succeeds.

Report:
STAGING URL
VERCEL LINKAGE
ENVIRONMENT NAMES CONFIGURED (names only)
ROUTE/HEADER RESULTS
RELEASE CHECK RESULT
BLOCKERS
```

Done when: staging is accessible over HTTPS and the health/auth/billing/API boundaries are correctly connected.

## Prompt 8 — Run the real end-to-end staging lifecycle

```text
Run Milo's real staging lifecycle end to end using synthetic accounts and conversations. Do not modify architecture unless a reproduced defect requires a targeted fix.

Test this complete flow:
1. Create and verify an adult test account.
2. Complete email login and desktop PKCE consent.
3. Enroll/challenge MFA where policy requires it.
4. Select the synthetic Milo.TestChat window.
5. Extract via UI Automation.
6. Force and verify local OCR fallback.
7. Detect a local message without making an AI request.
8. Request a suggestion only by Milo click and Ctrl+Shift+M.
9. Receive exactly Safe, Confident, and Playful suggestions.
10. Edit/copy manually and prove no auto-paste or auto-send.
11. Consume five successful free analyses; prove failures consume none.
12. Verify the sixth request opens the paywall.
13. Purchase a Stripe test subscription.
14. Verify paid allowance.
15. Open Portal, cancel, and verify entitlement transition.
16. Log out and prove tokens/context/selection/replies clear.
17. Delete the account and verify billing/auth/data cleanup.

Test pause, selected-window closure/recreation, wrong-window identity, offline/provider error, unsafe content, token expiry/refresh, duplicate request IDs, and concurrent quota attempts.

Do not use a real person's conversation. Do not capture or log private apps.

Fix reproduced defects, add regression tests, rerun affected suites, then rerun the complete lifecycle. Commit and push verified fixes.

Report:
FLOW PASSED
DEFECTS FIXED
PRIVACY ASSERTIONS
BILLING/QUOTA RESULTS
TEST EVIDENCE
COMMIT
BLOCKERS
```

Done when: the entire staged customer journey works with real services and synthetic content.

## Prompt 9 — Finish Italian OCR distribution

```text
Resolve Milo's Italian OCR release blocker without weakening the local-only privacy model.

Inspect the existing Windows OCR and Tesseract fallback architecture, packaging, licenses, language selection UI, current English/Italian tests, and installer size before choosing an approach.

Compare only practical options:
- require/install the Windows Italian OCR language capability;
- bundle a legally redistributable Italian Tesseract language file locally;
- or ship English-only at first with an honest Italian-unavailable state.

Choose the smallest reliable and legally supportable option for the first beta. Do not download language data at runtime without explicit user consent. Do not send OCR images to a server.

Implement the chosen path, include required license notices, validate checksum/integrity, handle missing/corrupt language data safely, and keep screenshots/frame buffers local and disposable.

Run English and Italian UIA/OCR fixtures, malformed/adversarial image tests, packaging, artifact scan, and installer smoke. Measure installer size impact.

Report:
DECISION
IMPLEMENTATION
PRIVACY/LICENSE IMPACT
ENGLISH/ITALIAN RESULTS
PACKAGE SIZE
COMMIT
BLOCKERS
```

Done when: Italian behavior is predictable on a clean Windows machine and documented honestly.

## Prompt 10 — Make remote CI and branch protection authoritative

```text
Audit and finish Milo's GitHub release controls using the canonical repository. Preserve the existing workflows; make the smallest fixes required.

Verify GitHub Actions from a clean checkout on the pushed revision:
- frozen pnpm install with Node 24.19.0;
- lint, typecheck, unit tests, web builds/E2E;
- .NET 10 locked restore/build/tests;
- desktop build/security/contracts/artifact scan;
- Supabase migration reset and pgTAP tests;
- dependency/security scanning;
- secret scanning;
- CodeQL when supported by the repository plan.

No production secret may be exposed to pull-request jobs. Signing credentials must not be introduced in this phase.

Fix genuine workflow or code problems; do not mark failing jobs optional and do not reduce assertions. Require the green checks on the release branch and prevent force pushes/deletion where the GitHub plan permits it.

If branch-protection changes require my confirmation, prepare the exact settings and stop immediately before applying them.

Report:
CLEAN CHECKOUT REVISION
WORKFLOW RESULTS
FIXES
PROTECTION SETTINGS
COMMIT
BLOCKERS
```

Done when: a clean remote revision is green and protected by required checks.

## Prompt 11 — Legal, privacy, accessibility, and compatibility release review

```text
Perform Milo's release review without adding new product features.

Replace launch placeholders only with owner-approved/legal-reviewed text. Do not invent legal guarantees. Clearly disclose AI-generated suggestions, user responsibility, 18+ eligibility, subscription terms, cancellation, data handling, local screenshot/OCR behavior, minimal text transmission, retention, deletion, and provider/subprocessor roles.

Audit web and Electron UI for:
- keyboard-only navigation and focus order;
- screen-reader names/status announcements;
- WCAG AA contrast in light/dark modes;
- reduced motion;
- 360px web layout;
- Windows 100%, 125%, 150%, and 200% scaling;
- multiple monitors including negative coordinates;
- taskbar edges and window docking;
- selected-window, paused, offline, loading, empty, error, and disabled states;
- no content hidden behind fixed controls;
- vector icon consistency and 44px targets where appropriate.

Test Windows 11 current stable plus the oldest Windows version Milo will officially support. Verify elevated target failure is clear and safe.

Produce a release evidence checklist with PASS, FAIL, NOT TESTED, and OWNER/LEGAL APPROVAL REQUIRED. Fix code defects, add regression tests, and rerun affected verification. Do not label legal review complete without actual approval.

Report:
LEGAL STATUS
PRIVACY REVIEW
ACCESSIBILITY RESULTS
WINDOWS COMPATIBILITY RESULTS
FIXES/COMMIT
OWNER APPROVALS REQUIRED
BLOCKERS
```

Done when: technical accessibility/privacy issues are fixed and every remaining legal/manual approval is explicit.

## Prompt 12 — Sign installer and establish secure updates

```text
Prepare Milo's signed Windows beta release using the existing Electron Forge/Squirrel architecture.

Do not request or expose the private signing key in chat. Guide me to install or configure the Authenticode certificate in a protected local/release environment. Keep signing secrets unavailable to pull requests and ordinary builds.

Implement or finish the release sequence:
test -> package -> sign helper/app/installer/update artifacts -> malware sanity check -> SHA-256 checksums -> immutable artifact -> staged beta channel.

Verify:
- Authenticode chain and timestamp;
- signatures on the native helper, Electron executable, installer, and updater artifacts;
- Electron fuses and ASAR integrity;
- packaged native-helper checksum;
- HTTPS-only update host;
- signed/checksummed update metadata;
- stable and beta channel separation;
- rollback/halt procedure;
- no server secrets or sensitive content in packages/source maps/logs.

Do not publish an unsigned artifact as production. If a certificate or artifact host is missing, complete all preparation and stop with the exact owner action required.

Report:
SIGNED ARTIFACTS
SIGNATURE VERIFICATION
CHECKSUMS
UPDATE CHANNEL
ARTIFACT SCAN
OWNER ACTIONS
BLOCKERS
```

Done when: a verifiably signed beta installer and update artifact exist in a protected release flow.

## Prompt 13 — Controlled beta launch

```text
Prepare and execute a controlled Milo Windows beta for 30-50 consenting adult testers. Do not expand product scope.

Create the minimum beta operations package:
- download/onboarding instructions;
- accurate privacy explanation;
- supported Windows/language limitations;
- known issues;
- support contact and content-free diagnostic procedure;
- cancellation/refund path;
- incident-response and release-halt checklist;
- staged rollout cohorts;
- rollback process.

Track only privacy-safe metrics already allowlisted: onboarding completion, selected-window success, extraction method/status, suggestion requests/success/failure, copies, helpful feedback, paywall views, checkout/subscription/cancellation, latency, and content-free cost metadata.

Never collect screenshots, conversation text, replies, clipboard contents, participant names, window titles, tokens, or raw IP addresses in analytics/support bundles.

Define beta success criteria before launch:
- activation rate;
- successful selected-window extraction rate;
- successful suggestion rate;
- week-one retention;
- suggestions copied per active user;
- helpful-feedback rate;
- free-to-paid conversion;
- cancellation/refund rate;
- provider cost per completed suggestion;
- privacy/security incidents.

Do not fabricate testers or metrics. Deploy only the signed approved beta artifact. After the observation period, produce a go/fix/stop recommendation based on real data.

Report:
BETA ARTIFACT/URL
TESTER COHORT
PRIVACY-SAFE METRICS
INCIDENT/ROLLBACK READINESS
EARLY RESULTS
GO/FIX/STOP
BLOCKERS
```

Done when: real testers can safely install, use, pay, cancel, and report problems, and the owner has evidence about demand.

## Prompt 14 — Final production approval

```text
Perform the final Milo production-release audit for the exact candidate revision. Do not add features and do not approve based on old evidence.

Re-read AGENTS.md, SECURITY.md, docs/SECURITY-INVARIANTS.md, docs/RELEASE.md, PROJECT_STATUS.md, and TODO.md. Map every mandatory gate to fresh evidence for this revision.

Require:
- clean Git status and protected green CI;
- pnpm release:verify PASS;
- pnpm release:check PASS;
- real Supabase/SMTP/PKCE/MFA/RLS evidence;
- real Stripe lifecycle evidence;
- reviewed OpenRouter privacy/provider evidence;
- live selected-window UIA/OCR and pause/close tests;
- legal and privacy approval;
- accessibility/DPI/multi-monitor results;
- verified Authenticode signatures and checksums;
- artifact/secret/malware scans;
- beta evidence and unresolved-incident review;
- HTTPS production web/app/update endpoints;
- rollback and support readiness.

If any gate lacks evidence, mark NOT READY and state the exact blocker. Never reinterpret a missing external approval as a pass.

If every gate passes, tag the immutable release, publish through the protected process, deploy the production web control plane, verify public health/login/billing endpoints, and monitor the staged rollout without collecting sensitive content.

Finish with only:
FINAL STATUS: READY or NOT READY
REVISION/TAG
VERIFICATION EVIDENCE
SIGNED ARTIFACTS
PRODUCTION URLS
REMAINING BLOCKERS
ROLLBACK STATUS
```

Done when: every mandatory gate has evidence and the signed production release is deployed through the protected rollout process.

## Optional master Goal

Use this only if Codex Goals are enabled and you want the objective to persist across turns. The phase prompts above should still be run in order because credentials and approvals require owner participation.

```text
/goal Bring the existing Milo Windows application from its current canonical repository state to a signed, staged, production-approved release, verified by the repository release contract, clean protected CI, real Supabase/Stripe/OpenRouter lifecycle evidence, legal/privacy/accessibility approval, signed artifact verification, and a controlled beta. Preserve the privacy-first architecture, selected-window-only access, local screenshots/OCR, minimal text transmission, strict Electron security, manual-only copy/send behavior, and existing working features. Work only in C:\Users\abdul\Desktop\Buisness codex\Milo_Final_Delivery\milo. Follow docs/MILO_END_TO_END_EXECUTION_GUIDE.md one phase at a time, run each phase's evidence commands, repair failures before continuing, and update status documentation after verified milestones. Never request secrets in chat or commit credentials. Stop only for an owner credential/dashboard action, legal approval, signing certificate, or a decision that cannot be safely inferred. Do not mark the Goal complete until every production gate has current evidence; otherwise report the exact blocker and what unlocks it.
```

## How to use this guide

1. Start with Prompt 1 in the current Milo Codex task.
2. Do not paste all prompts at once.
3. Read the phase report and resolve every blocker.
4. Paste the next prompt only after the previous phase is verified and committed.
5. Enter credentials only in provider dashboards, Vercel, protected GitHub secrets, or a local ignored secret file.
6. Keep staging and production credentials separate.
7. Do not give the unsigned installer to public customers.
8. If a later phase reveals a regression, return to the earliest affected phase, fix it, and rerun all downstream evidence.

The correct dependency order is:

`stabilize -> truthful UI -> local verification -> Supabase -> Stripe -> OpenRouter -> staging deploy -> live lifecycle -> OCR distribution -> CI protection -> legal/accessibility -> signing/updates -> beta -> production approval`
