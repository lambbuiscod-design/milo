# Milo security and privacy invariants

Status: mandatory P0 design constraints  
Last updated: 2026-08-20

These invariants are release requirements, not aspirations. A test, feature request, performance target, or provider limitation does not authorize weakening them. Any proposed exception requires a written threat analysis, explicit product/security review, and an update to this document before code changes.

## Data minimization

1. Screenshot pixels remain on the user's Windows device during the normal desktop workflow.
2. OCR runs locally. The desktop suggestion API does not accept screenshot uploads.
3. UI Automation and capture are bound to one window explicitly selected by the user.
4. Milo never captures the entire desktop and crops it later when a selected-window path is available.
5. Raw UIA text, OCR text, normalized conversation context, participant names, generated replies, and clipboard content are not written to Milo cloud storage or logs by default.
6. Only the smallest useful recent excerpt is submitted after an explicit click or hotkey. Default limits are eight messages and 4,000 Unicode characters, subject to accuracy testing.
7. Participant names are excluded from the network contract. Local name removal is enabled by default when detection is reliable.
8. Conversation state is ephemeral. Pause, Change Window, window close, logout, and process exit clear it.
9. Generated replies are ephemeral in the desktop, API, and provider-processing path. They are not inserted into `replies`, analytics, error reports, or diagnostic bundles.
10. Product telemetry is content-empty and uses a fixed schema. Extending telemetry requires a migration, contract test, and privacy review.

## User control

1. The user explicitly selects the target window.
2. Milo visibly identifies the selected application and whether watching is active or paused; color alone is insufficient.
3. Milo can locally notice a change, but it does not call AI automatically by default.
4. The user can pause watching, change the target window, preview the exact text about to be submitted, limit recent messages, and remove names.
5. Milo never types, pastes, clicks, focuses, invokes controls in, or sends a message through the selected chat application.
6. Copying copies only the chosen suggestion after a deliberate action. Milo never reads the existing clipboard.
7. If the selected window closes or its identity changes, observation stops and the context is cleared. Milo never silently follows a replacement HWND.

## Electron renderer boundary

Every renderer has all of:

```text
nodeIntegration = false
contextIsolation = true
sandbox = true
webSecurity = true
webviewTag = false
navigateOnDragDrop = false
```

Additional invariants:

1. `app.enableSandbox()` is called before application readiness.
2. Privileged renderers load only packaged local content through a controlled application protocol. They do not load the Milo website or arbitrary remote content.
3. CSP defaults to deny and permits only packaged application assets and the minimum required connect origin if the renderer has any direct network access. The preferred design gives the renderer no authenticated network access.
4. Navigation, new-window creation, permissions, and external protocols are denied by default.
5. External links are mapped from a fixed destination enum to exact HTTPS Milo origins in main. Renderer-provided arbitrary URLs are rejected.
6. Production never disables `webSecurity`, the Chromium sandbox, certificate validation, or same-origin protections.
7. Electron security warnings are treated as test failures in development and CI.
8. Production packaging enables reviewed restrictive fuses, including disabling RunAsNode and environment/CLI paths that expand Node execution, and enabling ASAR integrity/load restrictions when supported.

## Preload and IPC boundary

1. Preload exposes domain operations only. It never exposes `ipcRenderer`, event objects, `send`, `invoke`, Node primitives, Electron modules, or generic callbacks.
2. There is no IPC equivalent of `exec`, `shell`, `spawn`, `readFile`, `writeFile`, `openPath`, arbitrary URL opening, arbitrary fetch, arbitrary clipboard access, or arbitrary native-helper commands.
3. IPC inputs and outputs are validated against shared schemas at both ends.
4. Each handler validates the expected renderer `webContents`, expected top frame, and packaged application origin.
5. Payloads have strict byte, collection, string, and timeout limits.
6. Unknown fields and unknown message types are rejected.
7. IPC errors returned to the renderer contain stable public codes and safe copy, never stack traces, paths, tokens, window titles, conversation text, or native error dumps.
8. Event subscriptions return an unsubscribe function and strip the Electron event parameter.

## Windows helper boundary

1. Milo runs unelevated. P0 does not request administrator rights or `uiAccess` to read elevated applications.
2. The helper has no inbound network listener and no shell/file command surface.
3. Electron launches only the exact signed helper packaged with Milo.
4. The helper protocol is bounded, schema-validated, request-correlated, and deny-by-default.
5. A window identity includes HWND, PID, process creation identity, user session, and validation metadata sufficient to detect handle reuse.
6. Every extraction/capture operation revalidates that identity and confirms the window remains visible, top-level, in the current user session, and not owned by Milo or a system process.
7. UI Automation traversal is rooted at the selected window and bounded by depth, element count, text size, and time. Only read patterns/properties are used.
8. Capture uses `Windows.Graphics.Capture` for the selected HWND. No command accepts an arbitrary rectangle or whole-display target in the normal product path.
9. Capture frames, bitmaps, OCR buffers, and language-engine intermediates are disposed or zeroed when practical immediately after extraction.
10. Native-helper stdout/stderr never includes pixel data, conversation text, participant names, window titles, file paths containing user names, or raw COM/WinRT diagnostic payloads in production.
11. Helper crashes fail closed: watching stops, context clears, and the user sees a plain-language recovery action.

