"use client";

import { useRef } from "react";

type TiltCardProps = {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  intensity?: number;
};

/**
 * CSS 3D perspective tilt card.
 * Gently tilts toward the cursor on hover — subtle, elegant, premium feel.
 * Respects prefers-reduced-motion: no transform applied when reduced motion is set.
 */
export function TiltCard({ children, className, style, intensity = 14 }: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const rect = ref.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const rotX = ((y - cy) / cy) * -(intensity / 2);
    const rotY = ((x - cx) / cx) * (intensity / 2);

    ref.current.style.transform = `perspective(900px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale(1.015)`;
  };

  const handleMouseLeave = () => {
    if (!ref.current) return;
    ref.current.style.transform = "perspective(900px) rotateX(0deg) rotateY(0deg) scale(1)";
  };

  return (
    <div
      ref={ref}
      className={className}
      style={{
        ...style,
        transition: "transform 0.25s cubic-bezier(.23,1,.32,1)",
        transformStyle: "preserve-3d",
        willChange: "transform",
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </div>
  );
}
