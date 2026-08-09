import { useId } from "react";

type MiloCatProps = {
  className?: string;
  label?: string;
  mood?: "happy" | "thinking";
};

export function MiloCat({ className = "", label, mood = "happy" }: MiloCatProps) {
  const gradientId = useId();
  const shadowId = useId();

  return (
    <svg
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={className}
      focusable="false"
      viewBox="0 0 180 180"
      role={label ? "img" : undefined}
    >
      <defs>
        <linearGradient id={gradientId} x1="28" y1="24" x2="145" y2="158" gradientUnits="userSpaceOnUse">
          <stop stopColor="#9da6ff" />
          <stop offset=".48" stopColor="#7280fb" />
          <stop offset="1" stopColor="#5163ec" />
        </linearGradient>
        <filter id={shadowId} x="-30%" y="-30%" width="160%" height="170%">
          <feDropShadow dx="0" dy="8" floodColor="#313a93" floodOpacity=".18" stdDeviation="7" />
        </filter>
      </defs>
      <g filter={`url(#${shadowId})`}>
        <path d="M37 61 25 23l42 23M143 61l12-38-42 23" fill="#596bf5" stroke="#343d99" strokeWidth="5" strokeLinejoin="round" />
        <circle cx="90" cy="91" r="64" fill={`url(#${gradientId})`} stroke="#343d99" strokeWidth="5" />
        <path d="m44 51-10-19 23 13m79 6 10-19-23 13" fill="#f4a7c1" />
        <path d="M62 53c16-11 40-11 56 0" fill="none" stroke="#c2c8ff" strokeLinecap="round" strokeWidth="5" opacity=".5" />
        <ellipse cx="68" cy="87" rx="8" ry={mood === "thinking" ? 4 : 10} fill="#25264d" />
        <ellipse cx="112" cy="87" rx="8" ry={mood === "thinking" ? 4 : 10} fill="#25264d" />
        <circle cx="65" cy="83" r="2" fill="white" opacity={mood === "thinking" ? 0 : 0.9} />
        <circle cx="109" cy="83" r="2" fill="white" opacity={mood === "thinking" ? 0 : 0.9} />
        <path d="m84 108 6 5 6-5" fill="#f4a7c1" stroke="#25264d" strokeWidth="4" strokeLinejoin="round" />
        {mood === "happy" ? (
          <path d="M72 116c8 14 28 14 36 0" fill="none" stroke="#25264d" strokeWidth="4" strokeLinecap="round" />
        ) : (
          <circle cx="90" cy="123" r="5" fill="#25264d" />
        )}
        <path d="M55 108 20 101m37 18-34 8m102-19 35-7m-37 18 34 8" stroke="#343d99" strokeWidth="4" strokeLinecap="round" />
        <circle cx="49" cy="103" r="8" fill="#f4a7c1" opacity=".55" />
        <circle cx="131" cy="103" r="8" fill="#f4a7c1" opacity=".55" />
      </g>
    </svg>
  );
}
