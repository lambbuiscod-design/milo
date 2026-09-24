"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SpotlightCard } from "../ui/spotlight-card";
import { MiloHeroCat } from "./milo-hero-cat";
import {
  Heart,
  MessageCircle,
  Briefcase,
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
    id: "dating",
    label: "Dating Apps",
    icon: Heart,
    mood: "celebrating",
    headline: "Stand out in the inbox.",
    items: [
      "Break the ice confidently",
      "Keep the conversation flowing naturally",
      "Match their tone with Playful mode",
      "Move from chat to a real date",
    ],
  },
  {
    id: "messaging",
    label: "Messaging Apps",
    icon: MessageCircle,
    mood: "happy",
    headline: "Never run out of things to say.",
    items: [
      "Respond to long, complex messages easily",
      "Keep group chats engaging",
      "Handle awkward pauses",
      "Reply quickly with Ctrl+Shift+M",
    ],
  },
  {
    id: "professional",
    label: "Tense Chats",
    icon: Briefcase,
    mood: "focused",
    headline: "Navigate difficult conversations safely.",
    items: [
      "De-escalate sensitive arguments",
      "Use Safe mode for neutral responses",
      "Set boundaries respectfully",
      "Keep emotions out of professional chats",
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
            Built for Connection
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
                  transition={{ duration: 0.3 }}
                  className="relative z-10"
                >
                  <div className="flex items-start justify-between gap-8">
                    <div>
                      <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-8">
                        {active.headline}
                      </h3>
                      <ul className="space-y-4">
                        {active.items.map((item, i) => (
                          <li key={i} className="flex items-start gap-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-white/20 mt-2.5 flex-shrink-0" />
                            <span className="text-white/60 text-[15px] leading-relaxed">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="hidden sm:block w-32 h-32 flex-shrink-0 opacity-80">
                      <MiloHeroCat mood={active.mood} />
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* Decorative background element */}
              <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-white/[0.02] rounded-full blur-3xl pointer-events-none" />
            </SpotlightCard>
          </motion.div>
          
        </div>
      </div>
    </section>
  );
}
