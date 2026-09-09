import Link from "next/link";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Copy,
  EyeOff,
  HeartHandshake,
  ImageUp,
  LockKeyhole,
  MessageCircleHeart,
  PencilLine,
  ShieldCheck,
  Star,
  WandSparkles,
  Zap,
} from "lucide-react";
import { MiloCat } from "@/components/milo-cat";
import { SiteHeader } from "@/components/site-header";
import { MultilingualShowcase } from "@/components/multilingual-showcase";
import { TiltCard } from "@/components/tilt-card";

/* -------------------------------------------------------------------------- */
const steps = [
  { icon: ImageUp,      step: "01", title: "Add the conversation", text: "Choose a screenshot from your phone. Add context only when it helps." },
  { icon: WandSparkles, step: "02", title: "Set the right energy",  text: "Pick warm, confident, playful or direct. Milo reads only what you submit." },
  { icon: PencilLine,   step: "03", title: "Make it yours",         text: "Compare three honest suggestions, edit your favourite, then copy it when ready." },
];

const faqs: [string, string][] = [
  ["Does Milo send messages for me?",    "Never. Milo only suggests editable replies. You decide what to copy and send."],
  ["Do you keep my screenshots?",        "No. Screenshots are sanitized in memory, analyzed, and discarded after the request."],
  ["Can Milo manipulate someone for me?","No. Milo is designed for clear, respectful communication and blocks coercive requests."],
  ["What happens after my free analyses?","Five successful analyses are free. Milo Plus is €5.99/month for up to 150 analyses."],
];

const trustItems = [
  { icon: EyeOff,        title: "No screenshot history", text: "Your image is discarded after processing." },
  { icon: PencilLine,    title: "You stay in control",   text: "Every suggestion is editable. Nothing sends automatically." },
  { icon: HeartHandshake,title: "Respect built in",      text: "Milo avoids pressure, coercion and invented claims." },
];

const stats = [
  { value: "10 k+", label: "Replies crafted" },
  { value: "4.9 ★", label: "User satisfaction" },
  { value: "0",     label: "Screenshots stored" },
  { value: "3",     label: "Tones per reply" },
];
/* -------------------------------------------------------------------------- */

