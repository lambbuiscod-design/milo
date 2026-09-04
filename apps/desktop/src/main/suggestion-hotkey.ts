export const DEFAULT_SUGGESTION_HOTKEY = process.platform === "darwin" ? "Command+S" : "Alt+S";

export type GlobalShortcutAdapter = Readonly<{
  register(accelerator: string, callback: () => void): boolean;
  unregister(accelerator: string): void;
}>;

/**
 * Registers Milo's explicit suggestion action without exposing globalShortcut
 * or an arbitrary accelerator to the renderer. Failures remain content-free.
 */
export function registerSuggestionHotkey(
  adapter: GlobalShortcutAdapter,
  requestSuggestion: () => Promise<void>,
): () => void {
  let active = false;
  let disposed = false;
  const invoke = (): void => {
    if (active || disposed) return;
    active = true;
    void requestSuggestion()
      .catch(() => undefined)
      .finally(() => {
        active = false;
      });
  };

  if (!adapter.register(DEFAULT_SUGGESTION_HOTKEY, invoke)) return () => undefined;
  return () => {
    if (disposed) return;
    disposed = true;
    adapter.unregister(DEFAULT_SUGGESTION_HOTKEY);
  };
}
