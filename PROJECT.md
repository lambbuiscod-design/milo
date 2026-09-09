# Project: Milo UI/UX Premium Overhaul

## Architecture
- **Monorepo Structure**: Pnpm workspace managing `apps/desktop` (Electron + React), `apps/web` (Next.js + Tailwind + DaisyUI), and shared packages.
- **Design System & Theme Tokens**:
  - Electron Desktop: `apps/desktop/src/renderer/styles.css` defines warm ivory/sand background (`--surface`, `--surface-muted`), charcoal text (`--text-primary`, `--brand`), terracotta accents, and cat appearance color presets.
  - Web Application: `apps/web/src/app/globals.css` defines DaisyUI `milo` and `milo-dark` theme tokens, `--shadow-color`, and `.premium-button`.
- **Cat Mascot Invariants**:
  - SVG dimensions: `viewBox="0 0 128 128"`, crisp at 168×174px desktop window and h-40/h-64 web sizes.
  - States: idle, noticed, generating (3 pulsing dots), ready, paused, error.
  - Presets: Charcoal (#2b3044, ear #d97757, nose #c86d51), Slate (#4a5568, ear #7b8fab, nose #6b7fa0), Mauve (#7c6b7e, ear #b8939b, nose #a8838b), Caramel (#8b6a3e, ear #c49a6c, nose #b58a5c). Strictly non-gendered.
  - Accessibility: `role="img"`, `aria-label="Milo cat mascot"`.
- **IPC & Persistence Flow**:
  - Desktop settings: `updateSettings({ catAppearance })` -> validated via `updateSettingsSchema` in `validation.ts` -> persisted via `settings-store.ts` (`z.enum(["charcoal", "slate", "mauve", "caramel"]).default("charcoal")`) -> snapshot emitted -> `App.tsx` applies CSS variables on `document.documentElement.style`.
  - Web settings: stored in `localStorage` under key `milo_cat_appearance`.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Electron Cat Mascot Redesign | Softer curves, larger eyes with dual glints, attached curled tail, natural whiskers, 3 pulsing dots for generating state, viewBox 0 0 128 128, a11y preserved | M1 | Requirement R1 |
| 2 | Cat Appearance Presets & Persistence | Charcoal, Slate, Mauve, Caramel presets in contracts.ts, settings-store.ts, validation.ts, App.tsx CSS injection, and 28x28px swatch buttons in settings panel; web localStorage | M1 | Requirement R2 |
| 3 | Settings Store Persistence Unit Test | Add test asserting `catAppearance` roundtrip persistence and default value in settings store test suite | M1 | Requirement R2, R6 |
| 4 | Electron UI Styles Refinement | Refine .cat-dock hover ring, compact .watching-pill state dots, .panel__header border, .reply-card 4px border accents & copy button, .popout-bubbles SparkIcon, focus rings, swatch styling, reduced motion | M2 | Requirement R3 |
| 5 | Website Cat Mascot Upgrade | Align with desktop proportions (viewBox 0 0 128 128), warm charcoal body, terracotta ears & nose, white eye glints, happy & thinking moods, remove SSR-conflicting gradient IDs | M3 | Requirement R4 |
| 6 | Website Design Polish | Update .premium-button shadows, site-header clean badge & remove rotate tilt, hero clean whitespace, coach-workspace replace hardcoded blues with CSS variables | M3 | Requirement R5 |
| 7 | Full Verification, Security Audit & Build | Run desktop/web typecheck, vitest test suites, desktop security scan (AST check), and desktop production build | M4 | Requirement R6 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Electron Cat Mascot & Appearance Presets | `MiloCat.tsx`, `contracts.ts`, `settings-store.ts`, `validation.ts`, `App.tsx`, `settings-store.test.ts` | None | DONE |
| M2 | Electron UI Styles Refinement & Popout Bubbles | `styles.css`, `App.tsx`, `icons.tsx` | M1 | IN_PROGRESS |
| M3 | Website Cat Mascot & Design Polish | `milo-cat.tsx`, `globals.css`, `site-header.tsx`, `page.tsx`, `coach-workspace.tsx` | None | PLANNED |
| M4 | Comprehensive Verification, Security Audit & Build | `pnpm typecheck`, `pnpm test`, `desktop-security-check.mjs`, `pnpm build` | M1, M2, M3 | PLANNED |

## Interface Contracts

### 1. `CatAppearance` (`apps/desktop/src/shared/contracts.ts`)
```typescript
export type CatAppearance = "charcoal" | "slate" | "mauve" | "caramel";

export interface PublicSettings {
  // ... existing fields
  catAppearance?: CatAppearance;
}
```

### 2. Validation & Settings Store (`apps/desktop/src/shared/validation.ts` & `apps/desktop/src/main/settings-store.ts`)
```typescript
// In validation.ts:
catAppearance: z.enum(["charcoal", "slate", "mauve", "caramel"]).optional(),

// In settings-store.ts:
catAppearance: z.enum(["charcoal", "slate", "mauve", "caramel"]).default("charcoal"),
```

### 3. CSS Variable Preset Map (`apps/desktop/src/renderer/App.tsx`)
```typescript
const APPEARANCE_PRESETS: Record<CatAppearance, { cat: string; ear: string; nose: string }> = {
  charcoal: { cat: "#2b3044", ear: "#d97757", nose: "#c86d51" },
  slate: { cat: "#4a5568", ear: "#7b8fab", nose: "#6b7fa0" },
  mauve: { cat: "#7c6b7e", ear: "#b8939b", nose: "#a8838b" },
  caramel: { cat: "#8b6a3e", ear: "#c49a6c", nose: "#b58a5c" },
};
```

## Code Layout
- `apps/desktop/src/renderer/MiloCat.tsx` — Electron Cat Mascot SVG with 6 states and pulsing thinking dots (DONE)
- `apps/desktop/src/shared/contracts.ts` — Shared types including `CatAppearance` and `PublicSettings` (DONE)
- `apps/desktop/src/shared/validation.ts` — Settings update schema validation (DONE)
- `apps/desktop/src/main/settings-store.ts` — Electron settings persistence with zod schema and `getPublicSettings()` (DONE)
- `apps/desktop/src/renderer/App.tsx` — Desktop UI with appearance CSS injector, swatch buttons, and popout bubbles (DONE)
- `apps/desktop/src/renderer/styles.css` — Electron CSS styling for cat dock, watching pill, reply cards, swatches, focus rings (M2)
- `apps/desktop/src/renderer/icons.tsx` — Icon definitions including SparkIcon (M2)
- `apps/desktop/tests/settings-store.test.ts` — Settings store unit tests including `catAppearance` persistence (DONE)
- `apps/web/src/components/milo-cat.tsx` — Website Cat Mascot SVG (happy & thinking moods) (M3)
- `apps/web/src/app/globals.css` — Web styles and premium button shadows (M3)
- `apps/web/src/components/site-header.tsx` — Header component with redesigned cat and clean badge (M3)
- `apps/web/src/app/page.tsx` — Landing page with hero cat display and refined whitespace (M3)
- `apps/web/src/components/coach-workspace.tsx` — Dashboard workspace with tokenized CSS variables (M3)
