# Milo V2 Architecture Audit & Technical Blueprint

**Document Version**: 2.0.0  
**Date**: 2026-09-08  
**Scope**: Repository Audit, Architectural Map, Technical Debt, and Integration Design for Milo V2 Desktop Companion Upgrade (Milestone 1 — Requirement R1)  
**Target Output**: `docs/milo_v2_architecture_audit.md`  
**Author**: `orch5_worker_m1` (incorporating audit by `orch5_explorer_m1_1`)  

---

## Executive Summary

This document provides a comprehensive architectural audit of the Milo project across its Electron desktop companion (`apps/desktop`), Next.js web application (`apps/web`), shared workspace packages (`packages/*`), and Windows native helper (`native/*`).

Milo is transitioning from a utility-oriented AI response assistant to an engaging, premium desktop companion (**Milo V2**). V2 introduces an interactive character engine (cat mascot moods, animations, customization, room environment) and a local SQLite-backed progression system (XP, levels, achievements, stats, streaks), all while maintaining strict offline privacy, zero-knowledge security invariants, and a responsive, non-intrusive floating desktop presence.

---

## 1. Repository Anatomy & Monorepo Configuration

The repository is structured as a `pnpm` workspace with hoisted dependencies and strict build controls.

```
milo/
├── apps/
│   ├── desktop/                 # Electron 43 + React 19 + Vite 7 floating companion app
│   │   ├── src/
│   │   │   ├── main/            # Electron main process (lifecycle, IPC, window, OCR, UIA)
│   │   │   ├── preload/         # Context isolation bridge (strict 18-method allowlist)
│   │   │   ├── renderer/        # React 19 UI (App.tsx, MiloCat.tsx, styles.css, audio.ts)
│   │   │   ├── shared/          # Shared contracts, position math, validation, state machine
│   │   │   └── types/           # Type declarations
│   │   ├── tests/               # 23 Vitest test suites (226 unit & integration tests)
│   │   ├── vite.main.config.ts
│   │   ├── vite.preload.config.ts
│   │   └── vite.renderer.config.ts
│   └── web/                     # Next.js 16 + Tailwind CSS 4 + DaisyUI 5 web application
│       ├── src/
│       │   ├── app/             # App Router pages (/, /dashboard, /account, /api/v1/suggest)
│       │   ├── components/      # UI components (coach-workspace, milo-cat, site-header)
│       │   └── lib/             # Backend utilities, Supabase auth, Stripe billing, OpenRouter
│       └── tests/               # 26 Vitest test suites (119 unit & contract tests)
├── packages/
│   ├── ai/                      # Shared AI provider prompts and output normalization
│   ├── contracts/               # Shared analysis contracts and Zod schemas
│   ├── security/                # Safety filter checks and redaction logic
│   └── test-fixtures/           # Standardized test assets and fixture generators
├── native/
│   ├── Milo.NativeHelper/       # .NET 9 C# helper for Windows Graphics Capture & UIA
│   └── Milo.TestChat/           # Offline UIA/OCR test fixture app
├── scripts/
│   ├── desktop-security-check.mjs  # AST security gate verifying CSP, preload & sandbox invariants
│   ├── native-build.mjs            # Build script for .NET native helper
│   └── stage-native-runtime.mjs    # Packaging staging script
└── docs/                        # Specifications, security invariants, and audits
```

### Workspace Configuration Highlights
- **Package Manager**: `pnpm@10.34.5` (`pnpm-workspace.yaml`).
- **Build Settings**: `nodeLinker: hoisted`, `strictDepBuilds: true`.
- **Target Node Version**: `24.x` (supported through modern LTS).
- **Test Command**: `pnpm test` (executes Vitest across 6 workspace projects, total 363 passing tests).

---

## 2. Technology Stack & Framework Inventory

