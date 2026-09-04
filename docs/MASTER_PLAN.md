# Milo — Complete Master Plan

The main Milo plan is:

> A privacy-first Windows desktop AI cat that floats beside WhatsApp or another selected chat window, notices new messages locally and gives Safe, Confident and Playful reply suggestions only when the user asks. Milo never automatically sends messages.

The existing technical execution plan is stored in `docs/exec-plans/active/windows-p0.md`. Current progress is tracked in `docs/PROJECT_STATUS.md`.

## 1. Final product experience

The intended user journey is:

```text
Install Milo
→ complete privacy onboarding
→ sign in
→ select one WhatsApp/chat window
→ Milo floats beside that window
→ Milo notices new messages locally
→ user clicks Milo or presses Ctrl+Shift+M
→ Milo extracts minimal recent context
→ screenshot pixels and OCR remain local
→ minimal recent text is sent securely
→ Safe, Confident and Playful replies appear
→ user edits or copies a reply
→ user sends it manually
```

Milo must never:

- Read every window.
- Capture the entire monitor.
- Monitor without visible permission.
- Send a message automatically.
- Automatically paste into WhatsApp.
- Store screenshots or complete conversations.
- Profile the other person.
- Claim to know someone’s feelings.
- Generate coercive, threatening or manipulative messages.

## 2. First target market

Launch with:

- Windows 11 first.
- Adults aged 18+.
- WhatsApp Desktop and WhatsApp Web first.
- English first.
- Italian as the second language.
- Dating, relationships and difficult personal conversations.

Future supported contexts:

- Instagram messages in a browser.
- Tinder, Bumble and Hinge web interfaces.
- Friendly WhatsApp conversations.
- Apologies and conflict resolution.
- Professional but casual replies.

Do not promise support for every messaging application until each version has been tested.

## 3. Main desktop UI

### Floating Milo

Milo remains a small floating cat next to the selected chat.

States:

- Idle
- Watching selected window
- New message noticed
- Generating
- Suggestions ready
- Paused
- Offline
- Selected window closed
- Authentication required
- Allowance exhausted

Milo should always display:

```text
Watching: WhatsApp
Pause
Change Window
```

When paused:

```text
Paused — Milo is not reading this window
Resume
```

### Suggestion panel

Clicking Milo opens a compact panel containing:

- Very short interpretation.
- Safe reply.
- Confident reply.
- Playful reply.
- Edit reply.
- Copy reply.
- Try Again.
- Change tone.
- Privacy indicator.
- Remaining allowance.

The panel collapses after use and never blocks the WhatsApp reply box.

### Onboarding

Use four steps:

1. Meet Milo.
2. Understand what stays local and what is sent.
3. Select one chat window.
4. Learn the click and `Ctrl+Shift+M` interaction.

## 4. Visual design

Milo should feel:

- Premium
- Playful
- Calm
- Private
- Human
- Minimal
- Unobtrusive

Design system:

- Warm off-white light background.
- Dark navy dark-mode background.
- Indigo primary color.
- Pink accent used sparingly.
- Fraunces headings.
- Geist body text.
- Rounded modern panels.
- Lucide outline icons.
- Subtle 150–300ms animations.
- Clear focus indicators.
- Reduced-motion support.
- Windows DPI and multi-monitor support.

Avoid:

- Pickup-artist branding.
- Excessive gradients.
- Neon gaming interfaces.
- Large permanent dashboards.
- Childish emoji buttons.
- Fake testimonials.
- Manipulative payment screens.
- Claims that Milo guarantees dates or replies.

## 5. Desktop architecture

### Electron renderer

Responsible only for presentation:

- Floating cat.
- Suggestion cards.
- Watching status.
- Onboarding.
- Settings interface.

Security requirements:

- `nodeIntegration = false`
- `contextIsolation = true`
- `sandbox = true`
- Strict CSP
- No filesystem access
- No shell access
- No authentication tokens
- No OpenRouter key
- No arbitrary network access
- Narrow typed preload API only

### Electron main process

Responsible for:

- Window selection.
- Overlay position.
- Native-helper communication.
- Authentication session.
- Hotkey.
- API requests.
- Safe clipboard copy.
- Local ephemeral context.
- Privacy lifecycle cleanup.

### C#/.NET Windows helper

Responsible for:

- Identifying the selected HWND.
- Confirming PID and process identity.
- Reading UI Automation.
- Capturing only the selected window.
- Running local OCR.
- Returning bounded text—not pixels.
- Cancelling immediately on Pause or Change Window.

The helper remains unelevated and has no provider secrets.

## 6. Extraction pipeline

Use this strict order:

