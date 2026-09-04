# Milo Desktop E2E Test Infrastructure & Methodology Specification

## 1. Overview & Testing Philosophy

This document defines the architecture, methodology, and catalog for the **End-to-End (E2E) Test Suite** covering **Screen Capture**, **Local OCR**, and the **AI Suggestion Pipeline** for the Milo Electron Desktop Application (`@milo/desktop`).

### 1.1 Core Philosophy: Opaque-Box & Requirement-Driven Testing
- **Opaque-Box Verification**: Tests validate end-user and cross-boundary observable behaviors against requirements (R1 Screen Capture, R2 Local OCR, R3 AI Suggestion Pipeline) and interface contracts without relying on transient private implementation details.
- **Deterministic & Offline**: The entire test suite executes deterministically in headless CI and local environments (`vitest run`). Screen capture sources and OCR execution utilize standard in-memory fixtures and reproducible mocks so no active physical displays, external GPUs, or network connections are required.
- **Renderer Security Invariant**: Raw pixel buffers and raw OCR transcripts must never cross IPC into the renderer. Only content-free triggers and sanitized suggestion snapshots (`safe`, `confident`, `playful` reply cards) traverse the IPC bridge.
- **Zero Disk Leakage**: Captured window frames and OCR intermediates remain strictly in volatile memory (Buffer) and are never written to disk, upholding Milo's strict privacy and security mandates.

---

## 2. Test Suite Architecture: The 4-Tier Methodology

The test infrastructure is structured into four distinct verification tiers:

```
+-------------------------------------------------------------------------+
|                  Tier 4: Real-World Application Scenarios               |
|   - WhatsApp Dating Match    - Discord Gaming Banter    - Slack Sync   |
|   - Multi-Turn Complex Chat   - Noisy Background Chat                   |
+-------------------------------------------------------------------------+
                                    ▲
+-------------------------------------------------------------------------+
|                  Tier 3: Cross-Feature Combinations                      |
|   - Pairwise Capture + OCR   - Pairwise OCR + Suggestion                |
|   - Full End-to-End Chain    - Pipeline Error Recovery                  |
+-------------------------------------------------------------------------+
                                    ▲
+-------------------------------------------------------------------------+
|                  Tier 2: Boundary & Corner Cases                        |
|   - Minimized / Empty Window - Invalid / Out-of-Bounds SourceId          |
|   - Corrupted Image Buffer   - Single-Line & Max 4,000 Char Bounding    |
|   - Auth / Rate Limit / Paywall Upstream Error Mapping                  |
+-------------------------------------------------------------------------+
                                    ▲
+-------------------------------------------------------------------------+
|                  Tier 1: Feature Coverage (R1, R2, R3)                  |
|   - R1: Window Enumeration, Prioritization, High-Res Capture (5 tests)  |
|   - R2: Offline OCR Extraction, Confidence, Normalization (5 tests)     |
|   - R3: AI Suggestion Feeding, Tones, Quota, Reply Categories (5 tests) |
+-------------------------------------------------------------------------+
```

---

## 3. Detailed Test Catalog

### Tier 1: Feature Coverage (15 Tests)

#### Feature R1: Screen Capture & Window Enumeration
| Test ID | Name | Objective | Input | Expected Output |
|---|---|---|---|---|
| `T1.1.1` | Lightweight Candidate Enumeration | Verify enumeration retrieves window titles with 0x0 thumbnails to avoid memory bloat | Mock `desktopCapturer.getSources` with 0x0 thumbnails | Returns window candidate list without populated pixel buffers |
| `T1.1.2` | Chat Application Prioritization | Verify WhatsApp and Discord windows are prioritized at head of candidate list | Mixed window list (Chrome, WhatsApp, Notepad, Discord) | WhatsApp and Discord appear before general applications |
| `T1.1.3` | High-Resolution Frame Capture | Verify targeted window capture produces lossless PNG buffer with dimensions | Selected `sourceId`, requested 1920x1080 | Lossless PNG buffer, width=1920, height=1080, valid timestamp |
| `T1.1.4` | Chat Application Classifier | Verify window titles are categorized accurately (WhatsApp, Discord, Slack, etc.) | Sample titles: "WhatsApp Web", "Discord #general", "Slack" | Exact `ChatAppType` returned ("whatsapp", "discord", "slack") |
| `T1.1.5` | Milo Self-Window Exclusion | Verify Milo's own overlay window is excluded from capture candidates | Window list including Milo's own source ID | Milo source ID excluded from candidates |

