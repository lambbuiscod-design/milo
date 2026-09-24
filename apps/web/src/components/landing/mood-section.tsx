"use client";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { MiloHeroCat } from "./milo-hero-cat";

type MoodState = {
  key: string;
  label: string;
  mood: "happy" | "curious" | "focused" | "sleepy" | "celebrating";
  headline: string;
  subline: string;
};

const MOOD_STATES: MoodState[] = [
  {
    key: "studying",
    label: "Reading",
    mood: "curious",
    headline: "Curious and engaged.",
    subline: "Milo scans your notes and offers a clean summary before you even ask.",
  },
  {
    key: "coding",
    label: "Building",
    mood: "focused",
    headline: "Focused and precise.",
    subline: "Milo spots the bug and explains the fix without pulling you away from the editor.",
  },
  {
    key: "flow",
    label: "Deep Focus",
    mood: "focused",
    headline: "Dim and watchful.",
    subline: "Milo goes nearly invisible while your Pomodoro ticks silently in the background.",
  },
  {
    key: "win",
    label: "Goal Hit",
    mood: "celebrating",
    headline: "Genuinely happy for you.",
    subline: "You crushed it. Milo celebrates like he was rooting for you all along.",
  },
  {
    key: "late",
    label: "Late Night",
    mood: "sleepy",
    headline: "Gentle and honest.",
    subline: "It's 2am. Milo yawns, blinks slowly, and reminds you rest matters too.",
  },
];

export function MoodSection() {
  const [active, setActive] = useState(MOOD_STATES[0]);
  const shouldReduceMotion = useReducedMotion();

  return (
    <section
      id="meet-milo"
      className="relative py-32 overflow-hidden border-t border-white/[0.04]"
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        {/* Header */}
        <div className="text-center mb-24">
          <motion.p
            className="text-[11px] font-semibold text-white/30 tracking-[0.2em] uppercase mb-5"
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ ease: [0.16, 1, 0.3, 1] }}
          >
            Alive on your screen
          </motion.p>
          <motion.h2
            className="font-bold tracking-[-0.04em] text-white"
            style={{ fontSize: "clamp(2.5rem, 5.5vw, 4rem)", lineHeight: 1.08 }}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            Not a chatbot.<br />
            <span className="text-white/40">A companion.</span>
          </motion.h2>
        </div>

        <div className="grid lg:grid-cols-2 gap-16 lg:gap-8 items-center max-w-5xl mx-auto">
          {/* LEFT: The Character Canvas */}
          <motion.div
            className="relative flex items-center justify-center rounded-[24px]"
            style={{
              height: 400,
              background: "radial-gradient(ellipse at center, rgba(255,255,255,0.03) 0%, transparent 70%)",
            }}
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Ambient subtle backglow */}
            <div
              className="absolute inset-0 transition-opacity duration-1000"
              style={{
                background: "radial-gradient(circle, rgba(255,255,255,0.02) 0%, transparent 60%)",
              }}
            />

            {/* Milo */}
            <div className="relative z-10">
              <AnimatePresence mode="wait">
                <motion.div
                  key={active.key}
                  initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: -10 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                >
                  <MiloHeroCat
                    mood={active.mood}
                    className="w-48 h-48 drop-shadow-2xl"
                    style={{
                      filter: "drop-shadow(0 20px 40px rgba(0,0,0,0.8)) drop-shadow(0 0 40px rgba(255,255,255,0.03))",
                    }}
                  />
                </motion.div>
              </AnimatePresence>

              {/* Contact Shadow */}
              <div
                className="absolute -bottom-6 left-1/2 -translate-x-1/2 pointer-events-none"
                aria-hidden="true"
                style={{
                  width: 120,
                  height: 12,
                  background: "radial-gradient(ellipse, rgba(0,0,0,0.8) 0%, transparent 60%)",
                  filter: "blur(6px)",
                }}
              />
            </div>
          </motion.div>

          {/* RIGHT: Context & Copy */}
          <motion.div
            className="flex flex-col justify-center"
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={active.key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="mb-12 min-h-[120px]"
              >
                <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-4">
                  {active.headline}
                </h3>
                <p className="text-base sm:text-lg text-white/50 leading-relaxed max-w-[400px]">
                  {active.subline}
                </p>
              </motion.div>
            </AnimatePresence>

            {/* Context switchers */}
            <div className="flex flex-wrap gap-3">
              {MOOD_STATES.map((state) => {
                const isActive = active.key === state.key;
                return (
                  <button
                    key={state.key}
                    onClick={() => setActive(state)}
                    className="relative px-5 py-2.5 rounded-full text-[13px] font-medium transition-all duration-300"
                    style={{
                      background: isActive ? "rgba(255,255,255,0.1)" : "transparent",
                      color: isActive ? "#ffffff" : "rgba(255,255,255,0.4)",
                      border: "1px solid",
                      borderColor: isActive ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.05)",
                    }}
                  >
                    {state.label}
                  </button>
                );
              })}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
