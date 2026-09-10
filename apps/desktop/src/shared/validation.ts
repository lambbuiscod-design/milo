import { z } from "zod";
import {
  CHARACTER_STATES,
  type CharacterAnimationSnapshot,
  type CharacterStateSnapshot,
  DESKTOP_STATES,
  type AccountDestination,
  type AuthSummary,
  type AskMiloInput,
  type ContextPreview,
  type ContextPreviewInput,
  CONTEXT_PREVIEW_MESSAGE_LIMITS,
  type CopyReplyInput,
  type DesktopSnapshot,
  type IpcResult,
  type NudgePositionInput,
  type PreviewAction,
  type PublicSettings,
  type PublicSettingsPatch,
  type SelectWindowInput,
  type SuggestionResponse,
  type WindowSelectionResult,
  type WatchingState,
  type TriggerCharacterActionInput,
} from "./contracts";

const MAX_IPC_PAYLOAD_BYTES = 4_096;
const themeSchema = z.enum(["system", "light", "dark"]);
const motionSchema = z.enum(["system", "full", "reduced"]);
const suggestionIdSchema = z.enum(["safe", "confident", "playful"]);
const toneProfileSchema = z.enum(["standard", "romantic", "witty", "professional"]);
const dockModeSchema = z.enum(["free", "top-left", "top-right", "bottom-left", "bottom-right", "follow-window"]);
const catAppearanceSchema = z.enum(["charcoal", "slate", "mauve", "caramel"]);

const settingsSchema = z
  .object({
    theme: themeSchema,
    motion: motionSchema,
    showWatchingIndicator: z.boolean(),
    soundEnabled: z.boolean().optional(),
    soundVolume: z.number().min(0).max(1).optional(),
    noticeSoundEnabled: z.boolean().optional(),
    activeTone: toneProfileSchema.optional(),
    opacity: z.number().min(0.75).max(1).optional(),
    isPinned: z.boolean().optional(),
    dockMode: dockModeSchema.optional(),
    catAppearance: catAppearanceSchema.optional(),
  })
  .strict();
const settingsPatchSchema = settingsSchema.partial().strict();
export const updateSettingsSchema = settingsPatchSchema;
const authSummarySchema = z.object({
  status: z.enum(["signed_out", "authenticated", "unavailable", "error"]),
  expiresAt: z.number().int().nonnegative().nullable(),
  storageAvailable: z.boolean(),
}).strict();
const askMiloSchema = z
  .object({
    mode: z.enum(["selected_window", "screen_capture"]).optional(),
  })
  .strict();
const contextPreviewInputSchema = z.object({
  removeParticipantNames: z.boolean(),
  maxMessages: z.union(CONTEXT_PREVIEW_MESSAGE_LIMITS.map((value) => z.literal(value)) as [z.ZodLiteral<4>, z.ZodLiteral<6>, z.ZodLiteral<8>]),
}).strict();
const copyReplySchema = z.object({ suggestionId: suggestionIdSchema }).strict();
const previewActionSchema = z.enum(["notice", "generate", "fail", "reset"]);
const nudgeSchema = z
  .object({
    direction: z.enum(["up", "right", "down", "left"]),
    step: z.union([z.literal(10), z.literal(40)]),
  })
  .strict();
const accountDestinationSchema = z.enum(["account", "billing", "privacy", "terms"]);
const windowSourceIdSchema = z.string().regex(/^window:[1-9][0-9]*:[0-9]+$/).max(64);
const selectWindowInputSchema = z
  .object({ sourceId: windowSourceIdSchema.optional() })
  .strict();
const windowCandidateSchema = z
  .object({ sourceId: windowSourceIdSchema, title: z.string().min(1).max(120) })
  .strict();
const selectedWindowSchema = z
  .object({
    available: z.literal(true),
    title: z.string().min(1).max(120),
    processId: z.number().int().positive().nullable(),
  })
  .strict();
const windowSelectionResultSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("candidates"), candidates: z.array(windowCandidateSchema).max(20) }).strict(),
  z.object({ mode: z.literal("selected"), window: selectedWindowSchema }).strict(),
]);
const suggestionSchema = z
  .object({
    id: suggestionIdSchema,
    label: z.string().max(40),
    text: z.string().max(280),
    explanation: z.string().max(360),
  })
  .strict();
export const characterAnimationSnapshotSchema = z
  .object({
    name: z.string().min(1).max(64),
    state: z.enum(CHARACTER_STATES),
    priority: z.number().int().min(0).max(100),
    interruptible: z.boolean(),
    startedAt: z.number().int().nonnegative(),
    duration: z.number().int().positive().optional(),
  })
  .strict();

export const characterStateSnapshotSchema = z
  .object({
    currentState: z.enum(CHARACTER_STATES),
    previousState: z.enum(CHARACTER_STATES).nullable(),
    currentPriority: z.number().int().min(0).max(100),
    activeAnimation: characterAnimationSnapshotSchema.nullable(),
    lastTransitionTime: z.number().int().nonnegative(),
    transitionReason: z.string().max(120).optional(),
  })
  .strict();

