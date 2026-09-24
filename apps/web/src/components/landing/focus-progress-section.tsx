"use client";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Zap, Flame } from "lucide-react";
import { MiloHeroCat } from "./milo-hero-cat";

const TASKS = [
  "Write project proposal",
  "Review pull requests",
  "Reply to emails",
];

const ENCOURAGEMENTS = [
  "You're doing great.",
  "One down. Nice work.",
  "That's two! You're on fire.",
  "All done. Time for a break?",
];

// Pre-computed particles for click effect
const CLICK_PARTICLES = Array.from({ length: 12 }, (_, i) => ({
  id: i,
  angle: (i * 30 * Math.PI) / 180,
}));

export function FocusProgressSection() {
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [xp, setXp] = useState(250);
  const [streak, setStreak] = useState(12);
  const [lastClick, setLastClick] = useState<{ x: number; y: number; id: number } | null>(null);
  const [clickCount, setClickCount] = useState(0);

  const shouldReduceMotion = useReducedMotion();
  const maxXp = 500;

  function toggleTask(i: number, e: React.MouseEvent) {
    if (shouldReduceMotion) {
      updateState(i);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setLastClick({ x: e.clientX - rect.left, y: e.clientY - rect.top, id: clickCount });
    setClickCount((c) => c + 1);
    updateState(i);
  }

  function updateState(i: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) {
        next.delete(i);
        setXp((x) => Math.max(0, x - 50));
      } else {
        next.add(i);
        setXp((x) => Math.min(maxXp, x + 50));
        if (next.size === TASKS.length) {
          setStreak((s) => s + 1);
        }
      }
      return next;
    });
  }

  const progress = checked.size;
  const currentMood = progress === TASKS.length ? "celebrating" : progress > 0 ? "happy" : "focused";

  return (
    <section className="py-24 relative overflow-hidden border-t border-white/[0.04]">
      
      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        
        {/* Header */}
        <div className="text-center mb-16">
          <motion.p
            className="text-[11px] font-semibold text-white/30 tracking-[0.2em] uppercase mb-5"
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ ease: [0.16, 1, 0.3, 1] }}
          >
            Daily Habits
          </motion.p>
          <motion.h2
            className="font-bold text-white tracking-[-0.04em]"
            style={{ fontSize: "clamp(2.5rem, 5.5vw, 4rem)", lineHeight: 1.08 }}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            Milo grows with<br />
            <span className="text-white/40">your progress.</span>
          </motion.h2>
          <motion.p
            className="mt-6 text-white/50 text-lg max-w-[440px] mx-auto leading-relaxed"
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            Check off a task to see Milo react. More satisfying than a plain to-do list.
          </motion.p>
        </div>

        <div className="grid lg:grid-cols-2 gap-16 max-w-4xl mx-auto items-center">
          
          {/* Tasks panel */}
          <motion.div
            className="rounded-[24px] p-8 bg-white/[0.02] border border-white/[0.06]"
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* XP bar */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Zap size={14} className="text-white/60" />
                  <span className="text-[13px] font-medium text-white/90">Level 4 — {xp} XP</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Flame size={14} className="text-white/40" />
                  <span className="text-[12px] text-white/50">{streak} day streak</span>
                </div>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden bg-white/5">
                <motion.div
                  className="h-full rounded-full bg-white"
                  animate={{ width: `${(xp / maxXp) * 100}%` }}
                  transition={{ type: "spring", stiffness: 100, damping: 20 }}
                />
              </div>
            </div>

            <p className="text-[11px] font-semibold text-white/30 uppercase tracking-[0.15em] mb-4">Today's tasks</p>

            <div className="space-y-3">
              {TASKS.map((task, i) => (
                <motion.button
                  key={task}
                  onClick={(e) => toggleTask(i, e)}
                  className="relative w-full flex items-center gap-4 rounded-[14px] p-4 text-left transition-colors duration-200 overflow-hidden group"
                  style={{
                    background: checked.has(i) ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.02)",
                    border: checked.has(i) ? "1px solid rgba(255,255,255,0.15)" : "1px solid rgba(255,255,255,0.05)",
                  }}
                  whileTap={{ scale: 0.98 }}
                >
                  {/* Click ripple effect */}
                  <AnimatePresence>
                    {lastClick && lastClick.id === clickCount - 1 && checked.has(i) && !shouldReduceMotion && (
                      <motion.div
                        className="absolute w-12 h-12 rounded-full bg-white/10 pointer-events-none"
                        style={{ left: lastClick.x - 24, top: lastClick.y - 24 }}
                        initial={{ scale: 0, opacity: 1 }}
                        animate={{ scale: 6, opacity: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                      />
                    )}
                  </AnimatePresence>

                  <div
                    className="flex-shrink-0 h-5 w-5 rounded-[6px] flex items-center justify-center transition-all duration-300 relative"
                    style={{
                      background: checked.has(i) ? "#ffffff" : "transparent",
                      border: checked.has(i) ? "1px solid #ffffff" : "1px solid rgba(255,255,255,0.2)",
                    }}
                  >
                    <AnimatePresence>
                      {checked.has(i) && (
                        <motion.svg
                          initial={{ opacity: 0, scale: 0 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0 }}
                          transition={{ type: "spring", stiffness: 400, damping: 20 }}
                          viewBox="0 0 24 24"
                          className="w-3.5 h-3.5 text-black"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </motion.svg>
                      )}
                    </AnimatePresence>
                  </div>
                  
                  <span
                    className="text-[14px] flex-1 font-medium transition-all duration-300"
                    style={{
                      color: checked.has(i) ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.9)",
                      textDecoration: checked.has(i) ? "line-through" : "none",
                    }}
                  >
                    {task}
                  </span>
                  
                  {checked.has(i) && (
                    <span className="text-[11px] font-semibold text-white/50 flex-shrink-0">+50 XP</span>
                  )}
                </motion.button>
              ))}
            </div>
          </motion.div>

          {/* Milo reaction */}
          <motion.div
            className="flex flex-col items-center justify-center"
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="relative flex flex-col items-center justify-center min-h-[300px]">
              
              {/* Message Bubble */}
              <div className="h-14 mb-8">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={progress}
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    className="px-5 py-3 rounded-[16px] bg-white/[0.03] border border-white/[0.08] backdrop-blur-md"
                  >
                    <p className="text-[14px] font-medium text-white/80">{ENCOURAGEMENTS[progress]}</p>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Milo */}
              <div className="relative">
                <motion.div
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                >
                  <MiloHeroCat
                    mood={currentMood}
                    className="w-[140px] h-[140px] drop-shadow-2xl"
                    style={{ filter: "drop-shadow(0 20px 40px rgba(0,0,0,0.6))" }}
                  />
                </motion.div>
                
                {/* Contact shadow */}
                <div
                  className="absolute -bottom-4 left-1/2 -translate-x-1/2 pointer-events-none"
                  style={{
                    width: 100,
                    height: 12,
                    background: "radial-gradient(ellipse, rgba(0,0,0,0.8) 0%, transparent 60%)",
                    filter: "blur(4px)",
                  }}
                  aria-hidden="true"
                />
              </div>

            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
