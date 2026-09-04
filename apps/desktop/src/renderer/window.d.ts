import type { MiloDesktopApi } from "../shared/contracts";

declare global {
  interface Window {
    readonly milo: MiloDesktopApi;
  }
}

export {};
