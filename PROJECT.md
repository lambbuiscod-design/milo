# Project: Milo Screen Capture & Local OCR Integration

## Architecture
- **Monorepo Structure**: Pnpm workspace managing `apps/desktop`, `apps/web`, and packages (`ai`, `contracts`, `security`, `test-fixtures`).
- **Main Process Exclusivity**: Screen capture (`desktopCapturer`) and Local OCR (`tesseract.js` in Node `worker_threads.Worker`) execute strictly within the Electron Main Process.
- **Renderer Security Invariant**: The desktop renderer BrowserWindow CSP strictly enforces `worker-src 'none'` and sandboxing. Raw window pixel buffers and raw OCR text NEVER cross IPC into the renderer.
- **Content-Free UI Bridge**: The renderer sends content-free trigger signals (`askMilo({ mode: "screen_capture" })`) and receives only sanitized suggestion snapshots (`safe`, `confident`, `playful` reply cards).
- **Data Flow**:
  1. UI Trigger ("Screenshot" button in companion rail / "Suggest" button / `Ctrl+Shift+M`) -> IPC `milo:ask-milo`.
  2. Main Process captures target window frame via `desktopCapturer.getSources({ types: ["window"] })`.
  3. Window thumbnail converted in-memory to lossless PNG Buffer (`thumbnail.toPNG()`).
  4. Local OCR (`DesktopOcrEngine` via Tesseract.js LSTM offline model) extracts text from Buffer.
  5. Text normalized & bounded via `normalizeRecentContext()` (<=8 messages, <=4,000 characters).
  6. `DesktopSuggestionClient.suggest()` generates 3 categorized replies (`safe`, `confident`, `playful`).
  7. State transitions to `ready`; snapshot emitted via `milo:state-changed`; DaisyUI reply cards render in UI.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Window Candidate Enumeration & Chat Prioritization | Use `desktopCapturer.getSources` with 0x0 thumbnail in Main process; regex matching for WhatsApp and Discord titles; prioritize chat windows at top of candidates list | M1 | Survey / R1 |
| 2 | On-Demand High-Res Window Capture | Capture high-resolution thumbnail (1920x1080) for selected window; convert to lossless PNG buffer; detect minimized/empty windows gracefully | M1 | Survey / R1 |
| 3 | Local Offline OCR Engine (`DesktopOcrEngine`) | Tesseract.js v7 + offline integer-quantized LSTM model (`@tesseract.js-data/eng`); run in Node.js `worker_threads` in Main process; 100% offline | M2 | Survey / R2 |
| 4 | Standard Test Fixture & Programmatic OCR Verification | High-contrast synthetic chat test fixture PNG; automated Vitest test asserting exact text extraction and bounds | M2 | Survey / R2, Acceptance Criteria |
| 5 | Context Normalization & Suggestion Client Feeding | Normalize OCR text via `normalizeRecentContext` (max 8 messages, max 4,000 chars, participant redaction); feed into `DesktopSuggestionClient.suggest()` | M3 | Survey / R3 |
| 6 | IPC Trigger & Preload Surface Integrity | Support screen capture triggering via `askMilo({ mode: "selected_window" | "screen_capture" })`; preserve 18-method allowlist and CSP `worker-src 'none'` | M3 | Survey / R3, Security |
| 7 | UI Affordance & DaisyUI Reply Cards Display | Enable companion rail "Screenshot" button; wire to capture pipeline; display Safe, Confident, Playful reply cards with DaisyUI styling and copy feedback | M3 | Survey / R3, Acceptance Criteria |
| 8 | E2E Testing Suite (Tiers 1-4) | Opaque-box test harness verifying window capture, OCR parsing, suggestion pipeline, boundary cases, and error handling | E2E / M4 | Survey / Acceptance Criteria |
| 9 | Adversarial Hardening (Tier 5) | White-box stress testing, corrupted buffers, rapid triggers, missing models, oversized text, minimized windows | M4 | Survey / Acceptance Criteria |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Screen Capture & Window Selection | `window-selection.ts`, `window-capturer.ts`, unit tests | None | DONE |
| M2 | Local OCR Engine & Programmatic Test | `ocr-engine.ts`, `synthetic-chat-fixture.ts`, `ocr-engine.test.ts` | None | DONE |
| M3 | Suggestion Pipeline Integration & UI Trigger | `desktop-ipc.ts`, `contracts.ts`, `validation.ts`, `App.tsx`, integration test | M1, M2 | DONE |
| M4 | E2E Test Pass & Adversarial Hardening | Verification of 100% E2E tests (Tiers 1-4) and Tier 5 adversarial stress testing | M3, E2E | PLANNED |

