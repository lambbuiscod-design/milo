import React, { useEffect, useState } from "react";
import type {
  CharacterState,
  CharacterAnimationSnapshot,
  CharacterStateSnapshot,
  DesktopSnapshot,
} from "../../shared/contracts";
import { Card, Stack } from "./primitives";

export interface MiloRendererProps {
  /** Explicit character state for direct testing or overrides */
  characterState?: CharacterState;
  /** Explicit priority (0–100) */
  priority?: number;
  /** Active animation descriptor */
  activeAnimation?: CharacterAnimationSnapshot | null;
  /** Optional full snapshot override */
  snapshot?: DesktopSnapshot;
  /** Show verbose diagnostics (animation name, previous state, priority) */
  showDiagnostics?: boolean;
  /** Additional CSS class names */
  className?: string;
  /** Interactive callback for preview / testing */
  onInteract?: () => void;
}

export interface StateMeta {
  readonly label: string;
  readonly category: "rest" | "physics" | "affection" | "assistant" | "progression" | "system";
  readonly accent: "safe" | "confident" | "playful" | "coral";
  readonly icon: string;
  readonly description: string;
  readonly defaultPriority: number;
}

export const STATE_METADATA: Readonly<Record<CharacterState, StateMeta>> = Object.freeze({
  idle: {
    label: "Idle",
    category: "rest",
    accent: "safe",
    icon: "🌙",
    description: "Milo is resting peacefully.",
    defaultPriority: 0,
  },
  looking: {
    label: "Looking",
    category: "rest",
    accent: "confident",
    icon: "👀",
    description: "Milo is glancing around the screen.",
    defaultPriority: 20,
  },
  sleepy: {
    label: "Sleepy",
    category: "rest",
    accent: "safe",
    icon: "🥱",
    description: "Milo is dozing off.",
    defaultPriority: 15,
  },
  sleeping: {
    label: "Sleeping",
    category: "rest",
    accent: "safe",
    icon: "💤",
    description: "Milo is in a deep sleep.",
    defaultPriority: 10,
  },
  waking: {
    label: "Waking",
    category: "rest",
    accent: "confident",
    icon: "🌅",
    description: "Milo is stretching awake.",
    defaultPriority: 25,
  },
  pet: {
    label: "Petting",
    category: "affection",
    accent: "coral",
    icon: "💖",
    description: "Milo feels loved.",
    defaultPriority: 60,
  },
  purring: {
    label: "Purring",
    category: "affection",
    accent: "playful",
    icon: "😸",
    description: "Milo is vibrating happily.",
    defaultPriority: 45,
  },
  playful: {
    label: "Playful",
    category: "affection",
    accent: "playful",
    icon: "🧶",
    description: "Milo wants to pounce!",
    defaultPriority: 35,
  },
  curious: {
    label: "Curious",
    category: "affection",
    accent: "coral",
    icon: "🐾",
    description: "Milo tilts their head with interest.",
    defaultPriority: 30,
  },
  dragging: {
    label: "Dragging",
    category: "physics",
    accent: "coral",
    icon: "🫳",
    description: "Milo is being moved across the desktop.",
    defaultPriority: 100,
  },
  drop: {
    label: "Dropped",
    category: "physics",
    accent: "coral",
    icon: "⬇️",
    description: "Milo bounces softly onto the surface.",
    defaultPriority: 90,
  },
  alert: {
    label: "Alert",
    category: "assistant",
    accent: "confident",
    icon: "🔔",
    description: "Milo detected screen activity.",
    defaultPriority: 40,
  },
  thinking: {
    label: "Thinking",
    category: "assistant",
    accent: "confident",
    icon: "💭",
    description: "Milo is reasoning about context.",
    defaultPriority: 70,
  },
  ready: {
    label: "Ready",
    category: "assistant",
    accent: "safe",
    icon: "💡",
    description: "Milo has recommendations ready.",
    defaultPriority: 65,
  },
  level_up: {
    label: "Level Up!",
    category: "progression",
    accent: "coral",
    icon: "⭐",
    description: "Milo gained a companion level!",
    defaultPriority: 80,
  },
  celebrating: {
    label: "Celebrating",
    category: "progression",
    accent: "playful",
    icon: "🎉",
    description: "Milo unlocked an achievement!",
    defaultPriority: 75,
  },
  paused: {
    label: "Paused",
    category: "system",
    accent: "confident",
    icon: "⏸️",
    description: "Milo companion mode is paused.",
    defaultPriority: 85,
  },
  error: {
    label: "Error",
    category: "system",
    accent: "coral",
    icon: "⚠️",
    description: "Milo encountered a system error.",
    defaultPriority: 50,
  },
  offline: {
    label: "Offline",
    category: "system",
    accent: "safe",
    icon: "🔌",
    description: "Milo is currently offline.",
    defaultPriority: 40,
  },
  happy: {
    label: "Happy",
    category: "affection",
    accent: "playful",
    icon: "😊",
    description: "Milo is happy.",
    defaultPriority: 70,
  },
  laughing: {
    label: "Laughing",
    category: "affection",
    accent: "playful",
    icon: "😆",
    description: "Milo is laughing.",
    defaultPriority: 70,
  },
  surprised: {
    label: "Surprised",
    category: "affection",
    accent: "confident",
    icon: "😲",
    description: "Milo is surprised.",
    defaultPriority: 70,
  },
  confident: {
    label: "Confident",
    category: "affection",
    accent: "confident",
    icon: "😎",
    description: "Milo is confident.",
    defaultPriority: 70,
  },
  annoyed: {
    label: "Annoyed",
    category: "affection",
    accent: "coral",
    icon: "😒",
    description: "Milo is annoyed.",
    defaultPriority: 70,
  },
  affectionate: {
    label: "Affectionate",
    category: "affection",
    accent: "coral",
    icon: "🥰",
    description: "Milo is feeling affectionate.",
    defaultPriority: 70,
  },
});

