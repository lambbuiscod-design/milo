"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { SpotlightCard } from "../ui/spotlight-card";
import { MiloHeroCat } from "./milo-hero-cat";
import {
  MessageSquare,
  Sparkles,
  Zap,
  ChevronRight,
  X,
  Heart,
} from "lucide-react";

type MenuItem = {
  id: string;
  icon: React.ElementType;
  label: string;
  response: string;
  mood: "happy" | "curious" | "focused" | "celebrating";
};

const MENU_ITEMS: MenuItem[] = [
  {
    id: "safe",
    icon: MessageSquare,
    label: "Safe Reply",
    response: "\"That sounds like a great plan, I'm down!\"",
    mood: "happy",
  },
  {
    id: "confident",
    icon: Sparkles,
    label: "Confident Reply",
    response: "\"I know a great spot. Let's do Thursday at 7.\"",
    mood: "celebrating",
  },
  {
    id: "playful",
    icon: Zap,
    label: "Playful Reply",
    response: "\"Is that a promise or a threat? 😉\"",
    mood: "curious",
  },
];

export function DesktopDemoSection() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeResponse, setActiveResponse] = useState<MenuItem | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();

  function handleMenuSelect(item: MenuItem) {
    setActiveResponse(item);
    setMenuOpen(false);
  }

  const currentMood = activeResponse?.mood ?? (menuOpen ? "curious" : isDragging ? "celebrating" : "happy");

  return (
    <section id="demo" className="py-24 relative overflow-hidden border-t border-white/[0.04]">

      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        
        {/* Header */}
        <div className="text-center mb-16">
          <motion.p
            className="text-[11px] font-semibold text-white/30 tracking-[0.2em] uppercase mb-5"
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ ease: [0.16, 1, 0.3, 1] }}
          >
            Interactive Demo
          </motion.p>
          <motion.h2
            className="font-bold text-white tracking-[-0.04em]"
            style={{ fontSize: "clamp(2.5rem, 5.5vw, 4rem)", lineHeight: 1.08 }}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            Always there.<br />
            <span className="text-white/40">Never in the way.</span>
          </motion.h2>
        </div>

        {/* The Desktop Environment */}
        <motion.div
          ref={containerRef}
          className="relative max-w-5xl mx-auto rounded-[8px] overflow-hidden border border-white/[0.08]"
          style={{ height: "600px", boxShadow: "0 24px 60px rgba(0,0,0,0.4)" }}
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        >
          <SpotlightCard className="absolute inset-0 bg-[#0A0A0A] z-[-1]">
            <div />
          </SpotlightCard>
          
          {/* Windows-style Top Bar */}
          <div className="absolute top-0 left-0 right-0 h-8 bg-black/40 border-b border-white/[0.04] flex items-center justify-between px-3 z-0">
            <div className="text-[10px] text-white/30 font-medium">Windows 11</div>
            <div className="flex gap-4 items-center h-full">
              <div className="w-3 h-px bg-white/20" />
              <div className="w-2.5 h-2.5 border border-white/20" />
              <div className="w-3 h-3 flex items-center justify-center">
                <div className="w-full h-px bg-white/20 rotate-45 absolute" />
                <div className="w-full h-px bg-white/20 -rotate-45 absolute" />
              </div>
            </div>
          </div>

          {/* Fake Dating App Window */}
          <div className="absolute top-20 left-10 w-[60%] h-[400px] rounded-md border border-white/[0.06] bg-white/[0.02] shadow-2xl flex flex-col hidden md:flex overflow-hidden">
            <div className="flex items-center gap-2 border-b border-white/[0.04] p-4 bg-black/20">
              <Heart size={16} className="text-[#ffab91]" />
              <div className="text-[12px] font-medium text-white/70">Sarah, 26</div>
            </div>
            <div className="flex-1 p-6 flex flex-col gap-4">
              <div className="self-start bg-white/10 text-white/80 rounded-2xl rounded-tl-sm px-4 py-2 text-sm max-w-[80%]">
                Hey! How was your weekend?
              </div>
              <div className="self-end bg-[#ffab91]/20 text-[#ffab91] rounded-2xl rounded-tr-sm px-4 py-2 text-sm max-w-[80%]">
                It was pretty relaxed. Mostly just caught up on reading. You?
              </div>
              <div className="self-start bg-white/10 text-white/80 rounded-2xl rounded-tl-sm px-4 py-2 text-sm max-w-[80%]">
                Went hiking! Was super tiring but fun. We should definitely go sometime.
              </div>
            </div>
            <div className="p-4 border-t border-white/[0.04] bg-black/20 flex gap-2">
              <div className="h-8 flex-1 bg-white/5 rounded-full border border-white/10 flex items-center px-4">
                <span className="text-white/20 text-xs animate-pulse">Type a message...</span>
              </div>
            </div>
          </div>

          {/* Animated Hint Text */}
          <AnimatePresence>
            {!menuOpen && !activeResponse && !isDragging && (
              <motion.div
                className="absolute right-12 bottom-32 text-white/30 text-sm font-medium hidden md:block"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                Click or drag Milo
                <br/>
                <span className="text-xs text-white/20">(Try Ctrl+Shift+M)</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Milo Widget */}
          <motion.div
            className="absolute right-10 bottom-10 z-50 cursor-grab active:cursor-grabbing flex items-end justify-end"
            drag={!shouldReduceMotion}
            dragConstraints={containerRef}
            dragElastic={0.1}
            dragMomentum={false}
            onDragStart={() => setIsDragging(true)}
            onDragEnd={() => setIsDragging(false)}
            onClick={() => {
              if (!isDragging) {
                setMenuOpen(!menuOpen);
                setActiveResponse(null);
              }
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {/* Pop-out Response */}
            <AnimatePresence mode="wait">
              {activeResponse && !menuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
                  className="absolute bottom-[80px] right-0 w-[240px] bg-[#1a1b1e] border border-white/[0.08] rounded-2xl p-4 shadow-2xl origin-bottom-right"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => setActiveResponse(null)}
                    className="absolute top-3 right-3 text-white/30 hover:text-white/70 transition-colors"
                  >
                    <X size={14} />
                  </button>
                  <div className="flex items-center gap-2 mb-2 text-[#90caf9]">
                    <activeResponse.icon size={14} />
                    <span className="text-xs font-medium">{activeResponse.label}</span>
                  </div>
                  <p className="text-sm text-white/80 leading-relaxed">
                    {activeResponse.response}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button className="flex-1 text-[11px] font-medium bg-white/10 hover:bg-white/15 text-white/90 py-1.5 rounded transition-colors" onClick={() => setActiveResponse(null)}>
                      Copy
                    </button>
                    <button className="flex-1 text-[11px] font-medium bg-white/5 hover:bg-white/10 text-white/60 py-1.5 rounded transition-colors" onClick={() => setActiveResponse(null)}>
                      Dismiss
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Context Menu */}
            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
                  className="absolute bottom-[80px] right-0 w-[200px] bg-[#1a1b1e] border border-white/[0.08] rounded-xl p-1.5 shadow-2xl origin-bottom-right"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="px-2 py-1.5 border-b border-white/[0.04] mb-1">
                    <p className="text-[10px] text-white/40 font-medium uppercase tracking-wider">Reply Options</p>
                  </div>
                  {MENU_ITEMS.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleMenuSelect(item)}
                      className="w-full flex items-center justify-between px-2 py-2 rounded-lg hover:bg-white/[0.06] text-white/70 hover:text-white transition-colors group"
                    >
                      <div className="flex items-center gap-2.5">
                        <item.icon size={14} className="opacity-60 group-hover:opacity-100 transition-opacity" />
                        <span className="text-sm font-medium">{item.label}</span>
                      </div>
                      <ChevronRight size={14} className="opacity-0 group-hover:opacity-50 transition-opacity" />
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="w-16 h-16 sm:w-20 sm:h-20 drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)]">
              <MiloHeroCat mood={currentMood} />
            </div>
          </motion.div>

        </motion.div>
      </div>
    </section>
  );
}
