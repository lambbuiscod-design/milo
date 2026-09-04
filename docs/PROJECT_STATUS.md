# Milo Windows MVP status

Last verified: 2026-08-30

## COMPLETE

- The existing Next.js/Supabase/Stripe/OpenRouter web control plane is preserved under `apps/web`.
- The Windows Electron app uses a sandboxed, context-isolated, CSP-restricted shell with a narrow typed preload API and validated IPC.
- The floating Milo interaction supports idle, local-new-message, generating, ready, paused, offline/error, explicit copy, and no automatic paste or send.
- Users explicitly select one window. Milo binds it to HWND, PID, process creation time, and session identity and revalidates the identity before every native operation.
- Read-only Windows UI Automation is the primary extractor. Selected-window `Windows.Graphics.Capture` plus Windows-local OCR is the fallback; Electron receives text, not pixels.
- Context normalization is local and bounded. Privacy preview, optional participant-name removal, and 4/6/8 recent-message limits are implemented; ephemeral context clears on pause, window change/loss, logout, panel close, disposal, and exit.
- Local change detection uses only an in-memory hash and never triggers AI. Inference requires a Milo click or `Ctrl+Shift+M`.
- Desktop authentication uses an external browser, S256 PKCE, exact loopback state validation, in-memory access tokens, and `safeStorage`-encrypted refresh credentials.
- `/api/v1/suggest` is text-only, authenticates bearer/client/AAL2/adult claims, applies rate and quota controls, treats text as untrusted, uses strict structured output, and stores no transcript or reply content.
- Exactly Safe, Confident, and Playful ephemeral suggestions are returned for manual editing/copying.
- Account, billing, privacy, and terms open only fixed Milo web destinations in the system browser; no token is placed in a URL.
- The deterministic offline `Milo.TestChat` fixture covers UIA, owner-drawn OCR, English/Italian samples, append, close, and recreation.
- Node 24 lint, typecheck, all unit tests, production web/desktop builds, desktop security contracts, real UIA extraction, real English OCR, Electron shell runtime, packaging, 476-file artifact scan, and packaged launch have passed.
- A fresh unsigned Windows installer and checksum exist under `apps/desktop/out/make/squirrel.windows/x64`.

## PARTIAL

- Windows-local Italian OCR is implemented and attempted after English, but this development PC does not have the Italian Windows OCR language pack, so a real Italian recognition smoke cannot pass here.
- CI, database tests, and release workflows exist locally, but no remote Git repository or live CI run is configured.
- The combined Playwright picker-to-extraction smoke is implemented, but Electron's Playwright automation session exposes no interactive fixture window on this host. Native UIA/OCR and Electron shell paths pass independently.

## STILL REQUIRED FOR PRODUCTION

- Configure a real Supabase project, desktop OAuth client/redirect, AAL2/adult metadata, SMTP, Stripe, reviewed OpenRouter provider allowlist, rate-limit secret, and deploy the desktop quota migration.
- Run real login, refresh/revocation, AI suggestion, quota, Checkout, webhook, Portal, cancellation, and renewal staging flows.
- Install/ship the required Italian OCR capability or approve and validate a bundled local fallback.
- Configure a Git remote and run Windows/web/database CI from a clean checkout.
- Obtain an Authenticode certificate, protect signing credentials, sign installer/update artifacts, and verify reputation/update channels.
- Complete legal review, privacy/security review, Windows compatibility/DPI/multi-monitor testing, staged beta, and production deployment.

## BLOCKERS

- External account configuration and secrets are not present locally. Secrets must be configured in local/server secret stores, never pasted into chat or bundled into Electron.
- Production signing requires an Authenticode certificate and protected release environment.
- Remote CI and updater publication require a configured Git repository/artifact host.

## CURRENT ANSWER

The core privacy-first Milo Windows application is implemented and has a runnable unsigned developer installer. It is not ready for public production release until the external integrations, Italian OCR decision, staging lifecycle, signing, and release gates above are completed.
