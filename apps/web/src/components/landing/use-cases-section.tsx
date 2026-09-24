"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SpotlightCard } from "../ui/spotlight-card";
import { MiloHeroCat } from "./milo-hero-cat";
import {
  GraduationCap,
  Code2,
  Palette,
  Coffee,
} from "lucide-react";

type UseCase = {
  id: string;
  label: string;
  icon: React.ElementType;
  mood: "curious" | "focused" | "happy" | "celebrating";
  headline: string;
  items: string[];
};

const USE_CASES: UseCase[] = [
  {
    id: "student",
    label: "Student",
    icon: GraduationCap,
    mood: "curious",
    headline: "Study smarter with Milo.",
    items: [
      "Summarize lecture notes instantly",
      "Explain complex concepts simply",
      "Set focus sessions with Pomodoro",
      "Track study goals and streaks",
    ],
  },
  {
    id: "developer",
    label: "Developer",
    icon: Code2,
    mood: "focused",
    headline: "Ship faster with Milo.",
    items: [
      "Debug errors with explanation",
      "Generate code snippets inline",
      "Understand unfamiliar code",
      "Draft commit messages and docs",
    ],
  },
  {
    id: "creator",
    label: "Creator",
    icon: Palette,
    mood: "happy",
    headline: "Create more with Milo.",
    items: [
      "Brainstorm ideas on demand",
      "Improve your writing tone",
      "Draft captions and copy",
      "Organize creative projects",
    ],
  },
  {
    id: "everyday",
    label: "Everyday",
    icon: Coffee,
    mood: "happy",
    headline: "Make every day easier.",
    items: [
      "Quick task and reminder tracking",
      "Help with messages and emails",
      "Daily focus and productivity",
      "Just someone to think out loud with",
    ],
  },
];

export function UseCasesSection() {
  const [active, setActive] = useState(USE_CASES[0]);

  return (
    <section id="use-cases" className="py-32 relative overflow-hidden border-t border-white/[0.04]">
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
            Built for Everyone
          </motion.p>
          <motion.h2
            className="font-bold text-white tracking-[-0.04em]"
            style={{ fontSize: "clamp(2.5rem, 5.5vw, 4rem)", lineHeight: 1.08 }}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            Who is Milo for?
          </motion.h2>
        </div>

        <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-12 lg:gap-20">
          
          {/* Tabs */}
          <motion.div
            className="flex md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-4 md:pb-0 hide-scrollbar flex-shrink-0 md:w-48"
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            {USE_CASES.map((uc) => {
              const isActive = active.id === uc.id;
              return (
                <button
                  key={uc.id}
                  onClick={() => setActive(uc)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-[12px] transition-all whitespace-nowrap md:whitespace-normal ${
                    isActive 
                      ? "bg-white/[0.06] border border-white/[0.1] text-white" 
                      : "bg-transparent border border-transparent text-white/40 hover:text-white/70 hover:bg-white/[0.02]"
                  }`}
                >
                  <uc.icon size={16} />
                  <span className="text-[14px] font-medium tracking-tight">{uc.label}</span>
                </button>
              );
            })}
          </motion.div>

          {/* Content Area */}
          <motion.div
            className="flex-1 relative"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <SpotlightCard className="h-full p-8 md:p-12 overflow-hidden shadow-2xl bg-[#0A0A0A] !rounded-[24px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={active.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.4 }}
                  className="grid sm:grid-cols-2 gap-10 items-center h-full"
                >
                  <div>
                    <h3 className="text-2xl font-bold text-white tracking-tight mb-6">{active.headline}</h3>
                    <ul className="space-y-4">
                      {active.items.map((item, i) => (
                        <motion.li
                          key={i}
                          className="flex items-start gap-3"
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.1 }}
                        >
                          <div className="mt-1 flex-shrink-0 w-4 h-4 rounded-full border border-white/20 flex items-center justify-center">
                            <div className="w-1.5 h-1.5 rounded-full bg-white/60" />
                          </div>
                          <span className="text-sm text-white/60 leading-relaxed">{item}</span>
                        </motion.li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex justify-center sm:justify-end relative">
                    <div
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full pointer-events-none"
                      style={{ background: "radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 60%)" }}
                    />
                    <MiloHeroCat mood={active.mood} className="w-[160px] h-[160px] relative z-10 drop-shadow-2xl" />
                  </div>
                </motion.div>
              </AnimatePresence>
            </SpotlightCard>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
