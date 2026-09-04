import type { DesktopState } from "../shared/contracts";

type MiloCatProps = Readonly<{ state: DesktopState }>;

const STATE_LABELS: Record<DesktopState, string> = {
  idle: "Milo is resting",
  noticed: "Milo noticed local activity",
  generating: "Milo is preparing suggestions",
  ready: "Suggestions are ready",
  paused: "Milo is paused",
  error: "Milo needs attention",
};

export function MiloCat({ state }: MiloCatProps) {
  const eyes = state === "paused" ? "paused" : state === "noticed" ? "wide" : "normal";

  return (
    <svg
      className={`milo-cat milo-cat--${state}`}
      viewBox="0 0 128 128"
      role="img"
      aria-label={STATE_LABELS[state]}
    >
      <path
        className="milo-cat__tail"
        d="M101 84c19 1 21 21 8 28-8 4-15-1-13-8 1-4 5-5 8-3"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="8"
      />
      <path
        className="milo-cat__body"
        d="M36 77c-3 15-2 34 6 42h44c8-10 8-28 3-42Z"
        fill="currentColor"
      />
      <path
        className="milo-cat__ear"
        d="m31 34 5-24 22 16M97 34l-5-24-22 16"
        fill="currentColor"
        stroke="var(--cat-outline)"
        strokeLinejoin="round"
        strokeWidth="4"
      />
      <path
        className="milo-cat__head"
        d="M26 50c0-20 17-34 38-34s38 14 38 34v17c0 23-17 35-38 35S26 90 26 67Z"
        fill="currentColor"
        stroke="var(--cat-outline)"
        strokeWidth="4"
      />
      <path d="m40 29 4-10 9 8M88 29l-4-10-9 8" fill="var(--cat-ear)" />

      {eyes === "paused" ? (
        <g className="milo-cat__eyes" fill="none" stroke="var(--cat-feature)" strokeLinecap="round" strokeWidth="4">
          <path d="M43 57h11M74 57h11" />
        </g>
      ) : (
        <g className={`milo-cat__eyes milo-cat__eyes--${eyes}`} fill="var(--cat-feature)">
          <ellipse cx="48" cy="57" rx={eyes === "wide" ? 5 : 4} ry={eyes === "wide" ? 7 : 6} />
          <ellipse cx="80" cy="57" rx={eyes === "wide" ? 5 : 4} ry={eyes === "wide" ? 7 : 6} />
          <circle cx="49" cy="55" r="1.5" fill="var(--cat-eye-glint)" />
          <circle cx="81" cy="55" r="1.5" fill="var(--cat-eye-glint)" />
        </g>
      )}

      <path d="m64 66-4 4h8Z" fill="var(--cat-nose)" />
      <path
        className="milo-cat__mouth"
        d={state === "error" ? "M57 79c4-4 10-4 14 0" : state === "ready" ? "M55 74c4 9 14 9 18 0" : "M58 74c3 4 9 4 12 0"}
        fill="none"
        stroke="var(--cat-feature)"
        strokeLinecap="round"
        strokeWidth="3"
      />
      <g fill="none" stroke="var(--cat-feature)" strokeLinecap="round" strokeWidth="2" opacity=".72">
        <path d="M44 70 27 66M45 75l-17 2M84 70l17-4M83 75l17 2" />
      </g>

      {state === "generating" && (
        <g className="milo-cat__thinking" fill="var(--cat-badge)">
          <circle cx="100" cy="24" r="4" />
          <circle cx="110" cy="14" r="6" />
          <circle cx="121" cy="5" r="8" />
        </g>
      )}
      {state === "ready" && (
        <g className="milo-cat__badge" aria-hidden="true">
          <circle cx="106" cy="24" r="14" fill="var(--state-ready)" />
          <path d="m99 24 5 5 9-11" fill="none" stroke="var(--state-on-ready)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
        </g>
      )}
      {state === "error" && (
        <g className="milo-cat__badge" aria-hidden="true">
          <path d="m106 10 15 26H91Z" fill="var(--state-error)" stroke="var(--surface)" strokeLinejoin="round" strokeWidth="3" />
          <path d="M106 19v8m0 4v1" stroke="var(--state-on-error)" strokeLinecap="round" strokeWidth="3" />
        </g>
      )}
      {state === "paused" && (
        <g className="milo-cat__badge" aria-hidden="true">
          <circle cx="106" cy="24" r="14" fill="var(--state-paused)" />
          <path d="M102 18v12m8-12v12" stroke="var(--state-on-paused)" strokeLinecap="round" strokeWidth="4" />
        </g>
      )}
    </svg>
  );
}