/**
 * Hook to subscribe to the Character Engine state via DesktopSnapshot.
 */
export function useMiloCharacterState(overrideSnapshot?: DesktopSnapshot): CharacterStateSnapshot | null {
  const [characterState, setCharacterState] = useState<CharacterStateSnapshot | null>(null);

  useEffect(() => {
    if (overrideSnapshot) return;
    if (typeof window === "undefined" || !("milo" in window)) return;
    const milo = window.milo;
    if (!milo) return;

    let active = true;
    const unsubscribe = milo.onStateChanged((snapshot: DesktopSnapshot) => {
      if (active && snapshot.character) {
        setCharacterState(snapshot.character);
      }
    });

    void milo
      .getSnapshot()
      .then((snapshot: DesktopSnapshot) => {
        if (active && snapshot.character) {
          setCharacterState(snapshot.character);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
      unsubscribe();
    };
  }, [overrideSnapshot]);

  return overrideSnapshot?.character ?? characterState;
}

/**
 * MiloRenderer — Requirement R3
 * Visual state feedback component reflecting the 19-state Character Engine.
 */
export function MiloRenderer({
  characterState: explicitState,
  priority: explicitPriority,
  activeAnimation: explicitAnimation,
  snapshot: overrideSnapshot,
  showDiagnostics = true,
  className = "",
  onInteract,
}: MiloRendererProps) {
  const liveSnapshot = useMiloCharacterState(overrideSnapshot);

  const state: CharacterState = explicitState ?? liveSnapshot?.currentState ?? "idle";
  const meta: StateMeta = STATE_METADATA[state] ?? STATE_METADATA.idle;
  const priority: number = explicitPriority ?? liveSnapshot?.currentPriority ?? meta.defaultPriority;
  const animation = explicitAnimation ?? liveSnapshot?.activeAnimation ?? null;

  return (
    <div
      className={`milo-renderer milo-renderer--${state} milo-renderer--cat-${meta.category} ${className}`}
      role="status"
      aria-live="polite"
      aria-label={`Milo is ${meta.label}: ${meta.description}`}
      onClick={onInteract}
    >
      <Card
        variant="elevated"
        accent={meta.accent}
        padding="md"
        className="milo-renderer__card"
      >
        <Stack direction="column" gap="sm">
          {/* Header Row: Category & Priority */}
          <div className="milo-renderer__header">
            <span className={`milo-renderer__category-tag milo-renderer__category-tag--${meta.category}`}>
              {meta.category.toUpperCase()}
            </span>
            <span className="milo-renderer__priority-badge" title={`Animation Priority: ${priority}`}>
              {`P:${priority}`}
            </span>
          </div>

          {/* Center Visual Feedback Box (Requirement R3) */}
          <div
            className={`milo-renderer__box milo-renderer__box--${state} milo-renderer__box--cat-${meta.category}`}
            data-testid="milo-state-box"
          >
            <div className="milo-renderer__visual-indicator" aria-hidden="true">
              {meta.icon}
            </div>
            <strong className="milo-renderer__state-label">
              {meta.label}
            </strong>
          </div>

          {/* Description & State Feedback */}
          <p className="milo-renderer__description">
            {meta.description}
          </p>

          {/* Diagnostics Section */}
          {showDiagnostics && (
            <div className="milo-renderer__diagnostics">
              <div className="milo-renderer__diagnostic-row">
                <span>Animation:</span>
                <span className="font-mono">{animation?.name ?? "none"}</span>
              </div>
              {liveSnapshot?.previousState && (
                <div className="milo-renderer__diagnostic-row">
                  <span>Previous:</span>
                  <span className="font-mono">{liveSnapshot.previousState}</span>
                </div>
              )}
            </div>
          )}
        </Stack>
      </Card>
    </div>
  );
}
