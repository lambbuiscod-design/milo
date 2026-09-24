"use client";

import { motion } from "framer-motion";

const STEPS = [
  {
    num: "01",
    label: "Install",
    title: "Install Milo on Windows.",
    description:
      "Milo is a native, lightweight Windows application. It lives quietly in the corner of your screen, ready when you need it.",
    detail: "Windows 10/11",
  },
  {
    num: "02",
    label: "Target",
    title: "Explicitly select one chat window.",
    description:
      "Milo doesn't spy on your whole screen. You select the exact dating or messaging app window you want help with.",
    detail: "Strictly scoped",
  },
  {
    num: "03",
    label: "Extract",
    title: "Local text extraction.",
    description:
      "When activated, Milo reads the recent visible text using UI Automation first, with local OCR as a fallback. No pixels ever leave your device.",
    detail: "100% Local Processing",
  },
  {
    num: "04",
    label: "Activate",
    title: "Click or use Ctrl+Shift+M.",
    description:
      "Milo only acts when you ask it to. Click the companion or press the hotkey to request reply suggestions.",
    detail: "Ctrl+Shift+M",
  },
  {
    num: "05",
    label: "Suggest",
    title: "Safe, Confident, and Playful.",
    description:
      "Milo gives you three distinct reply options based on the context of the conversation. Choose the tone that fits best.",
    detail: "3 Tone Options",
  },
  {
    num: "06",
    label: "Control",
    title: "You're always in charge.",
    description:
      "Copy your favorite suggestion or edit it yourself. Milo never auto-sends or pastes messages on your behalf.",
    detail: "No auto-send",
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="relative py-32 overflow-hidden border-t border-white/[0.04]">
      <div className="mx-auto max-w-4xl px-5 sm:px-8">
        {/* Header */}
        <div className="text-center mb-24">
          <motion.p
            className="text-[11px] font-semibold text-white/30 tracking-[0.2em] uppercase mb-5"
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ ease: [0.16, 1, 0.3, 1] }}
          >
            How It Works
          </motion.p>
          <motion.h2
            className="font-bold tracking-[-0.04em] text-white"
            style={{ fontSize: "clamp(2.5rem, 5.5vw, 4rem)", lineHeight: 1.08 }}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            Simple by design.
            <br />
            <span className="text-white/40">Powerful by nature.</span>
          </motion.h2>
        </div>

        {/* Steps */}
        <div className="relative max-w-2xl mx-auto">
          {/* Vertical thread line */}
          <div
            className="absolute left-[28px] top-12 bottom-12 w-px pointer-events-none hidden sm:block"
            style={{
              background: "linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.15) 15%, rgba(255,255,255,0.15) 85%, transparent 100%)",
            }}
            aria-hidden="true"
          />

          <div className="space-y-16 sm:space-y-20">
            {STEPS.map((step, i) => (
              <motion.div
                key={step.num}
                className="relative flex gap-6 sm:gap-12 items-start"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ delay: i * 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              >
                {/* Step number marker */}
                <div
                  className="relative z-10 flex-shrink-0 flex items-center justify-center rounded-[12px] h-[56px] w-[56px] shadow-2xl"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    backdropFilter: "blur(12px)",
                  }}
                >
                  <span className="font-mono text-sm font-semibold text-white/90 tracking-widest">{step.num}</span>
                </div>

                {/* Step content */}
                <div className="flex-1 pt-1 sm:pt-2">
                  <div className="mb-4">
                    <span className="inline-flex px-3 py-1 text-[10px] uppercase tracking-widest font-semibold text-white/50 rounded-full border border-white/[0.08] mb-3">
                      {step.label}
                    </span>
                    <h3 className="text-[20px] sm:text-[24px] font-bold tracking-tight text-white mb-3">
                      {step.title}
                    </h3>
                    <p className="text-[14px] sm:text-[15px] leading-[1.7] text-white/50">
                      {step.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 mt-6">
                    <div className="h-1.5 w-1.5 rounded-full bg-white/30" />
                    <span className="text-[12px] font-medium text-white/40">{step.detail}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
