"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { SpotlightCard } from "../ui/spotlight-card";
import {
  MessageSquare,
  Eye,
  PenLine,
  Code2,
  Timer,
  Mic,
  Monitor,
  Target,
  Zap,
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

function TimerDemo() {
  const [seconds, setSeconds] = useState(0);
  const total = 25 * 60;
  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => (s + 1) % total), 100);
    return () => clearInterval(id);
  }, [total]);
  const pct = (seconds / total) * 100;
  const mins = Math.floor(((total - seconds) % 3600) / 60);
  const secs = (total - seconds) % 60;
  return (
    <div className="flex flex-col items-center gap-3 py-2">
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
        <circle
          cx="40" cy="40" r="34"
          fill="none"
          stroke="rgba(255,255,255,0.6)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${2 * Math.PI * 34}`}
          strokeDashoffset={`${2 * Math.PI * 34 * (1 - pct / 100)}`}
          style={{ transformOrigin: "40px 40px", transform: "rotate(-90deg)", transition: "stroke-dashoffset 0.1s linear" }}
        />
        <text x="40" y="44" textAnchor="middle" fontSize="13" fontWeight="500" fill="white">
          {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
        </text>
      </svg>
      <p className="text-xs text-white/40">Focus session</p>
    </div>
  );
}

// Pre-computed bar heights
const WAVEFORM_HEIGHTS = [12, 28, 18, 34, 10, 24, 36, 14, 30, 20, 32, 16, 26, 8, 22, 36, 12, 28];

function WaveformDemo() {
  return (
    <div className="flex items-center gap-[3px] py-4">
      {WAVEFORM_HEIGHTS.map((h, i) => (
        <div
          key={i}
          className="rounded-full bg-white"
          style={{
            width: 3,
            height: `${h}px`,
            animation: `waveBar 0.8s ${i * 0.05}s ease-in-out infinite alternate`,
            opacity: 0.3 + (i % 3) * 0.2,
          }}
        />
      ))}
    </div>
  );
}

function XPBarDemo() {
  const [xp, setXp] = useState(60);
  useEffect(() => {
    const id = setInterval(() => setXp((x) => (x >= 95 ? 60 : x + 0.8)), 80);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="w-full py-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-white/50">Level 4</span>
        <span className="text-xs text-white/80 font-medium">{Math.round(xp)}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-100"
          style={{
            width: `${xp}%`,
            background: "rgba(255,255,255,0.7)",
          }}
        />
      </div>
      <div className="flex items-center gap-1 mt-3">
        <Zap size={11} className="text-white/40" />
        <span className="text-[10px] text-white/40">+50 XP Task completed</span>
      </div>
    </div>
  );
}

function ExplainDemo() {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setPhase((p) => (p + 1) % 3), 2000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="space-y-2 py-1 text-xs">
      <p className="text-white/30 line-through decoration-white/20">{phase >= 1 ? "selected text..." : ""}</p>
      <div
        className="rounded-[10px] p-3"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
          opacity: phase === 2 ? 1 : 0.3,
          transition: "opacity 0.4s",
        }}
      >
        <p className="text-white/70 font-medium mb-1">Milo explains:</p>
        <p className="text-white/40">This means the process runs asynchronously, returning a Promise.</p>
      </div>
    </div>
  );
}

