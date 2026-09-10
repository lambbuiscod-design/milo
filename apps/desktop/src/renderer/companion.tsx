import React, { StrictMode, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { MiloCat } from "./MiloCat";
import type {
  CharacterState,
  DesktopSnapshot,
  TriggerCharacterActionInput,
} from "../shared/contracts";
import {
  CLICK_DELAY_MS,
  DOUBLE_CLICK_COOLDOWN_MS,
  DRAG_DISTANCE_THRESHOLD,
  HOLD_DURATION_THRESHOLD_MS,
  MAX_PUPIL_OFFSET_X,
  MAX_PUPIL_OFFSET_Y,
  DEFAULT_FACE_CENTER,
  DEFAULT_MAX_DIST,
  HARMLESS_ANIMATION_NAMES,
  type HarmlessAnimationName,
  type PupilOffset,
  calculatePupilOffset,
  ClickDisambiguator,
} from "../shared/contracts";
import "./styles.css";

export {
  CLICK_DELAY_MS,
  DOUBLE_CLICK_COOLDOWN_MS,
  DRAG_DISTANCE_THRESHOLD,
  HOLD_DURATION_THRESHOLD_MS,
  MAX_PUPIL_OFFSET_X,
  MAX_PUPIL_OFFSET_Y,
  DEFAULT_FACE_CENTER,
  DEFAULT_MAX_DIST,
  HARMLESS_ANIMATION_NAMES,
  type HarmlessAnimationName,
  type PupilOffset,
  calculatePupilOffset,
  ClickDisambiguator,
};

export interface UseCompanionInteractionOptions {
  characterState: CharacterState;
  triggerAction: (input: TriggerCharacterActionInput) => Promise<void>;
  openContextMenu: () => Promise<void>;
}

export function useCompanionInteraction({
  characterState,
  triggerAction,
  openContextMenu,
}: UseCompanionInteractionOptions) {
  const [pupilOffset, setPupilOffset] = useState<PupilOffset>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const isPointerDownRef = useRef(false);
  const dragActiveRef = useRef(false);
  const dragThresholdPassedRef = useRef(false);
  const startPosRef = useRef<{ clientX: number; clientY: number; screenX: number; screenY: number } | null>(null);
  const lastPosRef = useRef<{ clientX: number; clientY: number; screenX: number; screenY: number } | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const disambiguator = useMemo(
    () =>
      new ClickDisambiguator({
        onSingleClick: () => {
          void openContextMenu();
        },
        onDoubleClick: (animationName) => {
          void triggerAction({ action: "play_animation", animationName });
        },
      }),
    [openContextMenu, triggerAction],
  );

  useEffect(() => {
    return () => {
      disambiguator.dispose();
      if (holdTimerRef.current !== null) {
        clearTimeout(holdTimerRef.current);
      }
    };
  }, [disambiguator]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore capture errors in environments without capture support
    }

    isPointerDownRef.current = true;
    dragActiveRef.current = false;
    dragThresholdPassedRef.current = false;

    const point = {
      clientX: e.clientX,
      clientY: e.clientY,
      screenX: e.screenX,
      screenY: e.screenY,
    };
    startPosRef.current = point;
    lastPosRef.current = point;

    if (holdTimerRef.current !== null) {
      clearTimeout(holdTimerRef.current);
    }
    holdTimerRef.current = setTimeout(() => {
      if (isPointerDownRef.current && !dragActiveRef.current) {
        dragActiveRef.current = true;
        dragThresholdPassedRef.current = true;
        setIsDragging(true);
        disambiguator.cancelPendingClick();
        void triggerAction({ action: "drag_start" });
      }
    }, HOLD_DURATION_THRESHOLD_MS);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragActiveRef.current) {
      const offset = calculatePupilOffset({ x: e.clientX, y: e.clientY });
      setPupilOffset(offset);
    }

    if (isPointerDownRef.current && !dragActiveRef.current) {
      const start = startPosRef.current;
      if (start) {
        const dist = Math.hypot(e.clientX - start.clientX, e.clientY - start.clientY);
        if (dist > DRAG_DISTANCE_THRESHOLD) {
          if (holdTimerRef.current !== null) {
            clearTimeout(holdTimerRef.current);
            holdTimerRef.current = null;
          }
          dragActiveRef.current = true;
          dragThresholdPassedRef.current = true;
          setIsDragging(true);
          disambiguator.cancelPendingClick();
          void triggerAction({ action: "drag_start" });
        }
      }
    }

    if (dragActiveRef.current) {
      const last = lastPosRef.current ?? {
        clientX: e.clientX,
        clientY: e.clientY,
        screenX: e.screenX,
        screenY: e.screenY,
      };

      const hasScreenDelta =
        (e.screenX !== 0 || e.screenY !== 0) && (last.screenX !== 0 || last.screenY !== 0);
      const deltaX = hasScreenDelta ? e.screenX - last.screenX : e.clientX - last.clientX;
      const deltaY = hasScreenDelta ? e.screenY - last.screenY : e.clientY - last.clientY;

      lastPosRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        screenX: e.screenX,
        screenY: e.screenY,
      };

      if (deltaX !== 0 || deltaY !== 0) {
        void triggerAction({ action: "drag_move", deltaX, deltaY });
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (holdTimerRef.current !== null) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }

    if (dragActiveRef.current) {
      dragActiveRef.current = false;
      setIsDragging(false);
      void triggerAction({ action: "drag_end" });
    } else if (!dragThresholdPassedRef.current) {
      disambiguator.registerClick();
    }

    isPointerDownRef.current = false;
    startPosRef.current = null;
    lastPosRef.current = null;
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (holdTimerRef.current !== null) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }

    if (dragActiveRef.current) {
      dragActiveRef.current = false;
      setIsDragging(false);
      void triggerAction({ action: "drag_end" });
    }

    disambiguator.cancelPendingClick();
    isPointerDownRef.current = false;
    startPosRef.current = null;
    lastPosRef.current = null;
    setPupilOffset({ x: 0, y: 0 });
  };

  const handlePointerEnter = (_e: React.PointerEvent<HTMLDivElement>) => {
    if (characterState === "idle") {
      void triggerAction({ action: "look_around" });
    }
  };

  const handlePointerLeave = (_e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragActiveRef.current) {
      setPupilOffset({ x: 0, y: 0 });
    }
  };

  return {
    pupilOffset,
    isDragging,
    handlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerCancel,
      onPointerEnter: handlePointerEnter,
      onPointerLeave: handlePointerLeave,
    },
    disambiguator,
  };
}

