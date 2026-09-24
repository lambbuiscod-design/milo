"use client";

import Link from "next/link";
import { MiloHeroCat } from "./milo-hero-cat";

const NAV_LINKS = [
  { href: "#features",    label: "Features" },
  { href: "#demo",        label: "Demo" },
  { href: "#privacy",     label: "Privacy" },
  { href: "#how-it-works",label: "How It Works" },
  { href: "#download",    label: "Download" },
];

const LEGAL_LINKS = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms",   label: "Terms of Use" },
];

export function LandingFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-white/[0.04]">
      
      {/* Subtle center glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none"
        aria-hidden="true"
        style={{
          width: 400,
          height: 120,
          background: "radial-gradient(ellipse, rgba(255,255,255,0.02) 0%, transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-5 sm:px-8 py-16">
        <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-10">

          {/* Brand */}
          <div className="flex flex-col items-center sm:items-start gap-4">
            <Link
              href="/"
              className="flex items-center gap-3 group"
              aria-label="Milo home"
            >
              <MiloHeroCat
                mood="happy"
                className="h-9 w-9 transition-transform duration-500 group-hover:scale-105"
              />
              <span className="text-lg font-bold text-white/80 group-hover:text-white transition-colors">
                Milo
              </span>
            </Link>
            <p className="text-[12px] text-white/30 max-w-[200px] text-center sm:text-left leading-relaxed font-medium">
              A private AI companion for your desktop.
            </p>
          </div>

          {/* Nav links */}
          <nav
            className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3"
            aria-label="Footer navigation"
          >
            {NAV_LINKS.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                className="text-[13px] font-medium text-white/40 hover:text-white transition-colors duration-200"
              >
                {label}
              </a>
            ))}
          </nav>

          {/* Legal */}
          <nav
            className="flex items-center gap-6"
            aria-label="Legal links"
          >
            {LEGAL_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="text-[12px] font-medium text-white/30 hover:text-white/70 transition-colors duration-200"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Bottom row */}
        <div className="mt-16 pt-8 border-t border-white/[0.04] flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[11px] font-medium text-white/20">
            &copy; {new Date().getFullYear()} Milo Inc. All rights reserved.
          </p>
          <p className="text-[11px] font-medium text-white/20">
            Designed with care.
          </p>
        </div>
      </div>
    </footer>
  );
}
