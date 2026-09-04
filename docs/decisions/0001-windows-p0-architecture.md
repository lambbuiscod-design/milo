# ADR 0001: Windows P0 architecture review

Status: Accepted - user authorized Phase 1 work without amendments  
Date proposed: 2026-08-20
Date accepted: 2026-08-20

## Context

Milo is currently a screenshot-first Next.js SaaS. The P0 goal changes the primary experience to a privacy-first Windows desktop companion while preserving the website as the account, billing, authentication and cloud/API control plane. The implementation must not begin with a speculative rewrite, and major changes are gated on review of the architecture freeze.

The complete analysis is in `docs/ARCHITECTURE.md`, the non-negotiable controls are in `docs/SECURITY-INVARIANTS.md`, and phased execution is in `docs/exec-plans/active/windows-p0.md`.

## Proposed decisions

### 1. Desktop authentication

Use Supabase OAuth 2.1 Server as a public native client with authorization code, S256 PKCE, system-browser consent and an exact fixed loopback redirect. Keep the access token only in Electron main-process memory and persist only the refresh token as Electron `safeStorage` ciphertext. The renderer never receives either token.

Alternatives rejected for P0: embedded login WebView; a client secret inside Electron; renderer-owned Supabase session; custom long-lived desktop API keys.

### 2. Windows packaging

Use Electron Forge with Squirrel.Windows for the initial signed x64 beta. Keep MSIX as a later evaluated option rather than making an experimental packaging path block P0.

Alternatives deferred: MSIX and Microsoft Store distribution. ARM64 is not a P0 release target unless separately approved and resourced.

### 3. Supported operating systems

Certify Windows 11 x64 first. Test Windows 10 22H2 x64 only where the selected Electron, .NET 10, Windows SDK, capture and OCR dependencies remain supportable. Publish an exact supported-build/app matrix from measured Phase 10 evidence.

### 4. Text extraction and OCR

Use read-only Microsoft UI Automation on the explicitly selected window first. Fall back to `Windows.Graphics.Capture` for that exact window and local OCR inside the .NET helper. Prefer the evaluated Windows-local OCR path and bundle a pinned Tesseract 5-compatible English/Italian fallback only after its Phase 4 licensing, accuracy, packaging and signing spike passes.

Never capture the whole desktop and crop afterward as the normal fallback. Never send capture pixels to Milo's backend during the normal desktop flow.

### 5. Legacy web screenshot coach

Preserve the current web screenshot analysis during the behavior-preserving monorepo migration. It remains a separate legacy path and does not define the desktop privacy contract. Before desktop launch, product/legal/security review must decide whether the web feature remains available and whether its current generated-reply persistence is acceptable.

### 6. Desktop persistence and user control

Do not persist selected window identity, screenshot pixels, extracted transcripts, context hashes or generated replies. Persist only content-free preferences, overlay position and the OS-protected refresh credential. Local context remains in memory and clears on pause, window change/close, logout and exit.

The desktop may detect local changes, but inference occurs only after an explicit click or configured hotkey. Milo never automatically pastes or sends a message.

## Consequences

- The existing web backend and billing investment is reused rather than rewritten.
- The Electron main process and native helper become security-sensitive components with strict typed protocols and independent tests.
- The suggestion API requires a new text-only contract and content-free quota reservation/completion functions; the legacy screenshot route is not repurposed silently.
- Accessibility coverage and OCR quality vary by target application, so the supported-app matrix must be evidence-based rather than implied broadly.
- Native OAuth, code signing, local OCR packaging and real Windows testing add external dependencies and lead time.

## Approval record

No decision is accepted by the existence of this file. Record explicit approval or amendments here before Phase 1 begins.

| Decision | State | Approved/amended by | Date | Notes |
| --- | --- | --- | --- | --- |
| Desktop OAuth 2.1 + PKCE | Accepted | User via Codex task | 2026-08-20 | No amendments. |
| Squirrel.Windows x64 beta | Accepted | User via Codex task | 2026-08-20 | No amendments. |
| Windows support baseline | Accepted | User via Codex task | 2026-08-20 | No amendments. |
| UIA then selected-window capture/local OCR | Accepted | User via Codex task | 2026-08-20 | No amendments. |
| Preserve legacy web coach during migration | Accepted | User via Codex task | 2026-08-20 | No amendments. |
| Ephemeral desktop content and explicit inference | Accepted | User via Codex task | 2026-08-20 | No amendments. |

The user authorized the work to proceed and requested parallel sub-agent execution on 2026-08-20. This was recorded as acceptance of the unchanged proposal. Future amendments require a new decision record or an explicit superseding revision.