#### Feature R2: Local OCR Text Extraction
| Test ID | Name | Objective | Input | Expected Output |
|---|---|---|---|---|
| `T1.2.1` | Multi-Line Conversation Parsing | Verify OCR engine parses synthetic chat image buffer into transcript | Standard synthetic chat image buffer | Transcript contains expected dialogue lines with correct order |
| `T1.2.2` | OCR Confidence & Timing Metrics | Verify OCR engine reports non-zero confidence and execution duration | Valid synthetic chat image buffer | Confidence > 0.0 and durationMs >= 0 |
| `T1.2.3` | Interword & Line Break Preservation | Verify OCR maintains word spacing and line formatting | Synthetic multi-line dialogue buffer | Words separated by spaces; dialogue turns separated by newlines |
| `T1.2.4` | Engine Lifecycle Management | Verify OCR engine initializes and terminates cleanly without leaking workers | Engine `initialize()` and `terminate()` | Completes lifecycle without unhandled rejections or orphan threads |
| `T1.2.5` | Raw Text Normalization & Cleaning | Verify text normalizer sanitizes raw OCR output (strips control chars, spaces) | Raw string with `\u0000`, carriage returns, excess whitespace | Clean sanitized string with single whitespace and proper newlines |

#### Feature R3: AI Suggestion Pipeline Integration
| Test ID | Name | Objective | Input | Expected Output |
|---|---|---|---|---|
| `T1.3.1` | Triple Categorized Replies Generation | Verify feeding normalized text produces Safe, Confident, Playful replies | Normalized message array, tone="warm" | Result contains exactly 3 replies with categories "safe", "confident", "playful" |
| `T1.3.2` | Tone Selection Propagation | Verify client propagates selected user tone to suggestion backend | `tone: "witty"` | Suggestion request payload contains `tone: "witty"` |
| `T1.3.3` | Relationship Stage Propagation | Verify client propagates relationship stage context | `relationshipStage: "dating"` | Suggestion request payload contains `relationshipStage: "dating"` |
| `T1.3.4` | Unique Categories & Explanations | Verify each reply has non-empty text and rationale (`whyItWorks`) | Valid context and mock API | Unique categories, all replies have explanation string |
| `T1.3.5` | Suggestion Allowance Quota Tracking | Verify remaining suggestion credits are surfaced to snapshot | Upstream remaining count = 5 | Snapshot reflects `remaining: 5` |

---

### Tier 2: Boundary & Corner Cases (15 Tests)

#### Feature R1: Screen Capture Boundaries
| Test ID | Name | Objective | Input | Expected Output |
|---|---|---|---|---|
| `T2.1.1` | Minimized Window Detection | Verify capturing minimized window throws `WINDOW_MINIMIZED` | Window with `isEmpty(): true` or dimensions 0x0 | Throws `WindowCaptureError` with code `WINDOW_MINIMIZED` |
| `T2.1.2` | Missing Window Source Handling | Verify capturing non-existent `sourceId` throws `WINDOW_NOT_FOUND` | Unknown `sourceId: "window:99999:0"` | Throws `WindowCaptureError` with code `WINDOW_NOT_FOUND` |
| `T2.1.3` | Malformed Source ID Handling | Verify malformed source ID strings fail closed | Source ID `"screen:0"` or non-numeric HWND | Rejected safely with null handle or validation error |
| `T2.1.4` | Empty Desktop Window Enumeration | Verify enumerating when no windows are open returns empty array | Mock `desktopCapturer` returning `[]` | Returns empty candidate array without crashing |
| `T2.1.5` | High-DPI & Extreme Dimensions | Verify capture respects extreme resolution limits (4K vs 100x100) | Requested size 3840x2160 and 100x100 | Successfully produces bounded buffer without memory overflow |

#### Feature R2: Local OCR Boundaries
| Test ID | Name | Objective | Input | Expected Output |
|---|---|---|---|---|
| `T2.2.1` | Empty Buffer Handling | Verify OCR engine rejects 0-byte buffer | `Buffer.alloc(0)` | Throws or rejects with invalid buffer error |
| `T2.2.2` | Corrupted Image Data Handling | Verify OCR engine handles random non-image binary garbage | `Buffer.from("invalid-png-header-data")` | Rejects with decoding/recognition error; does not crash |
| `T2.2.3` | Minimal Single-Line Transcript | Verify OCR accurately processes a single short word or sentence | Synthetic image containing only `"Hey"` | Extracts `"Hey"`, normalized messageCount=1 |
| `T2.2.4` | Message Count Bounding (>8 Messages) | Verify conversation normalizer caps history to the 8 most recent messages | 15 synthetic chat messages | Truncates to exactly 8 messages, retaining newest dialogue |
| `T2.2.5` | Character Limit Bounding (>4,000 Chars) | Verify conversation normalizer bounds total characters to <=4,000 | 5,000 character synthetic transcript | Output length <= 4,000 chars, preserving recent content |

