"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { SpotlightCard } from "../ui/spotlight-card";
import { MiloHeroCat } from "./milo-hero-cat";
import {
  MessageSquare,
  Eye,
  PenLine,
  Timer,
  ChevronRight,
  X,
  Code2,
} from "lucide-react";

type MenuItem = {
  id: string;
  icon: React.ElementType;
  label: string;
  response: string;
  mood: "happy" | "curious" | "focused" | "celebrating";
};

// Pre-computed fake document content widths — module-level so render stays pure
const DOC_LINE_WIDTHS = [1, 0.7, 0.5, 0.8, 0.4, 0.6, 0.9, 0.55];
const BROWSER_LINE_WIDTHS = [0.9, 0.6, 0.75, 0.5];

const MENU_ITEMS: MenuItem[] = [
  {
    id: "explain",
    icon: Eye,
    label: "Explain this",
    response: "This defines an async function that fetches user data from an API, handles HTTP errors, and returns a typed response — clean and safe.",
    mood: "curious",
  },
  {
    id: "reply",
    icon: PenLine,
    label: "Write a reply",
    response: "\"Thanks for sharing — that's genuinely useful context. I'd love to dive deeper when you have a moment.\"",
    mood: "happy",
  },
  {
    id: "ask",
    icon: MessageSquare,
    label: "Ask Milo",
    response: "I'm here. What's on screen? What would you like to know or do?",
    mood: "curious",
  },
  {
    id: "focus",
    icon: Timer,
    label: "Start focus",
    response: "25-minute session starting now. Notifications paused. I'll keep watch — you just work.",
    mood: "focused",
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
          className="relative max-w-5xl mx-auto rounded-[24px] overflow-hidden"
          style={{ height: "600px", boxShadow: "0 24px 60px rgba(0,0,0,0.4)" }}
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        >
          <SpotlightCard className="absolute inset-0 bg-[#0A0A0A] !rounded-[24px] z-[-1]" />
          
          {/* macOS-style Top Bar */}
          <div className="absolute top-0 left-0 right-0 h-10 bg-white/[0.02] border-b border-white/[0.04] flex items-center px-4 gap-2 z-0">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-white/[0.15]" />
              <div className="w-3 h-3 rounded-full bg-white/[0.15]" />
              <div className="w-3 h-3 rounded-full bg-white/[0.15]" />
            </div>
          </div>

          {/* Fake IDE Window */}
          <div className="absolute top-20 left-10 w-[60%] h-[400px] rounded-xl border border-white/[0.06] bg-white/[0.02] shadow-2xl p-6 hidden md:block">
            <div className="flex items-center gap-2 mb-6 border-b border-white/[0.04] pb-4">
              <Code2 size={16} className="text-white/30" />
              <div className="text-[11px] font-mono text-white/30 uppercase tracking-widest">app.ts</div>
            </div>
            <div className="space-y-4">
              {DOC_LINE_WIDTHS.map((width, i) => (
                <div key={i} className="h-3 rounded-full bg-white/10" style={{ width: `${width * 100}%` }} />
              ))}
            </div>
          </div>

          {/* Fake Browser Window */}
          <div className="absolute top-32 right-10 w-[50%] h-[450px] rounded-xl border border-white/[0.06] bg-white/[0.01] backdrop-blur-md shadow-2xl p-6 hidden md:block">
            <div className="w-full h-8 rounded-md bg-white/[0.04] border border-white/[0.04] mb-6 flex items-center px-3">
              <div className="text-[10px] text-white/20 font-mono">localhost:3000</div>
            </div>
            <div className="space-y-4">
              {BROWSER_LINE_WIDTHS.map((width, i) => (
                <div key={i} className="h-4 rounded-md bg-white/5" style={{ width: `${width * 100}%` }} />
              ))}
            </div>
          </div>

          {/* Animated Hint Text */}
          <AnimatePresence>
            {!menuOpen && !activeResponse && !isDragging && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute top-[45%] left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 pointer-events-none"
              >
                <div className="px-4 py-2 rounded-full bg-white/[0.06] border border-white/[0.08] backdrop-blur-md">
                  <p className="text-sm font-medium text-white/70">
                    Try dragging Milo around
                  </p>
                </div>
                <div className="w-0.5 h-12 bg-gradient-to-b from-white/20 to-transparent" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Milo — Draggable Wrapper */}
          <motion.div
            drag
            dragConstraints={containerRef}
            dragElastic={0.1}
            dragMomentum={false}
            onDragStart={() => {
              setIsDragging(true);
              setMenuOpen(false);
              setActiveResponse(null);
            }}
            onDragEnd={() => setIsDragging(false)}
            initial={{ x: 200, y: 300 }}
            className="absolute z-50 flex items-end cursor-grab active:cursor-grabbing"
            style={{ touchAction: "none" }}
          >
            {/* Context Menu (pops out to the left) */}
            <AnimatePresence>
              {menuOpen && !activeResponse && (
                <motion.div
                  initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9, x: 20 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9, x: 20 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  className="absolute right-[90px] bottom-4 w-[240px] rounded-[16px] bg-[#121212]/95 backdrop-blur-xl border border-white/[0.08] p-1.5 shadow-2xl"
                >
                  <div className="px-3 py-2 border-b border-white/[0.06] mb-1">
                    <p className="text-[11px] font-semibold text-white/40 uppercase tracking-widest">
                      Context Actions
                    </p>
                  </div>
                  {MENU_ITEMS.map((item) => (
                    <button
                      key={item.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMenuSelect(item);
                      }}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-[10px] text-sm text-white/80 transition-colors hover:bg-white/[0.06] hover:text-white group"
                    >
                      <div className="flex items-center gap-3">
                        <item.icon size={16} className="text-white/40 group-hover:text-white/70" />
                        <span>{item.label}</span>
                      </div>
                      <ChevronRight size={14} className="text-white/20 group-hover:text-white/40" />
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Response Bubble (pops out above) */}
            <AnimatePresence>
              {activeResponse && (
                <motion.div
                  initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 10 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  className="absolute bottom-[90px] left-1/2 -translate-x-1/2 w-[280px] rounded-[16px] bg-[#121212]/95 backdrop-blur-xl border border-white/[0.08] p-4 shadow-2xl"
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveResponse(null);
                    }}
                    className="absolute top-3 right-3 p-1 rounded-full text-white/40 hover:bg-white/10 hover:text-white transition-colors"
                  >
                    <X size={14} />
                  </button>
                  <div className="flex items-center gap-2 mb-2 pr-6">
                    <activeResponse.icon size={14} className="text-white/60" />
                    <span className="text-[12px] font-medium text-white/80">{activeResponse.label}</span>
                  </div>
                  <p className="text-[13px] text-white/60 leading-relaxed">
                    {activeResponse.response}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Milo Interaction Target */}
            <div
              className="relative"
              onPointerDown={(e) => {
                if (activeResponse) {
                  setActiveResponse(null);
                } else if (!isDragging) {
                  setMenuOpen(!menuOpen);
                }
                e.stopPropagation();
              }}
            >
              {/* Key light on Milo */}
              <div
                className="absolute -top-4 left-1/2 -translate-x-1/2 pointer-events-none"
                style={{
                  width: 80,
                  height: 30,
                  background: "radial-gradient(ellipse, rgba(255,255,255,0.08) 0%, transparent 60%)",
                  filter: "blur(4px)",
                }}
              />

              <motion.div
                animate={isDragging ? { scale: 0.95, rotate: -5 } : { scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
              >
                <MiloHeroCat
                  mood={currentMood}
                  className="w-[80px] h-[80px] drop-shadow-xl"
                  style={{
                    filter: "drop-shadow(0 10px 20px rgba(0,0,0,0.6))",
                  }}
                />
              </motion.div>

              {/* Contact shadow */}
              <div
                className="absolute -bottom-2 left-1/2 -translate-x-1/2 pointer-events-none"
                style={{
                  width: 60,
                  height: 8,
                  background: "radial-gradient(ellipse, rgba(0,0,0,0.6) 0%, transparent 70%)",
                  filter: "blur(3px)",
                }}
              />
            </div>
          </motion.div>
        </motion.div>

        {/* Mobile notice */}
        <div className="mt-6 text-center md:hidden">
          <p className="text-sm text-white/40">Use a desktop device to experience the interactive demo.</p>
        </div>

      </div>
    </section>
  );
}
