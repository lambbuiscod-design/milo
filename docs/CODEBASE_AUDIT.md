# Milo codebase audit

Last verified: 2026-08-30

This audit describes the current dirty worktree. Secret-bearing local files were not opened, and no external integration is claimed without a real test.

## COMPLETE

- pnpm workspace: Next.js web control plane, Electron desktop, shared contracts/AI/security fixtures, .NET Windows helper, Supabase migrations, tests, and workflows.
- Secure Electron boundary: `nodeIntegration=false`, `contextIsolation=true`, `sandbox=true`, strict CSP, denied navigation/permissions, fixed external destinations, narrow preload, validated IPC, hardened fuses, and hostile artifact scanning.
- Explicit selected-window binding and revalidation using opaque source ID plus native HWND/PID/process-creation/session identity.
- UI Automation-first extraction with selected-window WGC and Windows-local OCR fallback. There is no monitor-capture API surface; native pixels are disposed locally and never cross into Electron.
- Bounded local context normalization, optional reliable name removal, local privacy preview, and lifecycle clearing. No screenshot, transcript, reply, window title, participant name, or clipboard content is persisted or logged.
- In-memory local change detector; it can show a notice but cannot call AI. Milo click or fixed hotkey is required.
- External-browser public-client PKCE authentication, exact loopback callback/state validation, refresh/revocation, memory-only access token, and encrypted refresh credential.
- Text-only `/api/v1/suggest` with bearer/client/AAL2/adult validation, user/IP limiting, service-only content-free quota RPCs, OpenRouter ZDR/provider guardrails, no tools, strict schema, and no transcript/reply persistence.
- Server-authoritative Stripe/Supabase entitlement reuse and fixed HTTPS account/Portal handoff.
- Offline deterministic `Milo.TestChat` UIA/OCR fixture and live native smoke harness.
- Fresh unsigned package/installer, checksum, source security contracts, runtime smoke, artifact scan, and packaged launch proof.

## PARTIAL OR ENVIRONMENT-GATED

- Italian OCR code path is present, but the host lacks the Italian Windows OCR language pack. English UIA/OCR live smokes pass.
- The combined Playwright selected-window run explicitly skips because `desktopCapturer` exposes no interactive fixture windows in this automation session. Independent native extraction and Electron shell smokes pass.
- Supabase, Stripe, OpenRouter, SMTP, Vercel, and OAuth implementations exist but cannot be proven against real services until user-owned configuration is supplied.
- Workflows exist but have no remote GitHub execution evidence.

## SECURITY/RELEASE RISKS

- Any ignored credential-bearing scratch file identified by prior documentation must have its credentials revoked/rotated and be securely removed before a push. It was not opened during this audit.
- The worktree is large and uncommitted. Preserve it; review and commit coherent changes rather than resetting.
- The legacy browser screenshot flow sends an image to the web route. The desktop path is separate and must remain local-pixels/text-only.
- The installer is unsigned. Do not distribute it publicly as a production release until Authenticode signing and update verification are operational.
- Provider, billing, database, OAuth, legal, deployment, and Windows beta lifecycle gates remain mandatory.

## LATEST VERIFICATION EVIDENCE

- Root ESLint: passed.
- Root TypeScript plus all workspace typechecks: passed.
- Unit tests: desktop 81/81, web 119/119, AI 4/4, contracts 4/4, security 10/10.
- Production builds: Electron renderer/preload/main and Next.js 19 routes passed.
- Native helper and TestChat .NET builds/publishes: passed; fixture restore emitted only a restricted-network NuGet advisory warning.
- Native live UIA English: passed without printing content.
- Native live selected-window WGC/local OCR English: passed without printing content.
- Electron shell runtime: passed with synthetic data only.
- Combined Playwright selected-window run: skipped for automation window-enumeration limitation, not counted as a pass.
- Electron Forge Squirrel package/installer: passed.
- Packaged artifact scan: 476 files passed.
- Packaged `Milo.exe` launch smoke: passed.
- Installer SHA-256: `B734D99E015195C292034AC27796FB5114544B8534E595D7E5B9AB41B5B2C41C`.
