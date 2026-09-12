# Milo V2 Product and Engineering Research

Date: 2026-09-12  
Scope: Windows-first desktop companion, production hardening, privacy, interaction design, and delivery sequence.

## Executive conclusion

Milo should continue with the existing Electron renderer/main-process split and the bounded C# native helper. A rewrite to Tauri, WinUI, or a mobile application would add delivery risk without validating the product's core value. The strongest product is a small, transparent companion beside a user-selected chat window: local observation first, an explicit user action before any AI request, three editable suggestions, and manual copy/send only.

The key differentiator is not generic reply generation. It is a trustworthy Windows interaction model: Milo is visibly bound to one selected window, explains when it is paused, keeps pixels and OCR local, and sends only minimal recent text when asked. Product polish should therefore prioritize the floating character, suggestion interaction, watching indicator, onboarding, and settings—in that order.

## Evidence and architecture decisions

### Preserve Electron plus the C# helper

Electron remains appropriate for Milo's established React UI and compact transparent windows. Electron documents `BrowserWindow` support for transparent windows and recommends waiting for `ready-to-show` to prevent visual flash. Its performance guidance emphasizes measurement, avoiding main-process blocking, and moving CPU-heavy work off the UI thread. That supports the current division: React renders the companion, while the native helper owns UI Automation, capture, and OCR work. Sources: [Electron BrowserWindow](https://www.electronjs.org/docs/latest/api/browser-window), [Electron performance](https://www.electronjs.org/docs/latest/tutorial/performance).

