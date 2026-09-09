type MiloCatProps = {
  className?: string;
  label?: string;
  mood?: "happy" | "thinking";
};

/**
 * Milo the cat — warm charcoal with terracotta accents.
 * Matches the Electron MiloCat style. No blue gradient, no remote deps.
 * Two moods: "happy" (smile) and "thinking" (narrowed eyes, pursed mouth).
 */
export function MiloCat({ className = "", label, mood = "happy" }: MiloCatProps) {
  return (
    <svg
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={className}
      focusable="false"
      viewBox="0 0 180 180"
      role={label ? "img" : undefined}
    >
      {/* Ears outer */}
      <path
        d="M48 78C48 55 52 32 58 28c4-3 8 5 17 15ZM132 78C132 55 128 32 122 28c-4-3-8 5-17 15Z"
        fill="#2b3044"
        stroke="#1c2030"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      {/* Ear inner colour — terracotta */}
      <path
        d="M55 74c0-16 3-28 6-30 2-1 5 4 11 12ZM125 74c0-16-3-28-6-30-2-1-5 4-11 12Z"
        fill="#d97757"
      />
      {/* Head */}
      <circle cx="90" cy="100" r="60" fill="#2b3044" stroke="#1c2030" strokeWidth="4" />
      {/* Blush cheeks */}
      <circle cx="57" cy="116" r="11" fill="#d97757" opacity="0.28" />
      <circle cx="123" cy="116" r="11" fill="#d97757" opacity="0.28" />
      {/* Eyes */}
      <ellipse
        cx="70"
        cy="96"
        rx="9"
        ry={mood === "thinking" ? 5 : 11}
        fill="#1b1f2e"
      />
      <ellipse
        cx="110"
        cy="96"
        rx="9"
        ry={mood === "thinking" ? 5 : 11}
        fill="#1b1f2e"
      />
      {/* Dual glints */}
      {mood !== "thinking" && (
        <>
          <circle cx="67" cy="92" r="2.5" fill="white" />
          <circle cx="71" cy="98" r="1.2" fill="white" />
          <circle cx="107" cy="92" r="2.5" fill="white" />
          <circle cx="111" cy="98" r="1.2" fill="white" />
        </>
      )}
      {/* Nose — terracotta */}
      <path
        d="M87.5 109c0-1.5 5-1.5 5 0 0 2-1.8 3.5-2.5 4-.7-.5-2.5-2-2.5-4Z"
        fill="#c86d51"
      />
      {/* Mouth */}
      {mood === "happy" ? (
        <path
          d="M90 113v3m-9 1c3 5 7 5 9 2m0 0c2 3 6 3 9-2"
          fill="none"
          stroke="#1b1f2e"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3"
        />
      ) : (
        <path
          d="M83 119c4-3 10-3 14 0"
          fill="none"
          stroke="#1b1f2e"
          strokeLinecap="round"
          strokeWidth="3"
        />
      )}
      {/* Whiskers */}
      <g fill="none" stroke="#1b1f2e" strokeLinecap="round" strokeWidth="1.8" opacity="0.6">
        <path d="M57 107C48 106 38 106 28 108M58 114C49 116 39 119 30 123" />
        <path d="M123 107C132 106 142 106 152 108M122 114C131 116 141 119 150 123" />
      </g>
      {/* Curled tail */}
      <path
        d="M130 148c18 2 26-8 22-20-3-8-12-10-16-5-3 4-1 10 5 9"
        fill="none"
        stroke="#2b3044"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="8"
      />
    </svg>
  );
}