## Authentication and session security

1. The desktop is a public OAuth client. It has no client secret.
2. Initial authorization uses authorization code + S256 PKCE, high-entropy state, an external system browser, and an exact registered redirect URI.
3. The loopback callback binds to `127.0.0.1` only, exists only during authorization, accepts one response, validates state, and closes immediately.
4. Authorization codes are single-use and exchanged only with the matching verifier. The client treats any successful 2xx token response as success.
5. The renderer never sees an access token, refresh token, authorization code, code verifier, or authentication cookie.
6. Access tokens remain in Electron main memory. Refresh tokens are persisted only as Electron safeStorage ciphertext. Failure to obtain OS-backed encryption fails closed.
7. Tokens are never put in URLs other than the short-lived authorization code returned to the loopback callback, logs, crash reports, analytics, or IPC.
8. The server validates the token with Supabase, checks the expected desktop `client_id`, verifies a confirmed non-anonymous email and server-owned adult attestation, and applies the existing MFA policy.
9. If a user has an enrolled verified authenticator, protected desktop operations require AAL2. Consent and token refresh behavior must be tested with real enrolled accounts.
10. Logout attempts server revocation/sign-out, deletes safeStorage ciphertext, clears memory, context, selection, and replies, and returns the desktop to an unauthenticated state.
11. Environment-specific OAuth clients, redirect URIs, Supabase projects, and signing keys remain separate across LOCAL, CI, STAGING, and PRODUCTION.

## Server/API boundary

1. The desktop calls only documented first-party `/api/v1/*` routes over HTTPS.
2. `/api/v1/suggest` accepts normalized text and non-sensitive preference metadata only. It rejects multipart data and image media types.
3. Authentication, entitlement, rate limiting, quota reservation, safety checks, AI invocation, structured validation, and quota completion are server-authoritative.
4. Desktop-provided plan, usage, subscription, price, model, provider, user ID, email, cost, or token data is never trusted.
5. User- and IP-based distributed rate limiting fails closed before provider spend. Raw IP/user keys are HMACed before database persistence.
6. Request size, message count, individual text length, total text length, Unicode control characters, enum values, and client version are bounded.
7. Provider failures and malformed outputs do not consume quota. Successful completion consumes quota exactly once.
8. A unique client request ID and one-live-request rule prevent concurrent duplicate provider spend.
9. API responses use `private, no-store`; authenticated content is never cached by the CDN or browser.
10. No request/response body is printed or attached to analytics/error tools.

## AI boundary

1. Provider master keys exist only in server deployment secrets.
2. The production request pins an approved model and an explicit reviewed provider allowlist.
3. Unrestricted provider fallback is disabled. Provider parameter support is required.
4. Zero-data-retention routing and data-collection denial are required at request level and in the provider account/key guardrail.
5. Prompt/completion logging and provider training opt-ins remain disabled.
6. The suggestion model has no tools, browser, shell, clipboard, messaging, file, or operating-system execution capability.
7. Conversation text is serialized and labeled as untrusted data. Instructions found in it do not change system/developer policy.
8. The server requires the exact response schema and validates it independently with Zod before rendering.
9. Malformed or unsafe output is rejected safely and never partially rendered.
10. Safety-sensitive input involving minors, exploitation, coercion, credible threats, abuse, or self-harm does not receive ordinary flirtatious suggestions.
11. The model/moderation provider path, endpoint retention, data residency, policy, and structured-output support are reviewed as one release artifact.

## Database and billing

1. Every exposed table has RLS and explicit grants. `TO authenticated` is always paired with ownership/authorization logic.
2. Service-role functions are unavailable to `public`, `anon`, and `authenticated`; their `search_path` is fixed.
3. Desktop suggestion completion persists only request/usage/model/token/cost/status metadata. It never accepts reply text or source transcript parameters.
4. `optional_context` remains database-constrained to null.
5. Subscription state comes from signed Stripe webhooks and current Stripe retrieval, never the desktop or browser client.
6. Stripe webhooks read a bounded raw body, verify the signature, use idempotent receipts/leases, and tolerate duplicate, delayed, and reordered events.
7. Checkout and Portal are hosted by Stripe and opened through the Milo website/system browser. Electron never collects card details.
8. Account deletion remains an idempotent saga that cancels billable subscriptions before deleting authentication data.
9. Database migrations are additive and ordered. Applied migration history is not renamed or rewritten.

## Logging, telemetry, diagnostics, and support

Never log or transmit to diagnostics:

- screenshots or capture frames;
- UIA/OCR/conversation text;
- participant or window titles/names;
- generated replies;
- clipboard content;
- access/refresh tokens, authorization codes, verifiers, cookies, API keys, webhook signatures, or raw webhook bodies;
- full request/response bodies;
- local paths containing user names.

