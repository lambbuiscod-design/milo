"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { SpotlightCard } from "../ui/spotlight-card";
import {
  MessageSquare,
  Eye,
  Zap,
  Target,
  Monitor,
} from "lucide-react";

type FeatureCard = {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  demo: React.ReactNode;
  colSpan?: string;
  rowSpan?: string;
};

function ReplyDemo() {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setPhase((p) => (p + 1) % 3), 2000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="space-y-2 py-1 text-xs">
      <div className="rounded-[10px] p-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", opacity: phase === 0 ? 1 : 0.4 }}>
        <p className="text-[#a5d6a7] font-medium mb-1">Safe</p>
        <p className="text-white/60">&quot;That sounds like a great plan, I&apos;m down!&quot;</p>
      </div>
      <div className="rounded-[10px] p-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", opacity: phase === 1 ? 1 : 0.4 }}>
        <p className="text-[#90caf9] font-medium mb-1">Confident</p>
        <p className="text-white/60">&quot;I know a great spot. Let&apos;s do Thursday.&quot;</p>
      </div>
      <div className="rounded-[10px] p-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", opacity: phase === 2 ? 1 : 0.4 }}>
        <p className="text-[#ffab91] font-medium mb-1">Playful</p>
        <p className="text-white/60">&quot;Is that a promise or a threat? 😉&quot;</p>
      </div>
    </div>
  );
}

function LocalOCRDemo() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-4 relative h-full">
      <div className="w-full max-w-[120px] h-[60px] border border-white/20 rounded relative overflow-hidden flex items-center justify-center bg-white/5">
        <span className="text-xs font-medium text-white/40">hello.png</span>
        <motion.div
          className="absolute top-0 left-0 w-full h-[2px] bg-white/40"
          animate={{ y: [0, 60, 0] }}
          transition={{ duration: 2, ease: "linear", repeat: Infinity }}
        />
      </div>
      <p className="text-[10px] text-white/40">Extracted locally</p>
    </div>
  );
}

function PrivacyDemo() {
  return (
    <div className="flex flex-col items-center justify-center h-full w-full opacity-50 py-4">
      <Monitor size={32} className="text-white" strokeWidth={1.5} />
      <div className="mt-2 flex items-center gap-1">
        <div className="w-1.5 h-1.5 rounded-full bg-green-400/80" />
        <span className="text-[10px] text-white tracking-widest uppercase">Local</span>
      </div>
    </div>
  );
}

function HotkeyDemo() {
  return (
    <div className="flex items-center justify-center gap-2 py-6">
      <kbd className="h-8 px-2 flex items-center justify-center rounded border border-white/10 bg-white/5 text-xs text-white/70 font-mono shadow-sm">Ctrl</kbd>
      <span className="text-white/30">+</span>
      <kbd className="h-8 px-2 flex items-center justify-center rounded border border-white/10 bg-white/5 text-xs text-white/70 font-mono shadow-sm">Shift</kbd>
      <span className="text-white/30">+</span>
      <kbd className="h-8 px-2 flex items-center justify-center rounded border border-white/10 bg-white/5 text-xs text-white/70 font-mono shadow-sm">M</kbd>
    </div>
  );
}

const FEATURES: FeatureCard[] = [
  {
    id: "replies",
    icon: MessageSquare,
    title: "Three Tones",
    description: "Always get three options: Safe, Confident, and Playful. Choose what fits your style.",
    demo: <ReplyDemo />,
    colSpan: "lg:col-span-2",
  },
  {
    id: "ocr",
    icon: Eye,
    title: "Local Extraction",
    description: "Milo uses UI Automation and local OCR. Your screen pixels never leave your machine.",
    demo: <LocalOCRDemo />,
  },
  {
    id: "hotkey",
    icon: Zap,
    title: "Instant Hotkey",
    description: "Select your chat window and press Ctrl+Shift+M. No need to copy and paste.",
    demo: <HotkeyDemo />,
  },
  {
    id: "privacy",
    icon: Target,
    title: "Strictly Bounded",
    description: "Milo doesn't spy. It only reads the specific chat window you explicitly target.",
    demo: <PrivacyDemo />,
    colSpan: "lg:col-span-2",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="relative py-32 overflow-hidden border-t border-white/[0.04]">
      {/* Soft gradient background behind section */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#050505] to-transparent pointer-events-none" />

      <div className="relative mx-auto max-w-[1000px] px-5 sm:px-8">
        <div className="text-center mb-16 sm:mb-20">
          <motion.h2
            className="text-[28px] sm:text-[36px] font-bold tracking-tight text-white mb-4"
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ ease: [0.16, 1, 0.3, 1], duration: 0.6 }}
          >
            A companion you can trust.
          </motion.h2>
          <motion.p
            className="text-white/40 text-base sm:text-lg mx-auto max-w-[480px]"
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ ease: [0.16, 1, 0.3, 1], duration: 0.6, delay: 0.1 }}
          >
            Milo is designed with deep care for privacy and agency. No sweeping permissions, no cloud logs, no surprises.
          </motion.p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {FEATURES.map((feature, i) => (
            <motion.div
              key={feature.id}
              className={`${feature.colSpan || ""} ${feature.rowSpan || ""}`}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: i * 0.08, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <SpotlightCard className="h-full flex flex-col">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                    <feature.icon size={18} className="text-white/60" />
                  </div>
                  <h3 className="text-white/90 font-medium text-lg tracking-tight">
                    {feature.title}
                  </h3>
                </div>
                <div className="flex-1 mb-6">{feature.demo}</div>
                <p className="text-sm text-white/50 leading-relaxed max-w-[280px]">
                  {feature.description}
                </p>
              </SpotlightCard>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
