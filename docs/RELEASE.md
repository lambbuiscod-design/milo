# Milo release contract

## Reproducible tools

Use Windows x64, Node **24.19.0** (`.node-version`), pnpm **10.34.5**
(`packageManager`), and .NET SDK **10.0.302** (`global.json`). Put those
executables on PATH before running commands. The SDK cannot roll forward.
Portable installations are supported; set `DOTNET_ROOT` to the portable SDK
directory. Do not rely on the system Node or SDK being the correct version.

Run `pnpm install --frozen-lockfile`. Both native projects use committed
`packages.lock.json` files and locked restores. A deliberate native dependency
update requires reviewing a restore with `-p:RestoreLockedMode=false
--force-evaluate`, committing the resulting lockfile, then proving that a
normal locked restore succeeds. Never disable locked mode in CI.

`pnpm native:build` builds the helper and synthetic fixture.
`pnpm native:publish` publishes the self-contained helper for win-x64.
`pnpm desktop:package` and `pnpm desktop:make` always publish the helper before
staging it. Staging rejects a missing executable or bundled runtime. Users
of a packaged app do not need the .NET SDK or runtime installed separately.

## Local verification

Install Chromium once with `pnpm exec playwright install chromium`.
Run `pnpm release:verify` from the repository root. It stops at the first
failure and runs frozen install, lint, all TypeScript/unit tests, source
security contracts, compiled native protocol tests, native builds, web and
Electron builds, mocked and production browser tests, Electron shell smoke,
installer creation, artifact scanning, ASAR tamper rejection and production
dependency audit. A passed check does not suppress a later failed check.

Unit mocks use synthetic conversations. The native protocol test sends only
malformed or unsupported requests and an unselected identity; it never reads
an actual chat. Live UIA/OCR verification uses the separate synthetic
`Milo.TestChat` fixture, on an interactive Windows desktop. Publish that
fixture before running `pnpm test:native:live-uia` or
`pnpm test:native:live-ocr`; verify English and Italian recognizer availability.

Generated outputs under `apps/desktop/out`, `apps/desktop/native-runtime`,
native `bin`/`obj`, `artifacts` and browser test reports are not source and must
not be committed. Source/test lint rules remain enabled.

## Release states

1. **Locally verified:** `release:verify` passed for the exact source revision.
   Generated app/installers are unsigned internal test artifacts.
2. **Configured:** `pnpm release:check` passes. This checks environment names,
   URLs, legal placeholders, Git cleanliness and deployment linkage only. It
   does not prove valid credentials, running integrations or production safety.
3. **Production approved:** all mandatory gates in `SECURITY.md` and
   `docs/SECURITY-INVARIANTS.md` have evidence for that revision. This includes
   Supabase migration reset/pgTAP security tests, real PKCE/MFA and SMTP,
   Stripe lifecycle, provider privacy review, legal approval, live selected
   window/UIA/OCR and pause/close checks, and Authenticode verification of the
   helper, app and installer. Generate and verify SHA-256 checksums after
   signing. Publish only approved signed artifacts through the protected
   release process.

Do not distribute unsigned test artifacts as a production release. There is
no automatic production promotion in `release:verify` or `release:check`.
Missing external credentials or signing identity remain release blockers.

## CI and branch contract

The current default branch is `codex/milo-release`. Security, CodeQL and
Windows desktop checks run for pushes to it and to `main`, and for pull
requests. Require the relevant green jobs before release. Windows CI uses
the same pinned tools and native scripts as local development. Database
tests run against a disposable Supabase instance on the Linux CI runner.
Private-repository CodeQL availability depends on the GitHub account plan.

Keep failures visible. Do not weaken assertions, disable security options,
silently fall back to fabricated suggestions, or rename failing checks as
passing to obtain a release.