## Interface Contracts

### 1. `WindowCaptureService` (`apps/desktop/src/main/window-capturer.ts`)
```typescript
export type ChatAppType = "whatsapp" | "discord" | "telegram" | "slack" | "other";

export type CapturedWindowFrame = Readonly<{
  sourceId: string;
  title: string;
  appType: ChatAppType;
  imageBuffer: Buffer; // Lossless PNG
  width: number;
  height: number;
  timestamp: number;
}>;

export interface DesktopCapturerApi {
  getSources(options: Electron.SourcesOptions): Promise<Electron.DesktopCapturerSource[]>;
}

export class WindowCaptureError extends Error {
  constructor(
    readonly code: "WINDOW_NOT_FOUND" | "WINDOW_MINIMIZED" | "CAPTURE_FAILED",
    message: string,
  ) {
    super(message);
    this.name = "WindowCaptureError";
  }
}
```

### 2. `DesktopOcrEngine` (`apps/desktop/src/main/ocr-engine.ts`)
```typescript
export type OcrExtractionResult = Readonly<{
  rawText: string;
  normalizedText: string;
  confidence: number;
  durationMs: number;
}>;

export interface DesktopOcrEngine {
  initialize(): Promise<void>;
  extractFromBuffer(imageBuffer: Buffer): Promise<OcrExtractionResult>;
  terminate(): Promise<void>;
}
```

### 3. IPC & Suggestion Feeding (`apps/desktop/src/shared/contracts.ts` & `desktop-ipc.ts`)
```typescript
export type AskMiloInput = Readonly<{
  mode?: "selected_window" | "screen_capture";
}>;

// In desktop-ipc.ts:
// Captured PNG Buffer -> DesktopOcrEngine.extractFromBuffer -> normalizeRecentContext -> suggestionClient.suggest({ messages })
```

## Code Layout
- `apps/desktop/src/main/window-selection.ts` — Window candidate enumeration & chat application prioritization (DONE)
- `apps/desktop/src/main/window-capturer.ts` — Window capture service using `desktopCapturer` (DONE)
- `apps/desktop/src/main/ocr-engine.ts` — Local OCR engine using Tesseract.js and offline LSTM model (DONE)
- `apps/desktop/src/main/desktop-ipc.ts` — IPC orchestration connecting capture, OCR, normalization, and `DesktopSuggestionClient` (DONE)
- `apps/desktop/src/shared/contracts.ts` — Shared IPC contracts and preload allowlist (DONE)
- `apps/desktop/src/shared/validation.ts` — Zod input validation schemas (.strict()) (DONE)
- `apps/desktop/src/renderer/App.tsx` — Desktop UI with Screenshot button trigger and 3 reply cards (DONE)
- `packages/test-fixtures/src/synthetic-chat-fixture.ts` — Standard synthetic chat image fixture (DONE)
- `apps/desktop/tests/window-selection.test.ts` — Window selection & priority unit tests (DONE)
- `apps/desktop/tests/window-capturer.test.ts` — Window capture unit tests (DONE)
- `apps/desktop/tests/ocr-engine.test.ts` — Programmatic OCR test suite (DONE)
- `apps/desktop/tests/screen-capture-suggestion.test.ts` — Suggestion client integration tests (DONE)
- `apps/desktop/tests/e2e-screen-capture-ocr.test.ts` — 39-test comprehensive E2E test suite (DONE)