```text
Explicitly selected window
→ validate HWND/PID/process identity
→ read Windows UI Automation
→ determine whether extracted text is sufficient
→ selected-window Windows.Graphics.Capture fallback
→ local OCR
→ normalize recent message candidates
→ remove duplicates
→ retain only 4, 6 or 8 recent messages
→ optionally remove participant names
→ hold context temporarily in memory
```

Privacy rules:

- No full-monitor capture.
- No background screenshot storage.
- No image sent to OpenRouter.
- No raw conversation written to disk.
- Clear memory when paused, logged out, window changed, panel closed or app exited.

## 7. New-message detection

Milo periodically checks the selected window locally.

It may:

- Compare an in-memory content hash.
- Detect meaningful text changes.
- Show a small “new message” animation.

It must not:

- Automatically call the AI.
- Automatically open the suggestion panel.
- Send conversation text merely because something changed.

An AI request happens only after:

- User clicks Milo, or
- User presses `Ctrl+Shift+M`.

## 8. AI suggestion system

The Electron app sends the server:

- Maximum eight normalized messages.
- Maximum 4,000 total characters.
- Tone preference.
- Relationship stage.
- Client version.
- Random request ID.

It does not send:

- Screenshot pixels.
- Window title.
- Contact name.
- Phone number.
- Complete conversation history.
- Subscription status supplied by the client.
- OpenRouter credentials.

Required response:

- Exactly one Safe reply.
- Exactly one Confident reply.
- Exactly one Playful reply.
- Short explanation for each.
- Strictly validated structured response.
- Safety warning where necessary.

Safety-sensitive conversations involving minors, exploitation, coercion, threats or self-harm receive a safety response instead of flirtatious suggestions.

## 9. Authentication

Electron is treated as a public native client.

Authentication flow:

```text
Click Sign In
→ system browser opens
→ Supabase OAuth authorization
→ email authentication
→ 18+ eligibility check
→ MFA/AAL2 verification
→ user approves Milo desktop
→ secure loopback callback
→ PKCE token exchange
→ refresh credential encrypted with Electron safeStorage
```

Rules:

- No client secret inside Electron.
- No privileged embedded login WebView.
- No token in URLs.
- No token exposed to the renderer.
- Logout clears credentials, context, selection and replies.

## 10. Backend

The Next.js application remains the cloud control plane.

Backend responsibilities:

- Authentication.
- Eligibility.
- Desktop suggestion API.
- Rate limiting.
- Usage allowance.
- Stripe billing.
- Subscription synchronization.
- Account management.
- Privacy and Terms pages.
- Aggregate admin metrics.

Desktop API:

```text
POST /api/v1/suggest
```

Requirements:

- HTTPS in production.
- Bearer authentication.
- Registered Milo desktop client ID.
- AAL2 and adult eligibility.
- JSON only.
- Strict body-size limit.
- Rate limit by user and IP.
- Strict schema validation.
- No transcript or reply persistence.
- No browser, shell, messaging or operating-system tools.

## 11. OpenRouter

The OpenRouter key stays exclusively on the server.

Provider controls:

- Reviewed provider allowlist.
- Zero-data-retention routing.
- Provider collection denied.
- Provider fallback disabled.
- Structured-response support required.
- Model configurable through environment variables.
- Conversation text treated as untrusted input.
- No AI tools enabled.

The model must not obey instructions found inside conversation text.

## 12. Database

Supabase stores only content-free account and billing information:

- User profile.
- Adult eligibility metadata.
- Subscription.
- Usage period.
- Request status.
- Token and cost metadata.
- Privacy-safe analytics.
- Stripe webhook receipts.

Supabase must not store:

- Screenshots.
- OCR output.
- Original conversations.
- Contact names.
- Window titles.
- Generated desktop replies.
- Clipboard contents.

Row Level Security remains enabled.

## 13. Billing

Initial pricing:

- Five free successful suggestions.
- €5.99 per month.
- 150 suggestions per billing month.
- Failed or unsafe requests do not consume allowance.
- No automatic overage charges.

Use:

- Stripe Checkout for starting subscriptions.
- Customer Portal for management and cancellation.
- Verified Stripe webhooks.
- Server-authoritative entitlement checks.

Possible later pricing experiment:

- Free: five suggestions.
- Plus: €5.99/month.
- Annual: approximately €49.99/year.

Do not add weekly subscriptions until user research proves they are wanted.

## 14. Analytics

Track content-free events only:

- Signup completed.
- Window selected.
- Watching started.
- Suggestion requested.
- Suggestion completed.
- Suggestion failed.
- Reply copied.
- Try Again used.
- Paywall viewed.
- Checkout started.
- Subscription started.
- Subscription cancelled.

Never include conversation text, names, replies or screenshots.

Important business metrics:

- Installation completion.
- Window-selection success.
- First-suggestion success.
- Suggestion latency.
- Replies copied per analysis.
- Seven-day retention.
- Free-to-paid conversion.
- Active subscriptions.
- Monthly recurring revenue.
- AI cost per successful request.

## 15. Store and platform strategy

### Phase one

Distribute Milo as a signed Windows desktop installer.

Support:

- WhatsApp Desktop.
- WhatsApp Web on supported browsers.

### Phase two

Create mobile screenshot/share versions:

- iPhone screenshot or Share Extension.
- Android screenshot/share flow.

### Phase three

Consider:

- Milo iOS custom keyboard.
- Android keyboard.
- Carefully reviewed Android overlay/accessibility version.

Do not attempt iPhone background monitoring of WhatsApp because iOS does not support the Windows-style selected-window overlay model.

## 16. Testing plan

Required test categories:

- Electron security.
- IPC validation.
- Window identity.
- UI Automation.
- Selected-window capture.
- Local OCR.
- Context normalization.
- Duplicate suppression.
- Message detection.
- Pause and cleanup.
- Authentication and PKCE.
- Token storage.
- Suggestion schema.
- Safety behaviour.
- Quota concurrency.
- Stripe webhooks.
- Supabase RLS.
- Packaging.
- Secret scanning.
- DPI and multiple monitors.
- Sleep and resume.
- Window closing and recreation.
- Offline recovery.
- Accessibility.
- Performance and memory.

Use only synthetic conversations for test fixtures.

## 17. Current status

Already implemented locally:

- pnpm monorepo.
- Next.js control plane.
- Hardened Electron shell.
- Floating Milo interface and states.
- Selected-window identification.
- C# Windows helper.
- UI Automation extraction.
- Selected-window capture.
- Local English OCR.
- Italian OCR code path.
- Local context normalization.
- Local message detection.
- Click and hotkey suggestion triggers.
- Desktop suggestion API.
- PKCE authentication architecture.
- Stripe and Supabase integration architecture.
- Electron packaging.
- Windows installer.
- Automated tests and security checks.

Current installer:

`apps/desktop/out/make/squirrel.windows/x64/MiloSetup.exe`

## 18. Remaining production work

### External configuration

- Create/configure production Supabase project.
- Configure OAuth desktop client and redirect.
- Configure email delivery.
- Configure MFA/AAL2.
- Apply database migrations.
- Configure OpenRouter server key.
- Review OpenRouter providers.
- Configure Stripe product, price and webhook.
- Configure rate-limit secrets.
- Deploy the Next.js backend.

### Windows release

- Obtain an Authenticode certificate.
- Sign Milo.exe, the C# helper and installer.
- Configure secure update channels.
- Test fresh installation, upgrade and uninstall.
- Test SmartScreen reputation.
- Run malware scanning.

### Product validation

- Test with 20–30 real users.
- Support WhatsApp first.
- Measure repeat use.
- Obtain at least five genuine paying users.
- Improve reply personalization.
- Improve installation and window-selection failures.
- Validate pricing before adding more features.

### Legal and privacy

- Professional Privacy Policy review.
- Terms of Service review.
- AI disclosure.
- User-consent language.
- Data Processing Agreement review.
- Deletion and support procedures.
- Incident-response plan.

## 19. Immediate execution order

The next work should happen in this order:

1. Protect the project with a clean Git commit and private remote backup.
2. Configure a staging Supabase project.
3. Configure desktop OAuth, email, MFA and adult eligibility.
4. Apply migrations.
5. Configure staging OpenRouter.
6. Test a real selected-window-to-AI suggestion.
7. Configure Stripe test mode.
8. Test complete subscription lifecycle.
9. Improve the compact floating UI and onboarding.
10. Run real WhatsApp Desktop testing.
11. Recruit private beta users.
12. Fix reliability and reply-quality problems.
13. Obtain Windows signing.
14. Deploy production backend.
15. Release a staged signed Windows beta.
16. Build mobile screenshot/share versions only after Windows validation.

## 20. Definition of Milo complete

Milo is ready only when a new user can:

```text
Download a signed installer
→ install without security confusion
→ understand Milo’s privacy boundary
→ sign in securely
→ select WhatsApp
→ see exactly which window is watched
→ receive a new message
→ click Milo
→ preview the minimal text being sent
→ receive three good replies
→ edit or copy one
→ send it manually
→ manage or cancel the subscription
→ pause or delete the account safely
```

And testing proves:

- Screenshots remain local.
- OCR remains local.
- Only minimal text reaches the backend.
- Conversations and replies are not stored.
- Billing and quota cannot be bypassed.
- Electron remains sandboxed.
- Milo never automatically sends messages.
- The installer is signed.
- Production integrations have been tested with real staging services.
