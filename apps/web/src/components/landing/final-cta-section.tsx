"use client";

import { useState, useRef } from "react";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { MiloHeroCat } from "./milo-hero-cat";

const MEMORIES = [
  "That time you stayed up to finish the project.",
  "How you always start slow but finish strong.",
  "Your favorite focus playlist. Or silence.",
  "The streak you broke. And rebuilt.",
  "That bug you finally fixed at 11pm.",
];

export function FinalCtaSection() {
  const [hovering, setHovering] = useState(false);
  const [memIdx, setMemIdx] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const shouldReduceMotion = useReducedMotion();

  function startMemoryCycle() {
    setHovering(true);
    intervalRef.current = setInterval(() => {
      setMemIdx((i) => (i + 1) % MEMORIES.length);
    }, 1400);
  }

  function stopMemoryCycle() {
    setHovering(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }

  return (
    <section id="download" className="relative py-40 overflow-hidden border-t border-white/[0.04]">
      
      {/* Center elegant volume light */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        aria-hidden="true"
        style={{
          width: 800,
          height: 800,
          background: "radial-gradient(circle, rgba(255,255,255,0.02) 0%, transparent 60%)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-3xl px-5 sm:px-8 text-center">

        {/* Milo — the protagonist of the CTA */}
        <motion.div
          className="flex justify-center mb-12"
          animate={shouldReduceMotion ? {} : hovering ? { scale: 1.08, y: -10 } : { scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 180, damping: 14 }}
        >
          {/* Key light above Milo */}
          <div className="relative">
            <div
              className="absolute -top-8 left-1/2 -translate-x-1/2 pointer-events-none"
              aria-hidden="true"
              style={{
                width: 200,
                height: 80,
                background: "radial-gradient(ellipse, rgba(255,255,255,0.05), transparent 70%)",
                filter: "blur(14px)",
              }}
            />
            <MiloHeroCat
              mood={hovering ? "celebrating" : "happy"}
              className="w-36 h-36 sm:w-44 sm:h-44"
              style={{ filter: "drop-shadow(0 20px 48px rgba(0,0,0,0.8))" }}
            />
          </div>
        </motion.div>

        {/* Headline */}
        <motion.h2
          className="font-bold text-white tracking-[-0.04em] mb-8"
          style={{ fontSize: "clamp(2.5rem, 6vw, 4.5rem)", lineHeight: 1.05 }}
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          A companion that <br />
          <span className="text-white/40">remembers you.</span>
        </motion.h2>

        {/* Interactive Memory Ticker */}
        <div className="h-10 mb-12 flex justify-center">
          <AnimatePresence mode="wait">
            {!hovering ? (
              <motion.p
                key="default"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="text-white/40 text-[15px]"
              >
                (Hover the button below)
              </motion.p>
            ) : (
              <motion.div
                key={memIdx}
                initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
                transition={{ duration: 0.4 }}
                className="inline-flex px-5 py-2 rounded-full bg-white/[0.04] border border-white/[0.08] backdrop-blur-md"
              >
                <p className="text-[13px] font-medium text-white/80">
                  {MEMORIES[memIdx]}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Action Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <a
            href="#download"
            className="inline-flex items-center justify-center gap-2 rounded-full px-10 py-4 text-[15px] font-medium text-black bg-white transition-all duration-300 hover:scale-[1.03] active:scale-[0.97]"
            onMouseEnter={startMemoryCycle}
            onMouseLeave={stopMemoryCycle}
            onFocus={startMemoryCycle}
            onBlur={stopMemoryCycle}
            style={{
              boxShadow: hovering ? "0 0 0 4px rgba(255,255,255,0.1), 0 12px 40px rgba(255,255,255,0.15)" : "none",
            }}
          >
            Download Milo
          </a>
          
          <p className="mt-6 text-[12px] font-semibold tracking-wide text-white/30 uppercase">
            Mac, Windows, Linux
          </p>
        </motion.div>

      </div>
    </section>
  );
}