const FEATURES: FeatureCard[] = [
  {
    id: "ask",
    icon: MessageSquare,
    title: "Ask Milo",
    description: "Ask anything. Get a smart, private response in seconds.",
    demo: (
      <div className="space-y-2 text-xs">
        <div className="rounded-[10px] p-3 text-right" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.03)" }}>
          <p className="text-white/70">What does this error mean?</p>
        </div>
        <div className="rounded-[10px] p-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-white/40">It&apos;s a null reference. Try checking if the variable is defined first...</p>
        </div>
      </div>
    ),
    colSpan: "lg:col-span-2",
  },
  {
    id: "explain",
    icon: Eye,
    title: "Explain This",
    description: "Highlight anything on screen and Milo breaks it down.",
    demo: <ExplainDemo />,
  },
  {
    id: "focus",
    icon: Timer,
    title: "Focus Mode",
    description: "Pomodoro timer with Milo keeping guard.",
    demo: <TimerDemo />,
  },
  {
    id: "voice",
    icon: Mic,
    title: "Voice",
    description: "Talk to Milo naturally, hands-free.",
    demo: <WaveformDemo />,
  },
  {
    id: "write",
    icon: PenLine,
    title: "Write a Reply",
    description: "Milo drafts a message in your voice.",
    demo: (
      <div className="text-xs space-y-2">
        <div className="rounded-[10px] p-2.5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
          <p className="text-white/30 text-[10px] mb-1 uppercase tracking-wider">Their message</p>
          <p className="text-white/60">So what time works for you?</p>
        </div>
        <div className="rounded-[10px] p-2.5" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <p className="text-white/50 text-[10px] mb-1 uppercase tracking-wider">Milo suggests</p>
          <p className="text-white/80">How about 3pm? I&apos;m free after 2.</p>
        </div>
      </div>
    ),
  },
  {
    id: "code",
    icon: Code2,
    title: "Coding Help",
    description: "Debug, explain, or generate code snippets inline.",
    demo: (
      <div className="rounded-[10px] p-3 font-mono text-[10px]" style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <span className="text-white/50">const</span>{" "}
        <span className="text-white/80">greet</span>{" "}
        <span className="text-white/40">=</span>{" "}
        <span className="text-white/60">(name)</span>{" "}
        <span className="text-white/40">={">"}</span>{" "}
        <span className="text-white/70">{"`Hello ${name}!`"}</span>
        <div className="mt-2 text-white/30">{"// ✓ Looks good!"}</div>
      </div>
    ),
    colSpan: "lg:col-span-2",
  },
  {
    id: "xp",
    icon: Zap,
    title: "XP & Streaks",
    description: "Earn XP as you work. Build daily streaks.",
    demo: (
      <div className="space-y-4 pt-1">
        <XPBarDemo />
      </div>
    ),
    colSpan: "lg:col-span-2",
  },
  {
    id: "screen",
    icon: Monitor,
    title: "Screen Context",
    description: "When you ask, Milo understands what&apos;s on screen.",
    demo: (
      <div className="space-y-2 text-xs pt-1">
        <div className="flex items-center gap-2.5">
          <div className="h-1 w-1 rounded-full bg-white/40" />
          <span className="text-white/40">Only when you ask</span>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="h-1 w-1 rounded-full bg-white/40" />
          <span className="text-white/40">Never stored remotely</span>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="h-1 w-1 rounded-full bg-white/40" />
          <span className="text-white/40">You stay in control</span>
        </div>
      </div>
    ),
  },
  {
    id: "goals",
    icon: Target,
    title: "Goals & Tasks",
    description: "Track what matters with Milo&apos;s gentle reminders.",
    demo: (
      <div className="space-y-2.5 text-xs pt-1">
        {["Finish project brief", "Exercise 20 min", "Read chapter 4"].map((task, i) => (
          <div key={task} className="flex items-center gap-2.5">
            <div
              className="h-3.5 w-3.5 rounded flex items-center justify-center text-[8px]"
              style={{
                background: i < 2 ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#ffffff",
              }}
            >
              {i < 2 ? "✓" : ""}
            </div>
            <span className={i < 2 ? "text-white/30 line-through" : "text-white/60"}>{task}</span>
          </div>
        ))}
      </div>
    ),
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-24 relative border-t border-white/[0.04]">
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
            Capabilities
          </motion.p>
          <motion.h2
            className="font-bold text-white tracking-[-0.04em]"
            style={{ fontSize: "clamp(2.5rem, 5.5vw, 4rem)", lineHeight: 1.08 }}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            Everything you need.<br />
            <span className="text-white/40">Nothing you don&apos;t.</span>
          </motion.h2>
        </div>

        {/* Bento grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto group/bento">
          {FEATURES.map((card, i) => (
            <motion.div
              key={card.id}
              className={`relative ${card.colSpan ?? ""} ${card.rowSpan ?? ""}`}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: i * 0.05, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <SpotlightCard className="h-full p-6 bg-white/[0.01] hover:bg-white/[0.02] transition-colors border-white/[0.06] hover:border-white/[0.12]">
                {/* Icon */}
                <div className="mb-4">
                  <card.icon size={18} className="text-white/70" strokeWidth={2} />
                </div>

                <h3 className="text-[14px] font-medium text-white/90 mb-1 tracking-tight">{card.title}</h3>
                <p
                  className="text-[13px] text-white/40 mb-6 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: card.description }}
                />

                {/* Live demo area */}
                <div className="relative z-10">{card.demo}</div>
              </SpotlightCard>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
