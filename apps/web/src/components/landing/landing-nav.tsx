"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MiloCat } from "@/components/milo-cat";
import { motion, useScroll, AnimatePresence } from "framer-motion";

const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#meet-milo", label: "Meet Milo" },
  { href: "#privacy", label: "Privacy" },
  { href: "#how-it-works", label: "How It Works" },
  { href: "#download", label: "Download" },
];

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { scrollY } = useScroll();

  useEffect(() => {
    const unsub = scrollY.on("change", (v) => setScrolled(v > 40));
    return unsub;
  }, [scrollY]);

  return (
    <>
      <motion.header
        className="fixed top-0 left-0 right-0 z-50"
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <div
          className="mx-auto max-w-7xl px-5 sm:px-8"
          style={{ paddingTop: "16px" }}
        >
          <div
            className="flex items-center justify-between rounded-2xl px-5 py-3 transition-all duration-500"
            style={{
              background: scrolled
                ? "rgba(10,14,20,0.85)"
                : "rgba(10,14,20,0.3)",
              backdropFilter: "blur(20px)",
              border: scrolled
                ? "1px solid rgba(52,211,153,0.15)"
                : "1px solid rgba(255,255,255,0.06)",
              boxShadow: scrolled
                ? "0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(52,211,153,0.08)"
                : "none",
            }}
          >
            {/* Logo */}
            <Link
              href="/"
              className="flex items-center gap-2.5 group"
              aria-label="Milo home"
            >
              <MiloCat className="h-9 w-9 transition-transform duration-300 group-hover:-rotate-6" />
              <span
                className="text-xl font-bold tracking-tight text-white"
                style={{ fontFamily: "var(--font-sans)" }}
              >
                Milo
              </span>
            </Link>

            {/* Desktop nav */}
            <nav
              className="hidden md:flex items-center gap-1"
              aria-label="Primary navigation"
            >
              {NAV_LINKS.map(({ href, label }) => (
                <a
                  key={href}
                  href={href}
                  className="px-4 py-2 text-sm font-medium text-white/60 rounded-lg transition-colors hover:text-white hover:bg-white/5"
                >
                  {label}
                </a>
              ))}
            </nav>

            {/* CTA */}
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="hidden sm:block text-sm font-medium text-white/50 hover:text-white transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="#download"
                className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-[#0a0e14] transition-all hover:scale-105 active:scale-95"
                style={{
                  background: "linear-gradient(135deg, #34d399, #10b981)",
                  boxShadow: "0 0 20px rgba(52,211,153,0.3)",
                }}
              >
                Get Milo
              </Link>

              {/* Mobile hamburger */}
              <button
                className="md:hidden flex flex-col gap-1.5 p-2"
                onClick={() => setMobileOpen(!mobileOpen)}
                aria-label="Toggle menu"
                aria-expanded={mobileOpen}
              >
                <motion.span
                  className="block h-0.5 w-5 bg-white rounded-full"
                  animate={mobileOpen ? { rotate: 45, y: 8 } : { rotate: 0, y: 0 }}
                  transition={{ duration: 0.2 }}
                />
                <motion.span
                  className="block h-0.5 w-5 bg-white rounded-full"
                  animate={mobileOpen ? { opacity: 0 } : { opacity: 1 }}
                  transition={{ duration: 0.2 }}
                />
                <motion.span
                  className="block h-0.5 w-5 bg-white rounded-full"
                  animate={mobileOpen ? { rotate: -45, y: -8 } : { rotate: 0, y: 0 }}
                  transition={{ duration: 0.2 }}
                />
              </button>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="fixed inset-0 z-40 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileOpen(false)}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />
            <motion.nav
              className="absolute top-24 left-5 right-5 rounded-2xl overflow-hidden"
              style={{ background: "rgba(10,14,20,0.95)", border: "1px solid rgba(52,211,153,0.15)" }}
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
            >
              {NAV_LINKS.map(({ href, label }) => (
                <a
                  key={href}
                  href={href}
                  className="flex items-center px-6 py-4 text-white/70 hover:text-white border-b border-white/5 last:border-0 transition-colors"
                  onClick={() => setMobileOpen(false)}
                >
                  {label}
                </a>
              ))}
              <div className="p-4">
                <Link
                  href="#download"
                  className="flex items-center justify-center w-full rounded-xl px-5 py-3 font-bold text-[#0a0e14]"
                  style={{ background: "linear-gradient(135deg, #34d399, #10b981)" }}
                  onClick={() => setMobileOpen(false)}
                >
                  Get Milo Free
                </Link>
              </div>
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
