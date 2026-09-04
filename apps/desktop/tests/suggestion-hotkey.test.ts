import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SUGGESTION_HOTKEY,
  registerSuggestionHotkey,
  type GlobalShortcutAdapter,
} from "../src/main/suggestion-hotkey";

function adapter(registered = true) {
  let callback: (() => void) | null = null;
  const value: GlobalShortcutAdapter = {
    register: vi.fn((_accelerator, next) => {
      callback = next;
      return registered;
    }),
    unregister: vi.fn(),
  };
  return { value, invoke: () => callback?.() };
}

describe("explicit Milo suggestion hotkey", () => {
  it("defaults to Alt+S on Windows/Linux or Command+S on macOS", () => {
    const expected = process.platform === "darwin" ? "Command+S" : "Alt+S";
    expect(DEFAULT_SUGGESTION_HOTKEY).toBe(expected);
  });

  it("registers and unregisters only the fixed reviewed accelerator", () => {
    const shortcut = adapter();
    const dispose = registerSuggestionHotkey(shortcut.value, vi.fn(async () => undefined));
    expect(shortcut.value.register).toHaveBeenCalledWith(DEFAULT_SUGGESTION_HOTKEY, expect.any(Function));
    dispose();
    dispose();
    expect(shortcut.value.unregister).toHaveBeenCalledTimes(1);
    expect(shortcut.value.unregister).toHaveBeenCalledWith(DEFAULT_SUGGESTION_HOTKEY);
  });

  it("prevents overlapping suggestion requests", async () => {
    const shortcut = adapter();
    let finish = (): void => undefined;
    const request = vi.fn(() => new Promise<void>((resolve) => { finish = () => resolve(); }));
    registerSuggestionHotkey(shortcut.value, request);
    shortcut.invoke();
    shortcut.invoke();
    expect(request).toHaveBeenCalledTimes(1);
    finish();
    await Promise.resolve();
    await Promise.resolve();
    shortcut.invoke();
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("fails closed when Windows rejects the accelerator", () => {
    const shortcut = adapter(false);
    const dispose = registerSuggestionHotkey(shortcut.value, vi.fn(async () => undefined));
    shortcut.invoke();
    dispose();
    expect(shortcut.value.unregister).not.toHaveBeenCalled();
  });
});
