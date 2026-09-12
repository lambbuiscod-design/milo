import { useState, useEffect } from "react";
import type { CharacterState, DesktopState, MiloAppearance } from "../shared/contracts";

type MiloCatProps = Readonly<{
  state: DesktopState | CharacterState;
  "aria-label"?: string;
  pupilOffset?: { x: number; y: number };
  appearance?: MiloAppearance;
}>;

const STATE_LABELS: Record<string, string> = {
  idle: "Milo is resting",
  noticed: "Milo noticed local activity",
  generating: "Milo is preparing suggestions",
  ready: "Suggestions are ready",
  paused: "Milo is paused",
  error: "Milo needs attention",
  looking: "Milo is looking around",
  dragging: "Milo is being moved",
  drop: "Milo dropped",
  pet: "Milo is being pet",
  purring: "Milo is purring",
  curious: "Milo is curious",
  playful: "Milo is playful",
  alert: "Milo noticed activity",
  thinking: "Milo is thinking",
  celebrating: "Milo is celebrating",
  level_up: "Milo leveled up",
  sleepy: "Milo is sleepy",
  sleeping: "Milo is sleeping",
  waking: "Milo is waking up",
  offline: "Milo is offline",
};

export function MiloCat({ state, "aria-label": customAriaLabel, pupilOffset: externalPupilOffset, appearance }: MiloCatProps) {
  const [localPupil, setLocalPupil] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Very simple normalized tracking
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      const dx = (e.clientX - cx) / cx;
      const dy = (e.clientY - cy) / cy;
      setLocalPupil({ x: dx * 3, y: dy * 3 }); // max 3px movement
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const pupilOffset = externalPupilOffset || localPupil;
  const displayState = state;


  const furColors = {
    charcoal: { cat: "#2b3044", ear: "#d97757", nose: "#c86d51" },
    slate: { cat: "#4a5568", ear: "#7b8fab", nose: "#6b7fa0" },
    mauve: { cat: "#7c6b7e", ear: "#b8939b", nose: "#a8838b" },
    caramel: { cat: "#8b6a3e", ear: "#c49a6c", nose: "#b58a5c" }
  };

  const furKey = appearance?.fur as keyof typeof furColors;
  const fur = furKey && furColors[furKey] ? furColors[furKey] : furColors.charcoal;
  const styleVars = {
    "--cat": fur.cat,
    "--cat-ear": fur.ear,
    "--cat-nose": fur.nose,
  } as React.CSSProperties;
  const isWide =
    displayState === "noticed" ||
    displayState === "alert" ||
    displayState === "curious" ||
    displayState === "playful" ||
    displayState === "looking" ||
    displayState === "dragging";
  const eyes = displayState === "paused" || displayState === "sleeping" ? "paused" : isWide ? "wide" : "normal";

  return (
    <svg
      className={`milo-cat milo-cat--${displayState}`}
      viewBox="0 0 128 128"
      role="img"
      aria-label={customAriaLabel ?? "Milo cat mascot"}
      style={styleVars}
    >
      <title>{STATE_LABELS[state]}</title>

      {/* Small curled tail attached to right hip */}
      <path
        className="milo-cat__tail"
        d="M84 98c11 2 22-2 24-13 2-9-7-13-11-8-3 4-1 9 4 8"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="6.5"
      />

      {/* Warmer rounded feline body */}
      <path
        className="milo-cat__body"
        d="M34 77c-6 13-4 30 4 39 4 4 11 5 26 5s22-1 26-5c8-9 10-26 4-39-4-7-12-11-27-11s-23 4-27 11Z"
        fill="currentColor"
      />

      {/* Outer ears with rounded tips */}
      <path
        className="milo-cat__ear"
        d="M30 42C30 28 34 14 40 12c5-1 9 6 18 14M98 42C98 28 94 14 88 12c-5-1-9 6-18 14"
        fill="currentColor"
        stroke="var(--cat-outline)"
        strokeLinejoin="round"
        strokeLinecap="round"
        strokeWidth="4"
      />

      {/* Ear tips with inner color */}
      <path
        d="M37 38c0-10 2-19 5-21 2-1 4 3 10 10ZM91 38c0-10-2-19-5-21-2-1-4 3-10 10Z"
        fill="var(--cat-ear)"
      />

      {/* Softer feline head with cute rounded cheeks */}
      <path
        className="milo-cat__head"
        d="M26 53C26 33 42 20 64 20s38 13 38 33c0 14-4 23-9 29-8 9-17 11-29 11s-21-2-29-11c-5-6-9-15-9-29Z"
        fill="currentColor"
        stroke="var(--cat-outline)"
        strokeWidth="4"
      />

      {/* Eyes: paused resting curve or expressive dual-glint eyes */}
      {eyes === "paused" ? (
        <g className="milo-cat__eyes" fill="none" stroke="var(--cat-feature)" strokeLinecap="round" strokeWidth="3.5">
          <path d="M42 57c2.5 3 9.5 3 12 0M74 57c2.5 3 9.5 3 12 0" />
        </g>
      ) : (
        <g className={`milo-cat__eyes milo-cat__eyes--${eyes}`} fill="var(--cat-feature)">
          <g
            style={{
              transform: `translate(${pupilOffset?.x ?? 0}px, ${pupilOffset?.y ?? 0}px)`,
              transition: "transform 80ms ease-out",
            }}
          >
            <ellipse cx="48" cy="57" rx={eyes === "wide" ? 6 : 5} ry={eyes === "wide" ? 8.5 : 7.5} />
            <ellipse cx="80" cy="57" rx={eyes === "wide" ? 6 : 5} ry={eyes === "wide" ? 8.5 : 7.5} />
            {/* Dual glints */}
            <circle cx="46.5" cy="54.5" r="1.8" fill="var(--cat-eye-glint)" />
            <circle cx="50" cy="58.5" r="0.9" fill="var(--cat-eye-glint)" />
            <circle cx="78.5" cy="54.5" r="1.8" fill="var(--cat-eye-glint)" />
            <circle cx="82" cy="58.5" r="0.9" fill="var(--cat-eye-glint)" />
          </g>
        </g>
      )}

      {/* Subtle nose */}
      <path
        d="M61.8 65.5c0-1.2 4.4-1.2 4.4 0 0 1.4-1.6 2.7-2.2 3.1-.6-.4-2.2-1.7-2.2-3.1Z"
        fill="var(--cat-nose)"
      />

      {/* Expressive feline mouth curve */}
      <path
        className="milo-cat__mouth"
        d={
          displayState === "error"
            ? "M64 68.6v2m-6 3.5c2-2 4.5-2 6-.5m0 .5c1.5-1.5 4-1.5 6 .5"
            : displayState === "ready"
            ? "M64 68.6v2m-8 2c2.5 3.5 5.5 3.5 8 .5m0 0c2.5 3 5.5 3 8-.5"
            : "M64 68.6v2m-7 2c2 2.2 4.5 2.2 7 .5m0 0c2.5 1.7 5 1.7 7-.5"
        }
        fill="none"
        stroke="var(--cat-feature)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.5"
      />

      {/* Better whiskers: thinner, natural graceful arcs */}
      <g fill="none" stroke="var(--cat-feature)" strokeLinecap="round" strokeWidth="1.5" opacity="0.68">
        <path d="M43 68C37 67 30 67 23 69M43 73C37 74 30 77 24 81M85 68C91 67 98 67 105 69M85 73C91 74 98 77 104 81" />
      </g>

      {/* Generating state: 3 subtle pulsing animated thinking dots cleanly inside viewBox 0 0 128 128 */}
      {displayState === "generating" && (
        <g className="milo-cat__thinking" fill="var(--cat-badge, var(--brand, #2b3044))">
          <circle cx="96" cy="26" r="3" opacity="0.4">
            <animate attributeName="opacity" values="0.3;1;0.3" dur="1.4s" repeatCount="indefinite" begin="0s" />
            <animate attributeName="r" values="2.6;3.4;2.6" dur="1.4s" repeatCount="indefinite" begin="0s" />
          </circle>
          <circle cx="106" cy="19" r="3.5" opacity="0.4">
            <animate attributeName="opacity" values="0.3;1;0.3" dur="1.4s" repeatCount="indefinite" begin="0.25s" />
            <animate attributeName="r" values="3.0;4.0;3.0" dur="1.4s" repeatCount="indefinite" begin="0.25s" />
          </circle>
          <circle cx="116" cy="13" r="4" opacity="0.4">
            <animate attributeName="opacity" values="0.3;1;0.3" dur="1.4s" repeatCount="indefinite" begin="0.5s" />
            <animate attributeName="r" values="3.5;4.6;3.5" dur="1.4s" repeatCount="indefinite" begin="0.5s" />
          </circle>
        </g>
      )}

      {/* State Badges: ready, error, paused */}
      {displayState === "ready" && (
        <g className="milo-cat__badge" aria-hidden="true">
          <circle cx="106" cy="24" r="14" fill="var(--state-ready)" />
          <path d="m99 24 5 5 9-11" fill="none" stroke="var(--state-on-ready)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
        </g>
      )}
      {displayState === "error" && (
        <g className="milo-cat__badge" aria-hidden="true">
          <path d="m106 10 15 26H91Z" fill="var(--state-error)" stroke="var(--surface)" strokeLinejoin="round" strokeWidth="3" />
          <path d="M106 19v8m0 4v1" stroke="var(--state-on-error)" strokeLinecap="round" strokeWidth="3" />
        </g>
      )}
      {displayState === "paused" && (
        <g className="milo-cat__badge" aria-hidden="true">
          <circle cx="106" cy="24" r="14" fill="var(--state-paused)" />
          <path d="M102 18v12m8-12v12" stroke="var(--state-on-paused)" strokeLinecap="round" strokeWidth="4" />
        </g>
      )}
    </svg>
  );
}