Allowed operational fields include opaque request ID, hashed/pseudonymous user key where needed, application version, platform, extraction method, status/error class, duration, token counts, estimated cost, HTTP status, and content-free quota state.

Allowed product events are a fixed vocabulary such as `onboarding_completed`, `window_selected`, `watching_paused`, `suggestion_requested`, `suggestion_generated`, `suggestion_copied`, `suggestion_regenerated`, `extraction_method`, `extraction_failed`, and `upgrade_opened`. Properties are allowlisted per event. Unknown keys fail validation.

Support bundles are opt-in, previewable, and content-free. P0 does not include automatic diagnostic upload.

## Updates, packaging, and supply chain

1. Production uses a current supported Electron, Node 24 LTS for web/tooling, and .NET 10 LTS for the helper.
2. The lockfile and native dependency manifests are committed; CI uses frozen/locked restores.
3. Renderer code cannot load remote JavaScript or update code outside the signed application update process.
4. Production installers, Electron binaries, helper binaries, and update artifacts are Authenticode-signed.
5. Signing credentials exist only in protected release jobs and are unavailable to pull-request jobs.
6. Release steps are test -> package -> sign -> malware sanity check -> SHA-256 checksum -> immutable artifact -> staged rollout.
7. Stable and beta channels are separate. Update manifests and artifacts are HTTPS-only and signature/checksum verified.
8. A failed staged rollout is halted or rolled back; Milo never automatically promotes an unverified build to all users.
9. Electron fuses, ASAR integrity, packaged helper checksum/signature, and absence of server secrets in bundles are tested before release.
10. License notices and redistribution rights for Electron, native libraries, Tesseract, and language data ship with the product.

## Required security tests

Each release must provide evidence for:

- renderer settings, sandbox, CSP, navigation/window/permission denial, and fuse configuration;
- IPC sender/origin validation and invalid/oversized/unknown payload rejection;
- absence of generic privileged preload methods;
- selected-window identity validation, HWND reuse, window close, session boundary, Milo/system-window exclusion, and elevated-target failure;
- assertion that no frame bytes reach Electron renderer, HTTP mocks, logs, analytics, database, or crash reports;
- local OCR English/Italian fixtures and malformed/adversarial images;
- context truncation, dedupe, name removal, pause/clear lifecycle, and no automatic network request;
- PKCE verifier/state/redirect/token exchange, replay, expiry, cancellation, refresh, logout, AAL1/AAL2, and safeStorage failure;
- bearer and cookie auth separation, wrong `client_id`, ineligible user, rate limit, quota concurrency, failure refund, and idempotency;
- prompt injection, schema rejection, unsafe-content handling, provider allowlist, disabled fallback, ZDR/data-collection settings, and no tools;
- RLS ownership, service-function privileges, content-free completion, and forbidden transcript/reply persistence;
- Stripe duplicate/reordered lifecycle and server-authoritative entitlement;
- log/telemetry redaction and secret scanning of source, bundles, installers, source maps, and artifacts;
- signed installer/update verification and checksum generation.

## Current gaps discovered in Phase 0

The following are blockers before implementation or release:

1. `deepseekspro.json` is an untracked plaintext command/configuration file containing provider credentials. All credentials present in it must be revoked/rotated, the file securely removed, and secret scanning enabled before any push. Do not merely add the compromised file to `.gitignore` and keep using the keys.
2. The tracked `.env.example` is currently deleted in the worktree. Restore or deliberately relocate it during the monorepo migration; do not commit that deletion accidentally.
3. Preview log files are untracked in the repository root. Remove them or ignore the exact generated log names after confirming they contain no sensitive content.
4. The current OpenRouter request has ZDR and data-collection denial but no provider `only` allowlist, no disabled unrestricted fallback, and no `requireParameters` gate.
5. The current web flow persists generated replies. The desktop path must use a separate content-free completion function; product/legal review must resolve the legacy web behavior.
6. Authentication is cookie/magic-link oriented. There is no desktop OAuth client, consent page, bearer-token route guard, safeStorage integration, or desktop-specific `client_id` validation.
7. The repository targets Node `>=20.19.0`, CI uses Node 20, the local machine is running Node 26, and no version file exists. P0 requires Node 24 LTS certification.
8. The local machine has .NET 9 only; .NET 10 LTS and the Windows SDK/native build dependencies are missing.
9. There is no Git remote, Vercel project, production HTTPS origin, signing identity, artifact/update host, or Windows release environment.
10. Production Supabase service/rate-limit secrets, Stripe configuration, admin allowlist, legal text, SMTP, and real end-to-end lifecycle evidence remain incomplete.
11. The current local unit suite is not fully green under the present Node 26/process environment: 88 tests passed, while seven Vitest workers timed out and the command exited 1. A single-worker retry also hung during startup. These are not assertion failures, but this remains a failed gate until reproduced on the pinned Node 24 toolchain.
