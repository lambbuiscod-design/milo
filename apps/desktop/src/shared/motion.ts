import type { MotionPreference } from "./contracts";

export function shouldReduceMotion(
  preference: MotionPreference,
  systemPrefersReducedMotion: boolean,
): boolean {
  if (preference === "reduced" || preference === "minimal") return true;
  if (preference === "full") return false;
  return systemPrefersReducedMotion;
}
