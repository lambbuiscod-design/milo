"use client";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { MiloHeroCat } from "./milo-hero-cat";

type RoomTheme = {
  id: string;
  label: string;
  emoji: string;
  bg: string;
  wallGlow: string;
  floor: string;
  baseboard: string;
  accent: string;
  description: string;
};

const ROOM_THEMES: RoomTheme[] = [
  {
    id: "cozy",
    label: "Cozy Corner",
    emoji: "🕯️",
    bg: "radial-gradient(ellipse at 50% 0%, rgba(255,180,100,0.06) 0%, transparent 100%)",
    wallGlow: "rgba(255,180,100,0.08)",
    floor: "rgba(255,180,100,0.02)",
    baseboard: "rgba(255,180,100,0.1)",
    accent: "rgba(255,180,100,0.8)",
    description: "Warm amber light, soft textures. For late evening focus.",
  },
  {
    id: "studio",
    label: "Night Studio",
    emoji: "🖥️",
    bg: "radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.05) 0%, transparent 100%)",
    wallGlow: "rgba(255,255,255,0.04)",
    floor: "rgba(255,255,255,0.01)",
    baseboard: "rgba(255,255,255,0.08)",
    accent: "rgba(255,255,255,0.8)",
    description: "Clean lines, cool glow, a focused developer's space.",
  },
  {
    id: "garden",
    label: "Zen Garden",
    emoji: "🌿",
    bg: "radial-gradient(ellipse at 50% 0%, rgba(150,255,150,0.04) 0%, transparent 100%)",
    wallGlow: "rgba(150,255,150,0.05)",
    floor: "rgba(150,255,150,0.02)",
    baseboard: "rgba(150,255,150,0.1)",
    accent: "rgba(150,255,150,0.7)",
    description: "Soft greens, calm, open. Designed for deep thinking.",
  },
];

type FurniturePiece = {
  id: string;
  label: string;
  emoji: string;
  defaultOn: boolean;
  style: React.CSSProperties;
};

const FURNITURE: FurniturePiece[] = [
  { id: "plant", label: "Plant",      emoji: "🪴", defaultOn: true,  style: { bottom: 54, right: "14%", fontSize: 38 } },
  { id: "lamp",  label: "Lamp",       emoji: "🪔", defaultOn: true,  style: { bottom: 118, left: "22%", fontSize: 26 } },
  { id: "desk",  label: "Chair",      emoji: "🪑", defaultOn: true,  style: { bottom: 54, left: "10%", fontSize: 34 } },
  { id: "shelf", label: "Books",      emoji: "📚", defaultOn: false, style: { bottom: 78, right: "28%", fontSize: 30 } },
  { id: "cup",   label: "Coffee",     emoji: "☕", defaultOn: false, style: { bottom: 118, right: "18%", fontSize: 20 } },
  { id: "rug",   label: "Rug",        emoji: "🟫", defaultOn: false, style: { bottom: 42, left: "28%", fontSize: 52, opacity: 0.4 } },
];

