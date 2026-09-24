"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { MiloHeroCat } from "./milo-hero-cat";

export function FinalCtaSection() {
  const [hovering, setHovering] = useState(false);
  const shouldReduceMotion = useReducedMotion();

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
          Never run out <br />
          <span className="text-white/40">of things to say.</span>
        </motion.h2>

        <motion.p
          className="text-white/50 text-base sm:text-lg max-w-lg mx-auto mb-10"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        >
          Try Milo with 5 free analyses. Upgrade to Milo Premium for $9.99/mo to unlock unlimited Safe, Confident, and Playful replies.
        </motion.p>

        {/* The Action */}
        <motion.div
          className="flex flex-col items-center gap-6"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <a
            href="/login"
            className="group relative h-14 flex items-center justify-center px-10 rounded-full font-bold text-black overflow-hidden select-none outline-none focus-visible:ring-4 focus-visible:ring-white/20 transition-transform hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: "linear-gradient(180deg, #ffffff 0%, #dcdcdc 100%)",
              boxShadow: "0 8px 24px rgba(255,255,255,0.1), inset 0 1px 0 rgba(255,255,255,1)",
            }}
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => setHovering(false)}
            onFocus={() => setHovering(true)}
            onBlur={() => setHovering(false)}
          >
            {/* Shimmer effect */}
            <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none" />
            <span className="relative z-10">Download for Windows</span>
          </a>

          <div className="flex flex-col items-center gap-2">
            <p className="text-[11px] font-medium text-white/30 uppercase tracking-widest">
              Available exclusively on Windows 10 & 11
            </p>
            <a href="/login" className="text-[13px] text-white/40 hover:text-white transition-colors underline underline-offset-4">
              Already have an account? Log in
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