| Layer / Subsystem | Technology | Version | Key Responsibilities |
|---|---|---|---|
| **Desktop Shell** | Electron | 43.4.1 | Process isolation, window positioning, global hotkeys, capture |
| **Desktop Build Tooling** | Vite + Electron Forge | 7.3.6 / 7.11.2 | Multi-target compilation (main, preload, renderer), Squirrel packaging |
| **Desktop Renderer** | React | 19.2.8 | Declarative UI, state-driven SVG cat mascot, popout speech bubbles |
| **Desktop Styling** | Custom CSS Variables | N/A | Warm sand/dark slate tokens, DaisyUI semantic emulation |
| **Desktop Audio** | Web Audio API | Native Browser | Zero-asset synthetic acoustic feedback (purrs, pops, clicks, chimes) |
| **Web Application** | Next.js (App Router) | 16.2.12 | Landing page, web dashboard, billing portal, API control plane |
| **Web Styling** | Tailwind CSS 4 + DaisyUI 5 | 4.x / 5.0.0 | Responsive design system, theme tokens (`milo`, `milo-dark`) |
| **Data Validation** | Zod | 4.4.3 | Strict `.strict()` validation on all IPC payloads and settings |
| **OCR Engine** | Tesseract.js | 7.0.0 | Local on-device character recognition; immediate pixel zeroing |
| **Native Helper** | .NET 9 (C#) | 9.0 | Windows UI Automation tree reading & Windows.Graphics.Capture |
| **Authentication** | Supabase SSR / PKCE | 0.12.4 / 2.111.0 | External browser OAuth 2.0 with loopback callback server |
| **AI Provider Client** | OpenRouter SDK | 1.2.3 | Server-side LLM inference with zero data retention (ZDR) |
| **Testing** | Vitest | 4.1.10 | Fast in-memory unit, contract, and renderer component testing |

---

## 3. Current Architecture & Data Flow

### 3.1 Process Separation & Security Boundary
Milo Desktop strictly enforces the Chromium security sandbox and Electron process isolation:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Operating System                               │
└────────┬────────────────────────────────┬───────────────────────────▲───────┘
         │                                │ (Global Alt+S)            │
         ▼                                ▼                           │
┌───────────────────────────────────────────────────────────────────┐ │ (Clipboard
│                     Electron Main Process                         │ │  Copy)
│  ┌─────────────────────────────────────────────────────────────┐  │ │
│  │ index.ts: Lifecycle, Protocol (milo://app), App Sandbox    │  │ │
│  └──────────────────────────────┬──────────────────────────────┘  │ │
│                                 │                                 │ │
│  ┌──────────────────────────────▼──────────────────────────────┐  │ │
│  │ desktop-ipc.ts: IPC Handlers & State Broadcaster            │  │ │
│  │  - Validates senderFrame, origin, webContents ID            │  │ │
│  │  - Emits DesktopSnapshot over 'milo:state-changed'          │  │ │
│  └──────┬───────────────────────┬──────────────────────────────┘  │ │
│         │                       │                                 │ │
│         ▼                       ▼                                 │ │
│  ┌──────────────┐      ┌─────────────────┐                        │ │
│  │ SettingsStore│      │  OverlayControl │                        │ │
│  │ (JSON File)  │      │  (Bounds/Dock)  │                        │ │
│  └──────────────┘      └─────────────────┘                        │ │
│         │                       │                                 │ │
│         ▼                       ▼                                 │ │
│  ┌──────────────┐      ┌─────────────────┐      ┌──────────────┐  │ │
│  │WindowCapturer│      │  NativeHelper   │      │ Suggestion   │  │ │
│  │(DesktopCap)  │      │  (UIA / C# exe) │      │ Client(HTTPS)│  │ │
│  └──────┬───────┘      └────────┬────────┘      └──────▲───────┘  │ │
│         │                       │                      │          │ │
│         ▼                       ▼                      │          │ │
│  ┌──────────────┐      ┌─────────────────┐             │          │ │
│  │  OcrEngine   │─────▶│ ContextNormalize│─────────────┘          │ │
│  │(Tesseract.js)│      │ (Strip Names)   │                        │ │
│  └──────────────┘      └─────────────────┘                        │ │
└─────────────────────────────────┬─────────────────────────────────┘─┼─┘
                                  │ IPC (milo:*)                      │
                                  ▼                                   │
┌───────────────────────────────────────────────────────────────────┐ │
│                     Preload Process (preload.cjs)                 │ │
│  - contextBridge.exposeInMainWorld("milo", api)                   │ │
│  - Strict PRELOAD_METHOD_ALLOWLIST (18 methods)                   │ │
│  - No direct ipcRenderer, Node, or remote access exposed          │ │
└─────────────────────────────────┬─────────────────────────────────┘ │
                                  │ window.milo                       │
                                  ▼                                   │
┌───────────────────────────────────────────────────────────────────┐ │
│                     Renderer Process (React 19)                   │ │
│  - CSP: default-src 'none'; script-src 'self'; connect-src 'none' │ │
│  - App.tsx: Floating Cat Dock, Watching Pill, Popout Bubbles      │ │
│  - MiloCat.tsx: SVG Vector Mascot (idle/notice/gen/ready/paused)  │ │
│  - audio.ts: Synthesized Sound Effects (Clicks, Pops, Purrs)      │ │
│  - styles.css: CSS Tokens & Theme Variables                       │─┘
└───────────────────────────────────────────────────────────────────┘
```

### 3.2 State Management & Snapshot Synchronization
The application state follows a single-direction reactive pipeline:
1. **Source of Truth**: The Electron Main Process maintains the canonical state (`DesktopState`, `WatchingState`, `PublicSettings`, `AuthSummary`, `SyntheticSuggestion[]`, `lastAction`).
2. **Persistence**: `ContentFreeSettingsStore` stores persistent configuration in `%APPDATA%/Milo/milo-settings.json`. It guarantees:
   - Atomic writes (`.tmp` + `fsyncSync` + `renameSync`).
   - Maximum byte cap (32 KB).
   - Strict Zod validation prohibiting content-bearing fields (no transcripts, no OCR text, no clipboard, no tokens).
3. **Broadcasting**: Any state change triggers `publish()`, which serializes `DesktopSnapshot` and sends it via `window.webContents.send("milo:state-changed", snapshot)`.
4. **Renderer Consumption**: `App.tsx` subscribes to `window.milo.onStateChanged((next) => setSnapshot(next))` and updates React UI without polling.
5. **CSS Variable Binding**: `App.tsx` updates `document.documentElement` attributes (`data-theme`, `data-reduced-motion`, `data-cat-appearance`) and custom properties (`--cat`, `--cat-ear`, `--cat-nose`, `--cat-badge`) whenever snapshot settings mutate.

### 3.3 Existing AI & Screen Capture Features
- **Selected Window Capture**: `WindowCaptureService` captures bitmap frames strictly for the user-selected window HWND via `desktopCapturer`. Monitor-wide capture is prohibited.
- **Local OCR Extraction**: `DesktopOcrEngine` parses conversation text locally using `tesseract.js` (with C# native OCR fallback). Frame buffers are immediately zeroed (`imageBuffer.fill(0)`).
- **Context Normalization**: `normalizeRecentContext` extracts the latest 4, 6, or 8 messages, strips participant names, and sanitizes line breaks.
- **Change Detection**: `ContextChangeDetector` hashes recent context to alert the user of new messages without initiating unsolicited AI requests.
- **Popout Suggestion Bubbles**: When suggestions arrive, `PopoutBubbles` displays 3 reply cards (Safe, Confident, Playful). Clicking copies the text to the clipboard and closes the bubble immediately.
- **Stealth Global Hotkey**: `Alt+S` triggers capture and suggestion generation from the background without stealing focus from active chat applications.

---

## 4. Milo V2 Integration Points: SQLite Progression & Character Engine

Milestone 1 lays the foundation for two core subsystems arriving in Milo V2:
1. **SQLite-Based Progression System** (XP, Levels, Achievements, Stats, Streaks).
2. **Interactive Character Engine** (Cat Moods, Animated Behaviors, Customization, Virtual Room).

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                Milo V2 Core                                 │
├──────────────────────────────────────┬──────────────────────────────────────┤
│       Subsystem 1: Progression       │     Subsystem 2: Character Engine    │
│  - User Level & XP Tracking          │  - Dynamic Mascot Moods (6 -> 12+)   │
│  - Milestone Achievements & Badges   │  - State & Activity SVG Animations   │
│  - Activity Streaks & Daily Quests   │  - Wearable Accessories / Customizer │
│  - Local Interaction Analytics       │  - Virtual Room Environment & Decor  │
└──────────────────────────────────────┴──────────────────────────────────────┘
```

### 4.1 SQLite Progression System Integration

#### A. Database Singleton Placement
- **Location**: `apps/desktop/src/main/db.ts`
- **File Storage**: `path.join(app.getPath("userData"), "milo.db")`
- **Database Engine**: `better-sqlite3`
- **Configuration**:
  - `journal_mode = WAL` (Write-Ahead Logging for high-concurrency read/write).
  - `synchronous = NORMAL`.
  - `foreign_keys = ON`.
  - In-memory mode support (`:memory:`) for Vitest unit testing.

```typescript
// Interface in apps/desktop/src/main/db.ts
import Database from "better-sqlite3";

export type DatabaseOptions = {
  path?: string;
  inMemory?: boolean;
  readonly?: boolean;
};

export function getDatabase(options?: DatabaseOptions): Database.Database;
export function closeDatabase(): void;
export function isDatabaseOpen(): boolean;
export function setDatabasePath(path: string | null): void;
```

#### B. Rollup / Vite Bundling Configuration
Because `better-sqlite3` contains compiled C++ native binaries (`better_sqlite3.node`), Vite cannot bundle it into JavaScript. It **must** be marked external in `apps/desktop/vite.main.config.ts`:

```typescript
// apps/desktop/vite.main.config.ts
rollupOptions: {
  external: [
    "electron",
    "better-sqlite3", // MUST BE MARKED EXTERNAL
    "tesseract.js",
    "tesseract.js-core",
    "@tesseract.js-data/eng",
    ...nodeBuiltins,
  ],
}
```

#### C. Database Schema Design (Prepared for Subsequent Milestones)
The schema cleanly separates progression from volatile conversation context (preserving privacy invariants):

```sql
-- Migration tracking
CREATE TABLE IF NOT EXISTS schema_versions (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL
);

-- User XP, Level, and Streaks
CREATE TABLE IF NOT EXISTS user_progression (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  current_xp INTEGER NOT NULL DEFAULT 0,
  current_level INTEGER NOT NULL DEFAULT 1,
  current_streak_days INTEGER NOT NULL DEFAULT 0,
  last_active_date TEXT,
  updated_at INTEGER NOT NULL
);

-- Achievements & Unlockables
CREATE TABLE IF NOT EXISTS achievements (
  id TEXT PRIMARY KEY,
  unlocked_at INTEGER,
  progress INTEGER NOT NULL DEFAULT 0,
  max_progress INTEGER NOT NULL DEFAULT 1
);

-- Aggregate Usage Stats (Content-Free)
CREATE TABLE IF NOT EXISTS companion_stats (
  stat_key TEXT PRIMARY KEY,
  stat_value INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

-- Cat Customization & Room Inventory
CREATE TABLE IF NOT EXISTS user_inventory (
  item_id TEXT PRIMARY KEY,
  item_type TEXT NOT NULL, -- 'accessory', 'room_decor', 'cat_skin'
  is_equipped INTEGER NOT NULL DEFAULT 0,
  unlocked_at INTEGER NOT NULL
);
```

#### D. IPC and Snapshot Propagation Strategy
To avoid modifying the strict `PRELOAD_METHOD_ALLOWLIST` and breaking `desktop-security-check.mjs`, progression updates can be propagated via two elegant architectural patterns:
- **Pattern A (Recommended - Zero Preload Surface Churn)**: Extend `DesktopSnapshot` in `apps/desktop/src/shared/contracts.ts` with an optional `progression?: PublicProgressionSummary` field. The main process updates progression upon user events (e.g. copying a reply grants +10 XP) and pushes the updated snapshot via the existing `milo:state-changed` channel.
- **Pattern B (Query on Demand)**: Expose `getProgression()` and `equipItem()` through preload, simultaneously updating `PRELOAD_METHOD_ALLOWLIST` and `scripts/desktop-security-check.mjs`.

### 4.2 Character Engine Integration

#### A. Expanded Cat Mascot Moods
Currently, `MiloCat.tsx` supports 6 operational states: `idle`, `noticed`, `generating`, `ready`, `paused`, `error`.
The V2 Character Engine separates **operational state** from **emotional mood**:
- **Operational State**: What Milo is doing (`idle`, `watching`, `thinking`, `suggesting`, `paused`, `error`).
- **Emotional Mood**: How Milo feels based on progression, streaks, and user interactions:
  - `happy`: Ears perked, smiling mouth, gentle tail sway.
  - `playful`: Wide pupils, bouncing pose, playful paws.
  - `sleepy`: Half-closed eyes, slow breathing animation, gentle tail curl.
  - `proud`: Wearing unlocked badges/hats, puffed chest.
  - `curious`: Head tilt, single ear twitch.

#### B. Modular SVG Asset Pipeline
`MiloCat.tsx` will be refactored into composable SVG layers:
1. **Base Anatomy**: Body, head, ears, tail (styled via `--cat`, `--cat-ear`, `--cat-nose`).
2. **Expression Layer**: Eyes, mouth, whiskers, cheeks (driven by `mood`).
3. **Accessory Slot**: Hats, collars, glasses (rendered from `equippedAccessoryId`).
4. **Animation Layer**: Keyframe/CSS transitions for blinking, ear twitching, tail swishing, and purr ripples.

#### C. Milo's Virtual Room
A dedicated companion view will render a cozy 2D environment:
- Cat tree / cushion.
- Desk toys (yarn ball, coffee mug, tiny laptop).
- Window view reflecting the user's local time of day (daylight, dusk, nighttime).
- Unlockable furniture items purchased with XP earned from chat assists.

---

## 5. Technical Debt & Friction Point Analysis

| Category | Finding / Friction Point | Impact | Recommended Solution |
|---|---|---|---|
| **Architecture** | **Monolithic `App.tsx` (1,154 lines)**: Single file houses cat dock, watching pill, popout bubbles, workspace dialog, settings drawer, privacy preview, and audio controls. | High cognitive load; risk of merge conflicts; difficult to isolate component tests. | Decompose `App.tsx` into modular feature components: `CatDock`, `PopoutBubbles`, `CompanionPanel`, `SettingsDrawer`, `WindowPickerModal`, `PrivacyPreviewModal`. |
| **Styling** | **Monolithic `styles.css` (2,454 lines)**: Huge stylesheet mixing reset styles, custom variables, DaisyUI class simulations (`.card`, `.btn`), and nested selectors. | Difficult to trace token inheritance; potential CSS specificity clashes. | Introduce modular CSS imports or scoped CSS modules while anchoring global design tokens at `:root`. |
| **UI Design** | **"Card Inside Card" Nesting**: UI relies heavily on nested `.card` and `.settings-block` wrappers, creating visual clutter and borders inside borders. | Cluttered appearance; reduced aesthetic elegance. | Implement Milestone 1 Requirement R3: clean, non-nested primitives (`Card`, `Button`, `Container`, `Stack`) with distinct visual roles. |
| **Security Gates** | **Rigid AST Preload Allowlist**: `scripts/desktop-security-check.mjs` strictly enforces 18 exact preload methods. | Any new preload API addition causes CI failure unless test script and contracts are updated simultaneously. | Extend `DesktopSnapshot` for progression rather than expanding preload method count; if new methods are required, update AST list deliberately. |
| **Dependencies** | **Native C++ Module Compatibility**: `better-sqlite3` requires compilation matching Electron 43 ABI. `pnpm-workspace.yaml` has `strictDepBuilds: true`. | Risk of `MODULE_NOT_FOUND` or ABI mismatch errors during build or packaging if not configured in `allowBuilds` and rollup externals. | Mark `better-sqlite3` as `external` in `vite.main.config.ts`, configure `pnpm-workspace.yaml` `allowBuilds`, and ensure `@electron/rebuild` support. |
| **Environment** | **PowerShell Execution Policy**: Windows machines frequently block `pnpm.ps1` script execution (`PSSecurityException`). | Commands like `pnpm test` fail unless invoked via `pnpm.cmd` or `cmd /c pnpm`. | Document `pnpm.cmd` standard in development guides and scripts. |
| **Type Contracts** | **Dispersed Contracts**: `packages/contracts` only contains `analysis.ts`, while `apps/desktop/src/shared/contracts.ts` contains all desktop types. | Logic duplication if web app needs progression or character types in the future. | Place shared V2 domain types (Progression, Inventory, Achievements) in `packages/contracts` or export cleanly from desktop shared. |

---

## 6. Milestone 1 Implementation Roadmap

Milestone 1 establishes the design system foundation, token architecture, and SQLite infrastructure without altering existing core AI or capture logic:

### Phase 1: Project Audit & Documentation (Requirement R1) — COMPLETED
- [x] Complete comprehensive audit of desktop app, web app, and shared packages.
- [x] Document architecture, security invariants, data flow, and tech debt.
- [x] Design integration blueprint for SQLite progression and character engine.
- [x] Produce `docs/milo_v2_architecture_audit.md` blueprint.

### Phase 2: Design Tokens & Typography Scale (Requirement R2)
- [ ] Implement global color tokens in `apps/desktop/src/renderer/styles.css`:
  - `--bg-primary: #10131F` (deep midnight companion background).
  - `--milo-coral: #FF8066` (warm signature accent).
  - Surface layers: `--surface-primary`, `--surface-elevated`, `--surface-subtle`.
  - Border and text hierarchy tokens.
- [ ] Implement typography scale:
  - H1: 30px (font-weight: 700).
  - H2: 22px (font-weight: 600).
  - H3: 18px (font-weight: 600).
  - Body: 15px (font-weight: 400 / 500).
  - Caption / Meta: 11px–13px.
- [ ] Provide backward-compatible CSS variable aliasing to ensure existing components and tests experience zero visual or functional regressions.

### Phase 3: Reusable UI Primitives (Requirement R3)
- [ ] Create `apps/desktop/src/renderer/components/primitives/`:
  - `Button.tsx`: Variants (`primary`, `secondary`, `ghost`, `danger`), sizes (`sm`, `md`, `lg`), focus rings, icon slots.
  - `Card.tsx`: Flat, outlined, elevated, and interactive variants; subtle borders; no unnecessary nesting.
  - `Container.tsx`: Standardized padding, flex/grid alignment, `Stack`, and `SectionGroup` layout organizers.
  - `index.ts`: Barrel export.

### Phase 4: SQLite Preparation (Requirement R4)
- [ ] Install `better-sqlite3` and `@types/better-sqlite3` in `@milo/desktop`.
- [ ] Configure `vite.main.config.ts` to mark `better-sqlite3` as external.
- [ ] Implement database singleton in `apps/desktop/src/main/db.ts` (`getDatabase()`, `closeDatabase()`).
- [ ] Add unit test in `apps/desktop/tests/db.test.ts` verifying connection instantiation and `SELECT 1` execution.
- [ ] Verify `pnpm --filter @milo/desktop test` and `node scripts/desktop-security-check.mjs` pass.

---

## 7. Verification & Invalidation Criteria

### Automated Verification Gates
1. **Typecheck**:
   ```powershell
   cmd /c pnpm --filter @milo/desktop typecheck
   ```
   *Pass Criteria*: 0 type errors across main, preload, renderer, and test tsconfigs.
2. **Unit Test Suite**:
   ```powershell
   cmd /c pnpm --filter @milo/desktop test
   ```
   *Pass Criteria*: All 23+ test suites (226+ tests) pass without regression.
3. **Security Gate**:
   ```powershell
   node scripts/desktop-security-check.mjs
   ```
   *Pass Criteria*: AST scanner confirms CSP, sandbox, preload allowlist, and fuse compliance.
4. **Desktop Build**:
   ```powershell
   cmd /c pnpm --filter @milo/desktop build
   ```
   *Pass Criteria*: Vite successfully bundles renderer, preload, and main outputs into `.vite/`.

### Invalidation Conditions
This architecture blueprint is invalidated if:
- Any proposed change requires relaxing `sandbox: true`, `contextIsolation: true`, or `nodeIntegration: false`.
- Any SQLite data model introduces storage of plaintext chat transcripts, screenshots, or participant names.
- Native SQLite dependencies cause unresolvable build failures in the packaged Electron distribution.