Microsoft describes UI Automation as the Windows accessibility framework that exposes UI elements across different control frameworks through a common model. This makes UI Automation the correct first extraction path for supported chat applications. Providers can be incomplete or opaque for custom controls, so Milo still needs a bounded fallback. Sources: [Microsoft UI Automation overview](https://learn.microsoft.com/en-us/windows/win32/winauto/uiauto-uiautomationoverview), [UI Automation providers](https://learn.microsoft.com/en-us/windows/win32/winauto/uiauto-providersoverview).

Windows.Graphics.Capture is the correct pixel fallback because it supports capture of a particular application window and provides system-mediated selection/indication. Milo must bind capture to the already selected window rather than silently expanding to the display. Source: [Microsoft screen capture guidance](https://learn.microsoft.com/en-us/windows/uwp/audio-video-camera/screen-capture).

Tesseract is an established local OCR engine. Its local execution aligns with Milo's rule that screenshots stay on the device. OCR should remain a fallback because it is slower and less structurally reliable than UI Automation. Source: [Tesseract user manual](https://tesseract-ocr.github.io/tessdoc/).

### Security boundary

Electron's official checklist directly supports Milo's existing rules: disable Node integration in renderers, enable context isolation and sandboxing, keep web security enabled, use a restrictive CSP, restrict navigation/window creation, validate IPC senders, prefer a custom protocol over `file://`, and expose no broad Electron API to untrusted content. Source: [Electron security checklist](https://www.electronjs.org/docs/latest/tutorial/security).

The release security contract is:

1. Renderer: display and user input only; no Node, shell, arbitrary files, unrestricted IPC, provider keys, or message sending.
2. Preload: a narrow typed API with strict payload validation.
3. Main process: validates sender and arguments, coordinates windows and local services, and never logs conversation content.
4. Native helper: unelevated, selected-window scoped, bounded protocol, no network credentials, no shell execution.
5. Backend: accepts only bounded recent text after explicit user action, applies entitlement/rate/safety checks, validates structured suggestions, and stores no transcript.

Electron `safeStorage` uses Windows DPAPI and protects stored values from other Windows users, though not necessarily other applications in the same user session. Milo should continue using it for refresh credentials, while treating the desktop app as a public OAuth client and using browser-based PKCE. Source: [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage).

Electron fuses should remain part of packaging verification. Unused capabilities such as `NODE_OPTIONS` and CLI inspection increase attack surface and can be disabled in production builds. Source: [Electron fuses](https://www.electronjs.org/docs/latest/tutorial/fuses).

### Privacy data flow

The normal path should remain:

`selected HWND -> UI Automation -> bounded recent messages -> local normalization -> explicit click/hotkey -> authenticated backend -> three schema-valid suggestions -> manual copy`

Fallback path:

`same selected HWND -> Windows.Graphics.Capture -> in-memory local image -> local OCR -> discard pixels -> bounded recent text -> explicit request`

Non-negotiable exclusions: full-desktop monitoring, background cloud capture, screenshot upload in the desktop workflow, raw transcript persistence, clipboard logging, participant profiling, auto-paste, and auto-send.

## Product and UX direction

Milo should feel like a premium companion rather than a dashboard. The transparent cat is the primary interface. Clicking it opens a compact panel; context-menu items open Home, Room, Customize, or Settings in the existing overlay. The selected-window boundary must always be understandable: `Watching: [window]`, `Pause`, and `Change Window`.

The approved palette is:

- Canvas `#10131F`
- Main surface `#181D2D`
- Elevated surface `#20263A`
- Secondary surface `#262E45`
- Coral `#FF8066`
- Peach `#FFAE8F`
- Purple `#886CFF`
- Mint `#60E6BD`
- Primary text `#F7F8FC`
- Secondary text `#A7AFC3`
- Muted text `#727C94`
- Danger `#FF6070`

Use semantic tokens rather than repeating hex values in components. Structural icons should come from one vector family; emojis should not be used as controls or navigation. Motion should stay between roughly 150–300 ms for UI feedback, animate transforms/opacity, and fully honor Full, Reduced, and Minimal settings.

WCAG 2.2 adds requirements relevant to Milo, including visible/unobscured focus, dragging alternatives, and minimum target size. The companion must be draggable, but important actions must also remain available through keyboard/context controls. Modal focus must be trapped and restored, and Escape must close dismissible overlays. Sources: [WCAG 2.2](https://www.w3.org/TR/WCAG22/), [W3C Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible).

## State and behavior model

Character states must be centrally prioritized so local idle animation cannot override safety or task states. The required state families are:

- Core: idle, noticed, generating, ready, paused, error, offline.
- Interaction: hover/looking, dragging, drop, pet, purring.
- Personality: curious, playful, alert.
- Rest: sleepy, sleeping, waking.
- Progression: celebrating, level-up.

Local-only actions—hover, drag, pet, idle changes, room placement, customization, settings, XP updates—must make zero AI calls. The AI path begins only on the explicit suggestion command by default.

## Progression, customization, and Room

Progression is supporting retention, not the core utility. XP must be content-free and abuse-resistant. Recommended awards are bounded events such as a manually copied suggestion, a completed privacy onboarding step, or a deliberate Room interaction. Daily caps and throttles must persist across restarts. Streaks should represent days of meaningful use without penalizing users aggressively.

Unlocks should be deterministic and local: fur/eye variants, accessories, animation personalities, room backgrounds, and furniture. Locked items must show their requirement; they must never appear clickable and silently fail. Customization is layered vector/CSS art so assets remain crisp at Windows DPI scaling. Room placement must support drag, keyboard movement, remove, reset, and durable local save.

## Performance targets and measurement

Performance claims require measurement on a packaged build. Capture/OCR must not run while Milo is paused and should stop when the selected window disappears. Idle rendering should suspend unnecessary timers when hidden. The main Electron process must not perform OCR or other long CPU work. Source: [Electron performance](https://www.electronjs.org/docs/latest/tutorial/performance).

Release measurements should record:

- Cold start to visible companion.
- Idle CPU and memory over a 10-minute sample.
- Generating-state animation frame consistency.
- UI Automation extraction latency.
- OCR fallback latency and cancellation.
- Pause-to-zero-observation time.
- Multi-monitor move/restore behavior at 100%, 125%, 150%, and 200% scale.

No fixed CPU or memory budget should be claimed until these measurements exist. A practical gate is zero sustained background work while paused and no visible input/animation stall during extraction.

## Delivery sequence

1. Preserve and continuously verify the security boundary and selected-window protocol.
2. Complete reusable controls, settings persistence, real OS behaviors, theme/motion, and truthful disabled/hidden states.
3. Finish companion positioning, context navigation, pause/resume, and multi-monitor recovery.
4. Complete versioned local data, XP/streak limits, unlock inventory, and migration tests.
5. Complete layered customization and Room editing with keyboard alternatives.
6. Connect personality settings separately to local animation and server-side suggestion style.
7. Perform accessibility, contrast, DPI, reduced-motion, and packaged-runtime checks.
8. Run full TypeScript/lint/tests, native .NET tests, web production build, Electron build/package/make, security scan, secret scan, and packaged launch.
9. Configure external Supabase, Stripe, OpenRouter, signing, Vercel, and release accounts without committing secrets.

## Current repository assessment

At the time of this report, the repository already contains the secure Electron main/preload/renderer split, selected-window binding, UI Automation-first extraction, local capture/OCR fallback, browser PKCE authentication, safe local credential storage, strict backend suggestion contract, manual copy behavior, state/idle/reaction managers, multi-monitor companion persistence, and Windows-native helper tests.

The current implementation phase added the approved design tokens and reusable controls; functional Home, Suggestions, Settings, Customize, and initial Room views; truthful selected-window privacy copy; context-menu navigation; Free/fixed-corner docking; persistent theme/motion/sound/general settings; and versioned content-free progression limits/streaks.

Remaining work before production readiness includes a complete unlock inventory, richer layered customization, a real Room editor with keyboard movement/reset, localization beyond the preference selector, granular sound categories, reviewed data export/reset handlers, measured packaged performance, full release verification, code signing, and external service configuration.

## Release decision

Milo is architecturally viable and the core privacy-first differentiator is credible. It is not yet ready for public release until the remaining local feature milestones and packaged verification are complete. The correct next investment is finishing the desktop companion experience and release proof—not adding live full-screen monitoring, auto-send, mobile overlays, or an architecture rewrite.
