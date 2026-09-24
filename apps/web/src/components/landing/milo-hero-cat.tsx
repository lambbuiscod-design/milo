"use client";

import { useRef } from "react";

type Mood = "happy" | "curious" | "focused" | "sleepy" | "celebrating";

interface MiloHeroCatProps {
  mood?: Mood;
  className?: string;
  mouseX?: number;
  mouseY?: number;
  style?: React.CSSProperties;
}

export function MiloHeroCat({ mood = "happy", className = "", mouseX = 0, mouseY = 0, style }: MiloHeroCatProps) {
  // Pupil offset for eye tracking — capped at ±5 units
  const px = Math.max(-5, Math.min(5, mouseX * 8));
  const py = Math.max(-5, Math.min(5, mouseY * 8));

  const eyeRy = mood === "sleepy" ? 4 : mood === "focused" ? 8 : 11;
  const showGlints = mood !== "sleepy" && mood !== "focused";

  // Tail wag for celebrating
  const tailRef = useRef<SVGPathElement>(null);

  const mouthPath = (() => {
    switch (mood) {
      case "happy":
      case "celebrating":
        return "M80 122v3m-9 1c3 6 8 6 9 3m0 0c1 3 6 3 9-3";
      case "curious":
        return "M83 122c3-2 6-2 9 0m-4 2c0 2 2 2 2 0";
      case "focused":
        return "M82 124c4-1 7-1 11 0";
      case "sleepy":
        return "M83 122c4 3 8 1 9-1";
      default:
        return "M80 122v3m-9 1c3 6 8 6 9 3m0 0c1 3 6 3 9-3";
    }
  })();

  return (
    <svg
      aria-label="Milo the cat"
      role="img"
      viewBox="0 0 180 180"
      className={className}
      style={{ overflow: "visible", ...style }}
    >
      {/* Glow ring behind head */}
      <ellipse cx="90" cy="105" rx="64" ry="60" fill="url(#heroGlow)" opacity="0.35" />

      {/* Ear outer left */}
      <path
        d="M48 82C48 58 52 34 58 30c4-3 8 5 17 16Z"
        fill="#2b3044"
        stroke="#1a1e2e"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {/* Ear outer right */}
      <path
        d="M132 82C132 58 128 34 122 30c-4-3-8 5-17 16Z"
        fill="#2b3044"
        stroke="#1a1e2e"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {/* Ear inner left – emerald accent in dark mode */}
      <path
        d="M55 78c0-16 3-28 6-30 2-1 5 4 11 13Z"
        fill="#34d399"
        opacity="0.8"
      />
      {/* Ear inner right */}
      <path
        d="M125 78c0-16-3-28-6-30-2-1-5 4-11 13Z"
        fill="#34d399"
        opacity="0.8"
      />

      {/* Head body */}
      <circle cx="90" cy="104" r="60" fill="#2b3044" stroke="#1a1e2e" strokeWidth="3" />

      {/* Blush cheeks */}
      <circle cx="57" cy="118" r="12" fill="#34d399" opacity="0.15" />
      <circle cx="123" cy="118" r="12" fill="#34d399" opacity="0.15" />

      {/* Left eye socket */}
      <ellipse cx="70" cy="98" rx="10" ry={eyeRy} fill="#111827" />
      {/* Right eye socket */}
      <ellipse cx="110" cy="98" rx="10" ry={eyeRy} fill="#111827" />

      {/* Pupils with mouse tracking */}
      <ellipse cx={70 + px} cy={98 + py} rx="5" ry={Math.max(3, eyeRy - 3)} fill="#1e293b" />
      <ellipse cx={110 + px} cy={98 + py} rx="5" ry={Math.max(3, eyeRy - 3)} fill="#1e293b" />

      {/* Eye glints */}
      {showGlints && (
        <>
          <circle cx={67 + px} cy={94 + py} r="2.5" fill="white" opacity="0.9" />
          <circle cx={71 + px} cy={100 + py} r="1.2" fill="white" opacity="0.7" />
          <circle cx={107 + px} cy={94 + py} r="2.5" fill="white" opacity="0.9" />
          <circle cx={111 + px} cy={100 + py} r="1.2" fill="white" opacity="0.7" />
        </>
      )}

      {/* Sleepy zz */}
      {mood === "sleepy" && (
        <text x="120" y="72" fontSize="14" fill="#34d399" opacity="0.7" fontWeight="bold">zz</text>
      )}

      {/* Celebrating star */}
      {mood === "celebrating" && (
        <>
          <text x="20" y="60" fontSize="16" opacity="0.8">✨</text>
          <text x="130" y="55" fontSize="12" opacity="0.8">⭐</text>
        </>
      )}

      {/* Nose */}
      <path
        d="M87.5 111c0-1.5 5-1.5 5 0 0 2-1.8 3.5-2.5 4-.7-.5-2.5-2-2.5-4Z"
        fill="#34d399"
        opacity="0.9"
      />

      {/* Mouth */}
      <path
        d={mouthPath}
        fill="none"
        stroke="#1b1f2e"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.5"
      />

      {/* Whiskers */}
      <g fill="none" stroke="#34d399" strokeLinecap="round" strokeWidth="1.5" opacity="0.35">
        <path d="M57 109C48 108 38 108 28 110" />
        <path d="M58 116C49 118 39 121 30 125" />
        <path d="M123 109C132 108 142 108 152 110" />
        <path d="M122 116C131 118 141 121 150 125" />
      </g>

      {/* Curled tail */}
      <path
        ref={tailRef}
        d="M130 152c20 2 28-10 24-22-3-9-13-11-17-5-3 4-1 11 6 10"
        fill="none"
        stroke="#2b3044"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="9"
        style={{
          transformOrigin: "130px 152px",
          animation: mood === "celebrating" ? "tailWag 0.4s ease-in-out infinite alternate" : "none",
        }}
      />

      <defs>
        <radialGradient id="heroGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#34d399" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
}