const snapshotSchema = z
  .object({
    state: z.enum(DESKTOP_STATES),
    panelOpen: z.boolean(),
    panelPlacement: z.enum(["right-down", "right-up", "left-down", "left-up"]),
    watching: z
      .object({
        paused: z.boolean(),
        selectedWindow: selectedWindowSchema.nullable(),
        capability: z.object({ available: z.literal(true) }).strict(),
      })
      .strict(),
    settings: settingsSchema,
    auth: authSummarySchema,
    replies: z.array(suggestionSchema).max(3),
    lastAction: z.enum(["none", "copied"]),
    character: characterStateSnapshotSchema.optional(),
  })
  .strict();
const watchingSchema = z
  .object({
    paused: z.boolean(),
    selectedWindow: selectedWindowSchema.nullable(),
    capability: z.object({ available: z.literal(true) }).strict(),
  })
  .strict();
const suggestionResponseSchema = z
  .object({
    mode: z.enum(["live", "synthetic_preview"]),
    warning: z.string().max(500).nullable(),
    replies: z.array(suggestionSchema).max(3),
  })
  .strict();
const contextPreviewSchema = z.object({
  text: z.string().max(4_000),
  messageCount: z.number().int().min(0).max(8),
  truncated: z.boolean(),
  participantNamesRemoved: z.boolean(),
  maxMessages: z.union([z.literal(4), z.literal(6), z.literal(8)]),
}).strict();
const ipcErrorSchema = z
  .object({
    code: z.enum(["INVALID_REQUEST", "UNAVAILABLE", "INTERNAL_ERROR"]),
    message: z.string().max(180),
  })
  .strict();
const ipcResultSchema = z.union([
  z.object({ ok: z.literal(true), value: z.unknown() }).strict(),
  z.object({ ok: z.literal(false), error: ipcErrorSchema }).strict(),
]);

export class RequestValidationError extends Error {
  constructor() {
    super("INVALID_REQUEST");
    this.name = "RequestValidationError";
  }
}

function assertBoundedPayload(value: unknown): void {
  let encoded: string;
  try {
    encoded = JSON.stringify(value);
  } catch {
    throw new RequestValidationError();
  }
  if (encoded === undefined) {
    if (value === undefined) return;
    throw new RequestValidationError();
  }
  if (new TextEncoder().encode(encoded).byteLength > MAX_IPC_PAYLOAD_BYTES) {
    throw new RequestValidationError();
  }
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  assertBoundedPayload(value);
  const result = schema.safeParse(value);
  if (!result.success) throw new RequestValidationError();
  return result.data;
}

export function parseBoolean(value: unknown): boolean {
  return parse(z.boolean(), value);
}

export function parseNoPayload(value: unknown): undefined {
  return parse(z.undefined(), value);
}

export function parseAskMiloInput(value: unknown): AskMiloInput {
  return parse(askMiloSchema, value);
}

export function parseContextPreviewInput(value: unknown): ContextPreviewInput {
  return parse(contextPreviewInputSchema, value);
}

export function parseCopyReplyInput(value: unknown): CopyReplyInput {
  return parse(copyReplySchema, value);
}

export function parseSettingsPatch(value: unknown): PublicSettingsPatch {
  return parse(settingsPatchSchema, value);
}

export function parsePreviewAction(value: unknown): PreviewAction {
  return parse(previewActionSchema, value);
}

export function parseNudgePositionInput(value: unknown): NudgePositionInput {
  return parse(nudgeSchema, value);
}

export function parseAccountDestination(value: unknown): AccountDestination {
  return parse(accountDestinationSchema, value);
}

export function parseSelectWindowInput(value: unknown): SelectWindowInput {
  return parse(selectWindowInputSchema, value);
}

export function parseWindowSelectionResult(value: unknown): WindowSelectionResult {
  return parse(windowSelectionResultSchema, value);
}

export function parsePublicSettings(value: unknown): PublicSettings {
  return parse(settingsSchema, value);
}

export function parseDesktopSnapshot(value: unknown): DesktopSnapshot {
  return parse(snapshotSchema, value);
}

export function parseWatchingState(value: unknown): WatchingState {
  return parse(watchingSchema, value);
}

export function parseSuggestionResponse(value: unknown): SuggestionResponse {
  return parse(suggestionResponseSchema, value);
}

export function parseContextPreview(value: unknown): ContextPreview {
  return parse(contextPreviewSchema, value);
}

export function parseAuthSummary(value: unknown): AuthSummary {
  return parse(authSummarySchema, value);
}

export function parseIpcResult(value: unknown): IpcResult<unknown> {
  return parse(ipcResultSchema, value) as IpcResult<unknown>;
}

export function parseCharacterStateSnapshot(value: unknown): CharacterStateSnapshot {
  return parse(characterStateSnapshotSchema, value);
}

export const triggerCharacterActionInputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("drag_start") }).strict(),
  z.object({
    action: z.literal("drag_move"),
    deltaX: z.number().finite().min(-2000).max(2000),
    deltaY: z.number().finite().min(-2000).max(2000),
  }).strict(),
  z.object({ action: z.literal("drag_end") }).strict(),
  z.object({ action: z.literal("look_around") }).strict(),
  z.object({
    action: z.literal("play_animation"),
    animationName: z.string().min(1).max(64).optional(),
  }).strict(),
]);

export function parseTriggerCharacterActionInput(value: unknown): TriggerCharacterActionInput {
  return parse(triggerCharacterActionInputSchema, value);
}


