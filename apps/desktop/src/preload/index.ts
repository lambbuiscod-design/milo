import { contextBridge, ipcRenderer } from "electron";
import {
  IPC_CHANNELS,
  PRELOAD_METHOD_ALLOWLIST,
  type DesktopSnapshot,
  type MiloDesktopApi,
} from "../shared/contracts";
import {
  parseAccountDestination,
  parseAuthSummary,
  parseAskMiloInput,
  parseBoolean,
  parseCopyReplyInput,
  parseContextPreview,
  parseContextPreviewInput,
  parseDesktopSnapshot,
  parseIpcResult,
  parseNudgePositionInput,
  parseNoPayload,
  parsePreviewAction,
  parsePublicSettings,
  parseSettingsPatch,
  parseSuggestionResponse,
  parseSelectWindowInput,
  parseWindowSelectionResult,
  parseWatchingState,
} from "../shared/validation";

type OutputParser<T> = (value: unknown) => T;

async function invoke<T>(
  channel: string,
  payload: unknown,
  parseOutput: OutputParser<T>,
): Promise<T> {
  const raw: unknown = await ipcRenderer.invoke(channel, payload);
  const result = parseIpcResult(raw);
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
  return parseOutput(result.value);
}

const parseVoid = (value: unknown): void => parseNoPayload(value);

const api: MiloDesktopApi = Object.freeze({
  getSnapshot: () => invoke(IPC_CHANNELS.getSnapshot, undefined, parseDesktopSnapshot),
  selectWindow: (input) =>
    invoke(
      IPC_CHANNELS.selectWindow,
      parseSelectWindowInput(input),
      parseWindowSelectionResult,
    ),
  previewContext: (input) =>
    invoke(
      IPC_CHANNELS.previewContext,
      parseContextPreviewInput(input),
      parseContextPreview,
    ),
  pauseWatching: (paused) =>
    invoke(IPC_CHANNELS.pauseWatching, parseBoolean(paused), parseWatchingState),
  askMilo: (input) =>
    invoke(IPC_CHANNELS.askMilo, parseAskMiloInput(input), parseSuggestionResponse),
  copyReply: (input) =>
    invoke(IPC_CHANNELS.copyReply, parseCopyReplyInput(input), parseVoid),
  getSettings: () => invoke(IPC_CHANNELS.getSettings, undefined, parsePublicSettings),
  updateSettings: (input) =>
    invoke(IPC_CHANNELS.updateSettings, parseSettingsPatch(input), parsePublicSettings),
  openAccount: (destination) =>
    invoke(
      IPC_CHANNELS.openAccount,
      parseAccountDestination(destination),
      parseVoid,
    ),
  signIn: () => invoke(IPC_CHANNELS.signIn, undefined, parseAuthSummary),
  signOut: () => invoke(IPC_CHANNELS.signOut, undefined, parseAuthSummary),
  setPanelOpen: (open) =>
    invoke(IPC_CHANNELS.setPanelOpen, parseBoolean(open), parseDesktopSnapshot),
  previewState: (action) =>
    invoke(IPC_CHANNELS.previewState, parsePreviewAction(action), parseDesktopSnapshot),
  nudgePosition: (input) =>
    invoke(IPC_CHANNELS.nudgePosition, parseNudgePositionInput(input), parseVoid),
  resetPosition: () => invoke(IPC_CHANNELS.resetPosition, undefined, parseVoid),
  openContextMenu: () => invoke(IPC_CHANNELS.openContextMenu, undefined, parseVoid),
  quit: () => invoke(IPC_CHANNELS.quit, undefined, parseVoid),
  onStateChanged: (listener) => {
    if (typeof listener !== "function") throw new Error("INVALID_LISTENER");
    const wrapped = (_event: Electron.IpcRendererEvent, value: unknown): void => {
      let state: DesktopSnapshot;
      try {
        state = parseDesktopSnapshot(value);
      } catch {
        return;
      }
      listener(state);
    };
    ipcRenderer.on(IPC_CHANNELS.stateChanged, wrapped);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.stateChanged, wrapped);
  },
});

if (
  Object.keys(api).length !== PRELOAD_METHOD_ALLOWLIST.length ||
  !PRELOAD_METHOD_ALLOWLIST.every((method) => method in api)
) {
  throw new Error("INVALID_PRELOAD_SURFACE");
}

contextBridge.exposeInMainWorld("milo", api);
