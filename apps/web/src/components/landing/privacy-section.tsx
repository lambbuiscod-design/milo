"use client";

import { motion, useReducedMotion } from "framer-motion";
import { EyeOff, Cpu, Shield, Lock } from "lucide-react";

const PRIVACY_POINTS = [
  {
    icon: EyeOff,
    title: "No persistent memory",
    description: "Milo never logs your conversations, names, or generated replies. No transcripts are stored in the cloud.",
  },
  {
    icon: Cpu,
    title: "100% Local Extraction",
    description: "Milo reads text using UI Automation and local OCR. Your screen pixels never leave your machine.",
  },
  {
    icon: Shield,
    title: "You control every action",
    description: "Milo never auto-sends or pastes messages on your behalf. Every output is a suggestion for you to copy or edit.",
  },
  {
    icon: Lock,
    title: "Explicit access only",
    description: "Milo only reads the single chat window you select. It is never listening or watching in the background.",
  },
];

export function PrivacySection() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section id="privacy" className="relative py-32 overflow-hidden border-t border-white/[0.04]">
      
      {/* Subtle background glow */}
      <div
        className="absolute top-1/2 right-0 -translate-y-1/2 pointer-events-none"
        aria-hidden="true"
        style={{
          width: 800,
          height: 800,
          background: "radial-gradient(circle, rgba(255,255,255,0.015) 0%, transparent 60%)",
        }}
      />

      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid lg:grid-cols-2 gap-20 items-center max-w-6xl mx-auto">

          {/* Left — headline */}
          <div>
            <motion.p
              className="text-[11px] font-semibold text-white/30 tracking-[0.2em] uppercase mb-5"
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ ease: [0.16, 1, 0.3, 1] }}
            >
              Privacy First
            </motion.p>
            <motion.h2
              className="font-bold tracking-[-0.04em] text-white leading-[1.08] mb-6"
              style={{ fontSize: "clamp(2.5rem, 5.5vw, 4rem)" }}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
              Your screen.<br />
              <span className="text-white/40">Your business.</span>
            </motion.h2>
            <motion.p
              className="text-lg text-white/50 leading-relaxed max-w-md"
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
              AI doesn&apos;t have to be invasive to be useful. Milo is designed with strict boundaries, running locally whenever possible and never hoarding your data.
            </motion.p>

            {/* The Flow Diagram */}
            <motion.div
              className="mt-14 relative"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="flex items-center justify-between max-w-[320px] relative z-10">
                <div className="w-[84px] h-[84px] rounded-full border border-white/[0.08] bg-white/[0.02] backdrop-blur-md flex flex-col items-center justify-center gap-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-white/40" />
                  <span className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">You</span>
                </div>

                <div className="w-[84px] h-[84px] rounded-full border border-white/[0.15] bg-white/[0.06] backdrop-blur-md shadow-[0_0_30px_rgba(255,255,255,0.05)] flex flex-col items-center justify-center gap-1 z-10">
                  <div className="w-3 h-3 rounded-full bg-white/90" />
                  <span className="text-[10px] font-bold text-white uppercase tracking-widest">Milo</span>
                </div>

                <div className="w-[84px] h-[84px] rounded-full border border-white/[0.05] bg-transparent flex flex-col items-center justify-center gap-1 opacity-40">
                  <div className="w-2.5 h-2.5 border border-white/40 rounded-sm" />
                  <span className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">Cloud</span>
                </div>
              </div>

              {/* Connecting dashed line */}
              <div
                className="absolute top-1/2 -translate-y-1/2 left-10 right-10 h-px pointer-events-none z-0"
                style={{
                  backgroundImage: "linear-gradient(to right, rgba(255,255,255,0.2) 50%, transparent 50%)",
                  backgroundSize: "8px 100%",
                }}
              />

              {/* Animated data packet traveling between You and Milo only */}
              {!shouldReduceMotion && (
                <motion.div
                  className="absolute top-1/2 -translate-y-1/2 left-[52px] h-1.5 w-1.5 rounded-full bg-white"
                  style={{ boxShadow: "0 0 10px rgba(255,255,255,0.8)" }}
                  animate={{
                    x: [0, 106, 106, 0],
                    opacity: [0, 1, 0, 0]
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              )}
            </motion.div>
          </div>

          {/* Right — points */}
          <div className="space-y-4">
            {PRIVACY_POINTS.map((point, i) => (
              <motion.div
                key={point.title}
                className="flex gap-5 p-6 rounded-[20px] bg-white/[0.01] border border-white/[0.04] transition-colors hover:bg-white/[0.03] hover:border-white/[0.08]"
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ delay: i * 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="flex-shrink-0 mt-0.5">
                  <div className="w-10 h-10 rounded-[12px] bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
                    <point.icon size={18} className="text-white/60" strokeWidth={1.5} />
                  </div>
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-white/90 tracking-tight mb-1.5">{point.title}</h3>
                  <p className="text-[13px] text-white/50 leading-relaxed max-w-[340px]">
                    {point.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}
