import type { DesktopState } from "./contracts";

export type DesktopStateEvent =
  | "pause"
  | "resume"
  | "notice"
  | "generate"
  | "ready"
  | "fail"
  | "reset";

export function transitionDesktopState(
  current: DesktopState,
  event: DesktopStateEvent,
): DesktopState {
  if (event === "pause") return "paused";
  if (event === "resume") return "idle";
  if (current === "paused") return "paused";

  switch (event) {
    case "notice":
      return "noticed";
    case "generate":
      return "generating";
    case "ready":
      return current === "generating" ? "ready" : current;
    case "fail":
      return "error";
    case "reset":
      return "idle";
  }
}
