import { type BrowserWindow, screen } from "electron";
import type { PanelPlacement, NudgePositionInput } from "../shared/contracts";
import {
  anchorFromExpandedBounds,
  clampPosition,
  defaultOverlayPosition,
  fitExpandedSize,
  nudgePosition,
  resolvePanelBounds,
  type Point,
  type Rectangle,
} from "../shared/position";
import type { ContentFreeSettingsStore } from "./settings-store";

export const COLLAPSED_OVERLAY_SIZE = Object.freeze({ width: 168, height: 174 });
export const BUBBLE_OVERLAY_SIZE = Object.freeze({ width: 520, height: 480 });
// The expanded surface is a desktop workspace (sidebar + context + companion rail).
// The collapsed state remains the small floating Milo cat.
export const PREFERRED_EXPANDED_SIZE = Object.freeze({ width: 980, height: 640 });

export class OverlayController {
  readonly #window: BrowserWindow;
  readonly #settingsStore: ContentFreeSettingsStore;
  #panelOpen = false;
  #bubblesOpen = false;
  #placement: PanelPlacement = "right-down";
  #saveTimer: NodeJS.Timeout | null = null;

  constructor(window: BrowserWindow, settingsStore: ContentFreeSettingsStore) {
    this.#window = window;
    this.#settingsStore = settingsStore;
  }