export function MilosRoomSection() {
  const [activeTheme, setActiveTheme] = useState(ROOM_THEMES[1]);
  const [visibleFurniture, setVisibleFurniture] = useState<Set<string>>(
    new Set(FURNITURE.filter((f) => f.defaultOn).map((f) => f.id))
  );
  const shouldReduceMotion = useReducedMotion();

  function toggleFurniture(id: string) {
    setVisibleFurniture((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <section id="room" className="py-24 relative overflow-hidden border-t border-white/[0.04]">
      
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="text-center mb-16">
          <motion.p
            className="text-[11px] font-semibold text-white/30 tracking-[0.2em] uppercase mb-5"
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ ease: [0.16, 1, 0.3, 1] }}
          >
            Your Space
          </motion.p>
          <motion.h2
            className="font-bold text-white tracking-[-0.04em]"
            style={{ fontSize: "clamp(2.5rem, 5.5vw, 4rem)", lineHeight: 1.08 }}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            Make it yours.<br />
            <span className="text-white/40">Customize Milo's environment.</span>
          </motion.h2>
        </div>

        <div className="grid lg:grid-cols-12 gap-8 max-w-6xl mx-auto">
          
          {/* THE ROOM VIEWPORT */}
          <motion.div
            className="lg:col-span-8 relative rounded-[24px] overflow-hidden border border-white/[0.08] bg-[#0A0A0A] shadow-2xl h-[400px] sm:h-[480px]"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <AnimatePresence>
              <motion.div
                key={activeTheme.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8 }}
                className="absolute inset-0 z-0 pointer-events-none"
                style={{ background: activeTheme.bg }}
              />
            </AnimatePresence>

            <div className="absolute inset-0 z-10 flex flex-col justify-end pointer-events-none">
              <motion.div
                className="relative w-full h-[140px] border-t"
                animate={{ backgroundColor: activeTheme.floor, borderColor: activeTheme.baseboard }}
                transition={{ duration: 0.8 }}
              >
                <div className="absolute top-10 left-1/2 -translate-x-1/2">
                  <div
                    className="absolute -top-[140px] left-1/2 -translate-x-1/2 w-[240px] h-[160px] rounded-full blur-[40px]"
                    style={{ background: activeTheme.wallGlow }}
                  />

                  <motion.div
                    initial={{ y: 0 }}
                    animate={shouldReduceMotion ? { y: 0 } : { y: [-4, 4, -4] }}
                    transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                    className="relative z-20"
                  >
                    <MiloHeroCat mood="sleepy" className="w-[120px] h-[120px]" />
                  </motion.div>

                  <div
                    className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[90px] h-[12px] rounded-full blur-[6px] z-10"
                    style={{ background: "rgba(0,0,0,0.6)" }}
                  />
                </div>

                <AnimatePresence>
                  {FURNITURE.map((item) =>
                    visibleFurniture.has(item.id) ? (
                      <motion.div
                        key={item.id}
                        initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.5, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.5, y: 20 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        className="absolute z-15 select-none"
                        style={item.style}
                      >
                        {item.emoji}
                      </motion.div>
                    ) : null
                  )}
                </AnimatePresence>
              </motion.div>
            </div>
          </motion.div>

          {/* CONTROLS */}
          <motion.div
            className="lg:col-span-4 flex flex-col gap-6"
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Theme Selector */}
            <div className="rounded-[20px] bg-white/[0.02] border border-white/[0.06] p-6">
              <h3 className="text-sm font-semibold text-white/90 mb-4">Lighting</h3>
              <div className="flex flex-col gap-2">
                {ROOM_THEMES.map((theme) => {
                  const active = activeTheme.id === theme.id;
                  return (
                    <button
                      key={theme.id}
                      onClick={() => setActiveTheme(theme)}
                      className="flex items-center justify-between px-4 py-3 rounded-[12px] transition-colors text-left"
                      style={{
                        background: active ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.02)",
                        border: active ? "1px solid rgba(255,255,255,0.1)" : "1px solid transparent",
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{theme.emoji}</span>
                        <span className="text-[13px] font-medium" style={{ color: active ? "#fff" : "rgba(255,255,255,0.5)" }}>
                          {theme.label}
                        </span>
                      </div>
                      {active && <div className="w-1.5 h-1.5 rounded-full bg-white/80" />}
                    </button>
                  );
                })}
              </div>
              <p className="mt-5 text-[12px] text-white/40 leading-relaxed min-h-[40px]">
                {activeTheme.description}
              </p>
            </div>

            {/* Furniture Toggles */}
            <div className="rounded-[20px] bg-white/[0.02] border border-white/[0.06] p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white/90">Decor</h3>
                <span className="text-[10px] uppercase tracking-wider text-white/30 font-semibold bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                  {visibleFurniture.size} / {FURNITURE.length}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {FURNITURE.map((item) => {
                  const on = visibleFurniture.has(item.id);
                  return (
                    <button
                      key={item.id}
                      onClick={() => toggleFurniture(item.id)}
                      className="flex items-center gap-2 px-3 py-2 rounded-[10px] transition-colors border"
                      style={{
                        background: on ? "rgba(255,255,255,0.06)" : "transparent",
                        borderColor: on ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.04)",
                      }}
                      aria-pressed={on}
                    >
                      <span className="text-sm opacity-80 grayscale">{item.emoji}</span>
                      <span
                        className="text-[12px] font-medium transition-colors"
                        style={{ color: on ? "#fff" : "rgba(255,255,255,0.4)" }}
                      >
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