export function useMiloSnapshot(): DesktopSnapshot | null {
  const [snapshot, setSnapshot] = useState<DesktopSnapshot | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("milo" in window) || !window.milo) return;
    let active = true;

    const unsubscribe = window.milo.onStateChanged((next) => {
      if (active) setSnapshot(next);
    });

    void window.milo
      .getSnapshot()
      .then((next) => {
        if (active) setSnapshot(next);
      })
      .catch(() => {});

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return snapshot;
}

export function CompanionApp() {
  const snapshot = useMiloSnapshot();
  const characterState: CharacterState = snapshot?.character?.currentState ?? "idle";

  const { pupilOffset, isDragging, handlers } = useCompanionInteraction({
    characterState,
    triggerAction: (input) => {
      if (typeof window !== "undefined" && window.milo) {
        return window.milo.triggerCharacterAction(input);
      }
      return Promise.resolve();
    },
    openContextMenu: () => {
      if (typeof window !== "undefined" && window.milo) {
        return window.milo.openContextMenu();
      }
      return Promise.resolve();
    },
  });

  return (
    <div
      className="companion-app"
      data-testid="companion-app"
      style={{
        width: 250,
        height: 300,
        margin: 0,
        padding: 0,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        background: "transparent",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      <div
        className="companion-character-container"
        data-testid="companion-character-container"
        style={{
          width: 200,
          height: 240,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: isDragging ? "grabbing" : "grab",
          touchAction: "none",
        }}
        {...handlers}
      >
        <MiloCat state={characterState} pupilOffset={pupilOffset} />
      </div>
    </div>
  );
}

const root = typeof document !== "undefined" ? document.getElementById("root") : null;
if (root) {
  createRoot(root).render(
    <StrictMode>
      <CompanionApp />
    </StrictMode>,
  );
}