  initialize(): void {
    const display = screen.getPrimaryDisplay();
    const saved = this.#settingsStore.getOverlayPosition(String(display.id));
    const position = clampPosition(
      saved ?? defaultOverlayPosition(COLLAPSED_OVERLAY_SIZE, display.workArea),
      COLLAPSED_OVERLAY_SIZE,
      display.workArea,
    );
    this.#window.setBounds({ ...position, ...COLLAPSED_OVERLAY_SIZE }, false);
    this.#persistAnchor(position);

    this.#window.on("move", this.#scheduleSave);
    screen.on("display-added", this.#reclamp);
    screen.on("display-removed", this.#reclamp);
    screen.on("display-metrics-changed", this.#reclamp);
  }

  dispose(): void {
    this.#window.removeListener("move", this.#scheduleSave);
    screen.removeListener("display-added", this.#reclamp);
    screen.removeListener("display-removed", this.#reclamp);
    screen.removeListener("display-metrics-changed", this.#reclamp);
    if (this.#saveTimer) clearTimeout(this.#saveTimer);
  }

  get placement(): PanelPlacement {
    return this.#placement;
  }

  get panelOpen(): boolean {
    return this.#panelOpen;
  }

  get bubblesOpen(): boolean {
    return this.#bubblesOpen;
  }

  isBubblesOpen(): boolean {
    return this.#bubblesOpen;
  }

  isPanelOpen(): boolean {
    return this.#panelOpen;
  }

  setBubblesOpen(open: boolean): void {
    if (this.#bubblesOpen === open) return;
    if (this.#panelOpen) {
      this.#bubblesOpen = open;
      return;
    }
    const anchorPosition = this.#currentAnchor();
    const anchor = { ...anchorPosition, ...COLLAPSED_OVERLAY_SIZE };
    const display = screen.getDisplayNearestPoint(centerOf(anchor));

    if (open) {
      const size = fitExpandedSize(BUBBLE_OVERLAY_SIZE, display.workArea);
      const resolved = resolvePanelBounds(anchor, size, display.workArea);
      this.#placement = resolved.placement;
      this.#bubblesOpen = true;
      this.#window.setBounds(resolved.bounds, false);
    } else {
      const position = clampPosition(anchorPosition, COLLAPSED_OVERLAY_SIZE, display.workArea);
      this.#bubblesOpen = false;
      this.#window.setBounds({ ...position, ...COLLAPSED_OVERLAY_SIZE }, false);
      this.#persistAnchor(position);
    }
  }

  setPanelOpen(open: boolean): PanelPlacement {
    if (open === this.#panelOpen) return this.#placement;
    const anchorPosition = this.#currentAnchor();
    const anchor = { ...anchorPosition, ...COLLAPSED_OVERLAY_SIZE };
    const display = screen.getDisplayNearestPoint(centerOf(anchor));

    if (typeof this.#window.setFocusable === "function") {
      this.#window.setFocusable(open);
    }

    if (open) {
      const size = fitExpandedSize(PREFERRED_EXPANDED_SIZE, display.workArea);
      const resolved = resolvePanelBounds(anchor, size, display.workArea);
      this.#placement = resolved.placement;
      this.#panelOpen = true;
      this.#window.setBounds(resolved.bounds, false);
    } else {
      this.#panelOpen = false;
      if (this.#bubblesOpen) {
        const size = fitExpandedSize(BUBBLE_OVERLAY_SIZE, display.workArea);
        const resolved = resolvePanelBounds(anchor, size, display.workArea);
        this.#placement = resolved.placement;
        this.#window.setBounds(resolved.bounds, false);
      } else {
        const position = clampPosition(anchorPosition, COLLAPSED_OVERLAY_SIZE, display.workArea);
        this.#window.setBounds({ ...position, ...COLLAPSED_OVERLAY_SIZE }, false);
        this.#persistAnchor(position);
      }
    }
    return this.#placement;
  }

  nudge(input: NudgePositionInput): void {
    const anchor = this.#currentAnchor();
    const display = screen.getDisplayNearestPoint(centerOf({ ...anchor, ...COLLAPSED_OVERLAY_SIZE }));
    const position = clampPosition(
      nudgePosition(anchor, input),
      COLLAPSED_OVERLAY_SIZE,
      display.workArea,
    );
    this.#applyAnchor(position, display.workArea);
    this.#persistAnchor(position);
  }

  reset(): void {
    const display = screen.getDisplayNearestPoint(centerOf(this.#window.getBounds()));
    const position = defaultOverlayPosition(COLLAPSED_OVERLAY_SIZE, display.workArea);
    this.#applyAnchor(position, display.workArea);
    this.#persistAnchor(position);
  }

  readonly #reclamp = (): void => {
    if (this.#window.isDestroyed()) return;
    const anchor = this.#currentAnchor();
    const display = screen.getDisplayNearestPoint(centerOf({ ...anchor, ...COLLAPSED_OVERLAY_SIZE }));
    const position = clampPosition(anchor, COLLAPSED_OVERLAY_SIZE, display.workArea);
    this.#applyAnchor(position, display.workArea);
    this.#persistAnchor(position);
  };

  readonly #scheduleSave = (): void => {
    if (this.#saveTimer) clearTimeout(this.#saveTimer);
    this.#saveTimer = setTimeout(() => {
      this.#saveTimer = null;
      if (this.#window.isDestroyed()) return;
      const anchor = this.#currentAnchor();
      const display = screen.getDisplayNearestPoint(centerOf({ ...anchor, ...COLLAPSED_OVERLAY_SIZE }));
      const position = clampPosition(anchor, COLLAPSED_OVERLAY_SIZE, display.workArea);
      this.#persistAnchor(position);
    }, 180);
  };

  #currentAnchor(): Point {
    const bounds = this.#window.getBounds();
    return (this.#panelOpen || this.#bubblesOpen)
      ? anchorFromExpandedBounds(bounds, COLLAPSED_OVERLAY_SIZE, this.#placement)
      : { x: bounds.x, y: bounds.y };
  }

  #applyAnchor(position: Point, workArea: Rectangle): void {
    if (this.#panelOpen) {
      const anchor = { ...position, ...COLLAPSED_OVERLAY_SIZE };
      const size = fitExpandedSize(PREFERRED_EXPANDED_SIZE, workArea);
      const resolved = resolvePanelBounds(anchor, size, workArea);
      this.#placement = resolved.placement;
      this.#window.setBounds(resolved.bounds, false);
    } else if (this.#bubblesOpen) {
      const anchor = { ...position, ...COLLAPSED_OVERLAY_SIZE };
      const size = fitExpandedSize(BUBBLE_OVERLAY_SIZE, workArea);
      const resolved = resolvePanelBounds(anchor, size, workArea);
      this.#placement = resolved.placement;
      this.#window.setBounds(resolved.bounds, false);
    } else {
      this.#window.setBounds({ ...position, ...COLLAPSED_OVERLAY_SIZE }, false);
    }
  }

  #persistAnchor(position: Point): void {
    const display = screen.getDisplayNearestPoint(centerOf({ ...position, ...COLLAPSED_OVERLAY_SIZE }));
    this.#settingsStore.setOverlayPosition(String(display.id), position);
  }
}

function centerOf(rectangle: Rectangle): Point {
  return {
    x: Math.round(rectangle.x + rectangle.width / 2),
    y: Math.round(rectangle.y + rectangle.height / 2),
  };
}
