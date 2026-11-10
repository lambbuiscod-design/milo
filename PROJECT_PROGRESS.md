# Milo GitHub dependency security follow-up

## November 10, 2026

- Updated the public dependency graph to patched Next.js 16.4.1, Sharp 0.35.5,
  Zod 4.6.6, Electron 43.8.1, Vite 7.3.7 and Vitest 4.1.12, plus compatible
  transitive fixes. Removed unused Three.js prototype dependencies; remote source
  has no imports of those packages. Node is pinned to 24.19.0 LTS.
- Scoped minimatch 11.0.1 to the Electron universal and TypeScript-ESLint callers;
  retained legacy consumers on their supported patched majors. Added tests of
  actual caller module loading, matching options and hostile-pattern bounds.
- Fresh local production and full dependency audits: no known vulnerabilities.
  Frozen strict-peer installation and four dependency regression tests passed.
- CI now checks development dependencies as well as production dependencies and
  runs the new regressions. Windows CI explicitly installs the pinned Electron
  runtime with the official checksum-verifying installer.
- Full local lint was attempted and failed on unrelated pre-existing uncommitted
  desktop/window-confirmation and privacy-page edits. Those application changes
  are excluded from this GitHub patch. Typecheck, tests, builds and remote CI
  must be checked independently; this commit is not a production release claim.
- GitHub secret scanning, push protection and Dependabot protection remain
  enabled. No environments, keys, local user edits or generated artifacts are
  included. Production configuration, provider credential rotation, signing and
  live-service security verification remain independent release requirements.