export default function Home() {
  return (
    <main className="overflow-x-hidden outline-none" id="main-content" tabIndex={-1}>
      <SiteHeader />

      {/* ================================================================
          HERO — 3D Layered Editorial
          ================================================================ */}
      <section className="relative overflow-hidden">

        {/* Ambient depth orbs */}
        <div className="orb orb-warm orb-drift pointer-events-none" style={{ width: 700, height: 700, top: -200, right: -200, opacity: 0.9 }} aria-hidden="true" />
        <div className="orb orb-cool orb-drift pointer-events-none" style={{ width: 500, height: 500, top: 100, left: -150, animationDelay: "4s", opacity: 0.8 }} aria-hidden="true" />

        {/* Fine editorial grid */}
        <div className="premium-grid pointer-events-none absolute inset-0 -z-10 opacity-50" aria-hidden="true" />

        <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 pb-24 pt-14 sm:px-8 sm:pt-22 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16 lg:pb-32 lg:pt-28">

          {/* — Copy — */}
          <div className="relative z-10 max-w-2xl">

            {/* Kicker */}
            <span className="editorial-kicker">Thoughtful replies, still in your voice</span>

            {/* Headline with 3D text layering via text-shadow */}
            <h1
              className="font-display mt-5 text-[2.75rem] font-semibold leading-[1.06] tracking-[-0.03em] sm:text-6xl lg:text-[4.25rem]"
              style={{ textShadow: "0 2px 0 rgba(28,24,18,0.05), 0 4px 12px rgba(28,24,18,0.06)" }}
            >
              Never stare at the{" "}
              <span className="relative inline-block text-[var(--brand)]">
                reply box
                {/* Animated underline accent */}
                <span
                  className="absolute -bottom-1 left-0 h-[3px] w-full rounded-full"
                  style={{
                    background: "var(--accent)",
                    animation: "accent-pulse 3s ease-in-out infinite",
                  }}
                  aria-hidden="true"
                />
              </span>{" "}
              again.
            </h1>

            <p className="mt-6 max-w-xl text-[1.0625rem] leading-[1.8] text-[var(--muted)]">
              Upload a dating-chat screenshot and get three natural ways to respond — clear enough to move things forward, flexible enough to sound like you.
            </p>

            {/* CTAs */}
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                className="btn btn-primary premium-button inline-flex min-h-[3.25rem] items-center justify-center gap-2 rounded-full px-8 text-sm font-bold text-white"
                href="/login?next=/dashboard"
              >
                <span>Try 5 analyses free</span>
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link
                className="outline-button inline-flex min-h-[3.25rem] items-center justify-center gap-2 rounded-full px-7 text-sm font-semibold text-[var(--foreground)]"
                href="/demo"
              >
                <MessageCircleHeart size={16} aria-hidden="true" />
                <span>See a live example</span>
              </Link>
            </div>

            {/* Trust micro-badges */}
            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-[var(--muted)]">
              {["No card required", "18+ only", "Nothing sends automatically"].map((item) => (
                <span className="flex items-center gap-1.5" key={item}>
                  <Check className="text-[var(--success)]" size={13} aria-hidden="true" />
                  {item}
                </span>
              ))}
            </div>
          </div>

          {/* — 3D Hero Card — */}
          <div className="relative mx-auto w-full max-w-[32rem] lg:max-w-none">

            {/* Decorative offset layer behind card (3D shadow plane) */}
            <div
              className="absolute inset-0 rounded-sm border border-[var(--line)] bg-[var(--surface-soft)]"
              style={{ transform: "translate(10px, 10px)", zIndex: 0 }}
              aria-hidden="true"
            />
            <div
              className="absolute inset-0 rounded-sm border border-[var(--line)] bg-[var(--surface-raised)] opacity-50"
              style={{ transform: "translate(20px, 20px)", zIndex: -1 }}
              aria-hidden="true"
            />

            <TiltCard className="hero-card relative z-10" intensity={10}>
              {/* Card header */}
              <div className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--surface-soft)] px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-sm bg-[var(--brand-soft)] text-[var(--brand)]">
                    <MessageCircleHeart size={17} aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">New match</p>
                    <p className="text-[11px] text-[var(--muted)]">Playful · early dating</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full border border-[var(--success)]/40 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-[var(--success)] dark:bg-emerald-950/40">
                  <LockKeyhole size={9} aria-hidden="true" /> Private
                </span>
              </div>

              {/* Transcript */}
              <div className="bg-gradient-to-b from-[var(--surface)] to-[var(--surface-soft)] p-5 sm:p-6">
                <div className="space-y-3 text-sm leading-6">

                  {/* Received bubble */}
                  <div className="mr-10 max-w-[85%] rounded-sm border border-[var(--line)] bg-[var(--surface)] px-4 py-3" style={{ boxShadow: "var(--shadow-sm)" }}>
                    <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">Their message</p>
                    <p className="font-display mt-1 italic text-[var(--foreground)]">
                      I had fun tonight. Thanks for showing me that place.
                    </p>
                  </div>

                  {/* Sent bubble */}
                  <div className="ml-auto max-w-[85%] rounded-sm bg-[var(--brand-fill)] px-4 py-3 text-white" style={{ boxShadow: "0 4px 14px rgba(44,50,73,0.32)" }}>
                    <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/55">Your message</p>
                    <p className="mt-1">Me too! I was hoping you&apos;d say that.</p>
                  </div>

                  {/* Received bubble */}
                  <div className="mr-10 max-w-[85%] rounded-sm border border-[var(--line)] bg-[var(--surface)] px-4 py-3" style={{ boxShadow: "var(--shadow-sm)" }}>
                    <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">Their message</p>
                    <p className="font-display mt-1 italic">So… should we do it again?</p>
                  </div>
                </div>

                {/* Suggestion — 3D depth inset card */}
                <div
                  className="relative mt-5 overflow-hidden rounded-sm border border-[var(--line)] bg-[var(--surface)]"
                  style={{ borderTopColor: "var(--brand)", borderTopWidth: "3px", boxShadow: "var(--shadow-md), 0 0 0 1px rgba(255,255,255,0.5) inset" }}
                >
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-[var(--brand)]">Confident choice</span>
                      <ShieldCheck size={14} className="text-[var(--brand)]" aria-hidden="true" />
                    </div>
                    <p className="font-display mt-2.5 text-[1rem] font-medium leading-[1.55]">
                      &ldquo;Definitely. I know a place you&apos;ll love — free Thursday?&rdquo;
                    </p>
                    <div className="mt-3 flex items-center justify-between border-t border-[var(--line)] pt-2.5 text-[11px] text-[var(--muted)]">
                      <span>Clear, specific, low pressure</span>
                      <span className="flex items-center gap-1 font-bold text-[var(--brand)]">
                        <Copy size={11} aria-hidden="true" /> Copy
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </TiltCard>

            {/* Floating privacy badge */}
            <div
              className="absolute -bottom-5 left-3 z-20 flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-xs font-bold"
              style={{ boxShadow: "var(--shadow-sm)" }}
            >
              <ShieldCheck className="text-[var(--success)]" size={14} aria-hidden="true" />
              <span>Deleted after analysis</span>
            </div>

            {/* Milo cat */}
            <MiloCat className="milo-settle absolute -bottom-[4.5rem] -right-3 z-20 h-28 w-28 drop-shadow-xl sm:-right-8 sm:h-36 sm:w-36" />
          </div>
        </div>

        {/* ─ Trust strip (spans full width under hero) ─ */}
        <div className="mx-auto max-w-7xl px-5 pb-16 sm:px-8 lg:pb-20">
          <div className="overflow-hidden rounded-sm border border-[var(--line)] bg-[var(--surface)]" style={{ boxShadow: "var(--shadow-sm)" }}>
            <div className="grid sm:grid-cols-3">
              {trustItems.map(({ icon: Icon, title, text }, i) => (
                <div key={title} className={`flex gap-4 p-5 sm:p-6 ${i > 0 ? "border-t border-[var(--line)] sm:border-l sm:border-t-0" : ""}`}>
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-sm bg-[var(--brand-soft)] text-[var(--brand)]">
                    <Icon size={17} aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-semibold">{title}</p>
                    <p className="mt-1 text-xs leading-5 text-[var(--muted)] sm:text-sm">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================
          STATS STRIP — social proof numbers
          ================================================================ */}
      <div className="border-y border-[var(--line)] bg-[var(--brand-fill)]">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-0 px-5 py-5">
          {stats.map(({ value, label }, i) => (
            <div key={label} className="flex items-center">
              <div className="px-8 py-2 text-center">
                <p className="font-display text-2xl font-semibold text-white sm:text-3xl">{value}</p>
                <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-widest text-white/55">{label}</p>
              </div>
              {i < stats.length - 1 && (
                <div className="h-8 w-px bg-white/20 self-center" aria-hidden="true" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ================================================================
          HOW IT WORKS — 3D tilt step cards
          ================================================================ */}
      <section className="border-b border-[var(--line)] bg-[var(--surface)] py-20 lg:py-28" id="how-it-works">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="max-w-2xl">
            <span className="editorial-kicker">A calmer way to reply</span>
            <h2 className="font-display mt-4 text-3xl font-semibold leading-[1.1] tracking-[-0.025em] sm:text-[2.75rem]">
              From screenshot to something worth sending.
            </h2>
            <p className="mt-4 text-base leading-7 text-[var(--muted)] sm:text-lg">
              Milo helps with the blank page. The judgment, personality and final send always stay with you.
            </p>
          </div>

          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {steps.map(({ icon: Icon, step, title, text }) => (
              <TiltCard
                key={title}
                className="depth-card rounded-sm p-7 sm:p-8"
                intensity={12}
              >
                <div className="flex items-start justify-between">
                  <div className="depth-layer grid h-11 w-11 place-items-center rounded-sm bg-[var(--brand-soft)] text-[var(--brand)]">
                    <Icon size={20} aria-hidden="true" />
                  </div>
                  <span className="font-display text-5xl font-light text-[var(--brand)]/12 select-none">{step}</span>
                </div>
                <h3 className="depth-layer mt-6 text-lg font-semibold">{title}</h3>
                <p className="mt-2.5 text-sm leading-6 text-[var(--muted)]">{text}</p>
              </TiltCard>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          TONE SHOWCASE (English)
          ================================================================ */}
      <MultilingualShowcase />

      {/* ================================================================
          FEATURE CALLOUT ROW — quick feature icons
          ================================================================ */}
      <div className="border-y border-[var(--line)] bg-[var(--surface-soft)]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-6 px-5 py-8 sm:gap-10">
          {[
            { icon: Zap,          text: "Instant suggestions" },
            { icon: ShieldCheck,  text: "Privacy-first by design" },
            { icon: PencilLine,   text: "Always editable" },
            { icon: Star,         text: "No filler responses" },
            { icon: LockKeyhole,  text: "Zero data retention" },
          ].map(({ icon: Icon, text }) => (
            <span key={text} className="flex items-center gap-2 text-sm font-medium text-[var(--muted-strong)]">
              <Icon size={15} className="text-[var(--accent)]" aria-hidden="true" />
              {text}
            </span>
          ))}
        </div>
      </div>

      {/* ================================================================
          PRIVACY — editorial trust section
          ================================================================ */}
      <section className="mx-auto grid max-w-7xl items-center gap-14 px-5 py-20 sm:px-8 lg:grid-cols-[1fr_1fr] lg:py-28">
        <div>
          <span className="editorial-kicker" style={{ borderBottomColor: "var(--success)", color: "var(--success)" }}>
            Privacy is a product feature
          </span>
          <h2 className="font-display mt-4 text-3xl font-semibold leading-[1.1] tracking-[-0.025em] sm:text-[2.75rem]">
            Your conversation isn&apos;t our content.
          </h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-[var(--muted)]">
            Screenshots are processed only after you press analyze. Milo strips metadata when practical and doesn&apos;t keep the image or original chat.
          </p>
          <Link
            className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[var(--brand)] underline-offset-4 hover:underline"
            href="/privacy"
          >
            Read the privacy approach <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {["No background monitoring", "No automatic sending", "No partner scoring", "No conversation archive"].map((item) => (
            <TiltCard
              key={item}
              className="flex min-h-24 items-start gap-3 rounded-sm border border-[var(--line)] bg-[var(--surface)] p-5"
              style={{ boxShadow: "var(--shadow-sm)" }}
              intensity={10}
            >
              <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-50 text-[var(--success)] dark:bg-emerald-950/40">
                <Check size={13} aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-semibold">{item}</p>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">Designed to keep you in charge.</p>
              </div>
            </TiltCard>
          ))}
        </div>
      </section>

      {/* ================================================================
          PRICING — premium 3D card
          ================================================================ */}
      <section className="border-y border-[var(--line)] bg-[var(--surface)]" id="pricing">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1fr_0.8fr] lg:py-28">
          <div>
            <span className="editorial-kicker">One plan, no games</span>
            <h2 className="font-display mt-4 max-w-xl text-3xl font-semibold leading-[1.1] tracking-[-0.025em] sm:text-[2.75rem]">
              Try it free. Upgrade only if Milo earns it.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-[var(--muted)]">
              No weekly subscription tricks, no surprise usage charges and no card needed for your first five successful analyses.
            </p>
          </div>

          {/* 3D pricing card — stacked shadow planes */}
          <div className="relative">
            <div className="absolute inset-0 translate-x-3 translate-y-3 rounded-sm border-2 border-[var(--brand)]/20 bg-[var(--brand-soft)]" aria-hidden="true" />
            <TiltCard
              className="relative overflow-hidden rounded-sm border-2 border-[var(--brand)] bg-[var(--surface)]"
              style={{ boxShadow: "var(--shadow-xl)" }}
              intensity={8}
            >
              {/* Corner stamp */}
              <div className="absolute right-0 top-0 bg-[var(--brand-fill)] px-4 py-1.5 text-[9px] font-extrabold uppercase tracking-[0.2em] text-white" style={{ borderBottomLeftRadius: "2px" }}>
                Simple monthly
              </div>

              <div className="p-7 pt-10 sm:p-8 sm:pt-12">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[var(--muted)]">Milo Plus</p>
                    <p className="mt-2">
                      <span className="font-display text-5xl font-semibold tracking-tight">€5.99</span>
                      <span className="ml-1.5 text-sm text-[var(--muted)]">/ month</span>
                    </p>
                  </div>
                  <MiloCat className="h-16 w-16 sm:h-20 sm:w-20" />
                </div>

                <ul className="my-7 space-y-3.5 text-sm">
                  {[
                    "5 successful analyses free",
                    "150 analyses each paid month",
                    "Warm, confident, playful and direct tones",
                    "Cancel through Stripe anytime",
                  ].map((item) => (
                    <li className="flex gap-3" key={item}>
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--brand-soft)] text-[var(--brand)]">
                        <Check size={11} aria-hidden="true" />
                      </span>
                      <span className="text-[var(--foreground)]">{item}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  className="btn btn-primary premium-button flex min-h-[3rem] w-full items-center justify-center gap-2 rounded-full font-bold text-white"
                  href="/login?next=/dashboard"
                >
                  <span>Start with 5 free</span>
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
                <p className="mt-3 text-center text-[11px] text-[var(--muted)]">
                  Adult accounts only · no card for the free allowance
                </p>
              </div>
            </TiltCard>
          </div>
        </div>
      </section>

      {/* ================================================================
          FAQ — deep ink background, editorial accordion
          ================================================================ */}
      <section id="faq" style={{ background: "var(--brand-fill)" }}>
        <div className="mx-auto max-w-4xl px-5 py-20 sm:px-8 lg:py-28">
          <span className="editorial-kicker" style={{ color: "rgba(255,255,255,0.5)", borderBottomColor: "var(--accent)" }}>
            Clear answers
          </span>
          <h2 className="font-display mt-4 text-3xl font-semibold leading-[1.1] tracking-[-0.025em] text-white sm:text-[2.75rem]">
            Questions, answered honestly.
          </h2>
          <div className="mt-10" style={{ borderTop: "1px solid rgba(255,255,255,0.12)" }}>
            {faqs.map(([q, a]) => (
              <details className="group border-b text-white" key={q} style={{ borderColor: "rgba(255,255,255,0.12)" }}>
                <summary className="flex min-h-[3.5rem] cursor-pointer list-none items-center justify-between gap-4 py-4 text-base font-semibold [&::-webkit-details-marker]:hidden sm:text-lg">
                  {q}
                  <ChevronDown className="shrink-0 opacity-50 transition-transform group-open:rotate-180" size={19} aria-hidden="true" />
                </summary>
                <p className="max-w-2xl pb-5 text-sm leading-7 text-white/65 sm:text-base">
                  {a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          CTA BANNER — 3D layered warm background
          ================================================================ */}
      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="relative overflow-hidden rounded-sm" style={{ background: "var(--surface-soft)", boxShadow: "var(--shadow-xl)" }}>
          {/* 3D depth offset planes */}
          <div className="absolute inset-4 rounded-sm border border-[var(--line)] opacity-40" aria-hidden="true" />
          <div className="absolute -inset-1" style={{ background: "radial-gradient(ellipse at 50% 0%, var(--accent-glow), transparent 70%)" }} aria-hidden="true" />

          <div className="relative px-8 py-14 text-center sm:py-16">
            <MiloCat className="mx-auto h-20 w-20 sm:h-24 sm:w-24 milo-bob" />
            <h2 className="font-display mx-auto mt-5 max-w-xl text-2xl font-semibold leading-snug tracking-[-0.02em] sm:text-4xl">
              A better reply is one screenshot away.
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-[var(--muted)] sm:text-base">
              Five analyses are free. Keep the suggestion, change every word or ignore it — you&apos;re always the author.
            </p>
            <Link
              className="btn btn-primary premium-button mt-8 inline-flex min-h-[3.25rem] items-center gap-2 rounded-full px-9 text-sm font-bold text-white"
              href="/login?next=/dashboard"
            >
              <span>Try Milo free</span>
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* ================================================================
          FOOTER
          ================================================================ */}
      <footer className="border-t border-[var(--line)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex items-center gap-2.5">
            <MiloCat className="h-7 w-7 opacity-70" />
            <span className="font-display text-sm font-medium text-[var(--muted)]">Milo</span>
            <span className="text-xs text-[var(--muted)]/50">· © 2026 · Suggestions, not instructions.</span>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-[var(--muted)]">
            <Link className="transition-colors hover:text-[var(--foreground)]" href="/privacy">Privacy</Link>
            <Link className="transition-colors hover:text-[var(--foreground)]" href="/terms">Terms</Link>
            <Link className="transition-colors hover:text-[var(--foreground)]" href="/login">Sign in</Link>
          </div>
        </div>
      </footer>

      {/* Mobile sticky CTA */}
      <div className="safe-bottom fixed inset-x-4 z-40 sm:hidden">
        <Link
          className="btn btn-primary premium-button flex min-h-[3.25rem] items-center justify-center gap-2 rounded-full px-6 font-bold text-white"
          href="/login?next=/dashboard"
        >
          <span>Try 5 analyses free</span>
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>
    </main>
  );
}
