"use client";

import { useRef, useState, useCallback } from "react";
import { motion, useSpring, useReducedMotion } from "framer-motion";
import { MiloHeroCat } from "./milo-hero-cat";

export function HeroSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [hasMoved, setHasMoved] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const animationsDisabled = !!shouldReduceMotion;

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (animationsDisabled) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      setHasMoved(true);
      setMousePos({
        x: (e.clientX - cx) / rect.width,
        y: (e.clientY - cy) / rect.height,
      });
    },
    [animationsDisabled]
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const springX = useSpring(mousePos.x, { stiffness: 45, damping: 18 }) as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const springY = useSpring(mousePos.y, { stiffness: 45, damping: 18 }) as any;

  return (
    <section
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="relative min-h-[100svh] flex flex-col items-center justify-center overflow-hidden"
      aria-label="Hero — Meet Milo"
    >
      {/* Primary elegant lighting — very subtle neutral glow, NOT green */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        aria-hidden="true"
        style={{
          width: 800,
          height: 800,
          background: "radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 60%)",
        }}
      />

      {/* Main layout */}
      <div className="relative z-10 mx-auto max-w-7xl w-full px-5 sm:px-8 pt-32 pb-20 grid lg:grid-cols-2 gap-16 lg:gap-12 items-center">

        {/* ── LEFT COPY ── */}
        <div className="text-center lg:text-left order-2 lg:order-1 flex flex-col items-center lg:items-start">
          
          {/* Subtle tag */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="mb-8"
          >
            <span className="text-[11px] font-semibold tracking-[0.25em] text-white/40 uppercase">
              The Desktop Companion
            </span>
          </motion.div>

          {/* Headline — High contrast, elegant tracking, Apple-like */}
          <motion.h1
            className="font-bold leading-[1.08] tracking-[-0.04em] text-white"
            style={{ fontSize: "clamp(2.5rem, 5.5vw, 4.5rem)" }}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          >
            A private AI. <br />
            <span className="text-white/40">Lives with you.</span>
          </motion.h1>

          {/* Sub-copy */}
          <motion.p
            className="mt-6 text-lg leading-[1.7] text-white/50 max-w-[440px]"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            Milo helps you focus, learn, and create — quietly, locally, and entirely on your terms. No cloud. No tracking.
          </motion.p>

          {/* Clean minimal CTA */}
          <motion.div
            className="mt-10 flex flex-col sm:flex-row gap-4"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <a
              href="#meet-milo"
              className="inline-flex items-center justify-center rounded-full px-8 py-3.5 text-[14px] font-medium text-black bg-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              Meet Milo
            </a>
            <a
              href="#demo"
              className="inline-flex items-center justify-center rounded-full px-8 py-3.5 text-[14px] font-medium text-white/70 bg-white/5 border border-white/10 transition-colors hover:bg-white/10 hover:text-white"
            >
              View live demo
            </a>
          </motion.div>
        </div>

        {/* ── RIGHT MILO ── */}
        <div className="relative h-[300px] sm:h-[400px] lg:h-[500px] flex items-center justify-center order-1 lg:order-2">
          
          {/* Subtle contact shadow */}
          <div
            className="absolute -bottom-8 left-1/2 -translate-x-1/2"
            style={{
              width: 140,
              height: 20,
              background: "radial-gradient(ellipse, rgba(0,0,0,0.8) 0%, transparent 60%)",
              filter: "blur(12px)",
            }}
            aria-hidden="true"
          />

          {/* Milo */}
          <motion.div
            className="relative z-10"
            style={
              !hasMoved
                ? { y: 0 }
                : {
                    x: springX,
                    y: springY,
                    rotateX: springY,
                    rotateY: springX,
                  }
            }
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={
              animationsDisabled
                ? { opacity: 1, scale: 1, y: 0 }
                : {
                    opacity: 1,
                    scale: 1,
                    y: hasMoved ? undefined : [0, -8, 0],
                  }
            }
            transition={{
              opacity: { duration: 1, delay: 0.2 },
              scale: { duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] },
              y: { duration: 4, repeat: Infinity, ease: "easeInOut" },
            }}
          >
            <MiloHeroCat
              mood="happy"
              className="w-48 h-48 sm:w-64 sm:h-64 drop-shadow-2xl"
              style={{
                filter: "drop-shadow(0 20px 40px rgba(0,0,0,0.8)) drop-shadow(0 0 40px rgba(255,255,255,0.05))",
              }}
            />
          </motion.div>
        </div>

      </div>
    </section>
  );
}