#### Feature R3: Suggestion Pipeline Boundaries
| Test ID | Name | Objective | Input | Expected Output |
|---|---|---|---|---|
| `T2.3.1` | Authentication Token Validation | Verify invalid or whitespace-laden token is rejected before network | `accessToken: "invalid token with spaces"` | Throws `DesktopSuggestionClientError("unauthorized")` |
| `T2.3.2` | Oversized Context Pre-Flight Rejection | Verify context >4,000 characters is rejected before network call | Messages totaling 5,000 characters | Rejects with `code: "protocol"` without issuing HTTP request |
| `T2.3.3` | Empty Context Handling | Verify empty context (0 messages) aborts suggestion pipeline | `messages: []` | Throws `code: "unavailable"` or `code: "protocol"` |
| `T2.3.4` | Upstream Rate Limiting (HTTP 429) | Verify HTTP 429 maps to sanitized `rate_limit` code | Mock fetch returning 429 | Throws `DesktopSuggestionClientError("rate_limit")` |
| `T2.3.5` | Upstream Paywall / Allowance Exhausted | Verify HTTP 402 maps to sanitized `paywall` code | Mock fetch returning 402 | Throws `DesktopSuggestionClientError("paywall")` |

---

### Tier 3: Cross-Feature Combinations (4 Tests)

| Test ID | Name | Objective | Flow | Expected Output |
|---|---|---|---|---|
| `T3.1` | Pairwise Capture + OCR | Verify in-memory handoff from capture buffer directly to OCR engine | Capture frame -> buffer -> `ocrEngine.extractFromBuffer` | OCR transcript matches synthetic window content with zero disk I/O |
| `T3.2` | Pairwise OCR + Suggestion | Verify OCR transcript normalizes and feeds directly into `DesktopSuggestionClient` | OCR transcript -> `normalizeRecentContext` -> `suggestionClient.suggest` | Valid 3-card reply suggestion result |
| `T3.3` | Full End-to-End Pipeline | Verify full happy-path pipeline from window trigger to reply cards | Select window -> capture -> OCR -> normalize -> suggest -> UI snapshot | Complete snapshot with state="ready" and 3 categorized reply cards |
| `T3.4` | End-to-End Error Recovery | Verify pipeline failure at any stage recovers gracefully without state corruption | Minimized window or corrupt frame during live trigger | Pipeline fails closed, state transitions to error/fail, UI stays responsive |

---

### Tier 4: Real-World Application Scenarios (5 Tests)

| Test ID | Scenario | Application | Dialogue Characteristics | Verification Focus |
|---|---|---|---|---|
| `T4.1` | Dating Match Conversation | WhatsApp Desktop | Multi-turn playful banter, emojis, short casual responses | Preserves informal tone, extracts multi-turn context, produces dating suggestions |
| `T4.2` | Gaming Squad Banter | Discord Desktop | Fast-paced banter, gamer slang, multi-user tags, mentions | Handles rapid exchanges, parses username prefixes, generates witty/confident reply |
| `T4.3` | Professional Work Sync | Slack Desktop | Work coordination, meeting rescheduling, action items | Professional tone retained, cleans channel headers, generates clear professional replies |
| `T4.4` | Complex Multi-Line Dialogue | WhatsApp / Web | Paragraph-length messages, questions, punctuated multi-turn turns | Normalizes line breaks, bounds to 8 recent turns, generates contextual reply |
| `T4.5` | Noisy Background Chat | Discord / Browser | Timestamps, read receipts, UI artifacts, sidebars | Resilient parsing: strips noise artifacts, preserves core conversation content |

---

## 4. Execution & Verification Guide

### 4.1 Running the E2E Test Suite
```bash
# Run the dedicated E2E Screen Capture, OCR, and Suggestion test file
pnpm --filter @milo/desktop test tests/e2e-screen-capture-ocr.test.ts

# Run all desktop unit and E2E tests
pnpm --filter @milo/desktop test

# Verify strict TypeScript typing across all desktop configs
pnpm --filter @milo/desktop typecheck
```

### 4.2 Minimum Passing Thresholds
- **Total Tests**: Minimum 38 test cases (Implementation includes **39 tests** across all 4 tiers).
- **Pass Rate**: 100% (0 failures, 0 timeouts).
- **TypeScript Diagnostics**: 0 errors across main, preload, renderer, and test tsconfigs.
