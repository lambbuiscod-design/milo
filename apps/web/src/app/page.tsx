import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
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
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { MiloCat } from "@/components/milo-cat";
import { SiteHeader } from "@/components/site-header";

const steps = [
  {
    icon: ImageUp,
    title: "Add the conversation",
    text: "Choose a screenshot from your phone. Add a little context only when it helps.",
  },
  {
    icon: WandSparkles,
    title: "Set the right energy",
    text: "Pick warm, confident, playful or direct. Milo reads only what you submit.",
  },
  {
    icon: PencilLine,
    title: "Make the reply yours",
    text: "Compare three honest suggestions, edit your favorite, then copy it when you're ready.",
  },
];

const faqs = [
  ["Does Milo send messages for me?", "Never. Milo only suggests editable replies. You decide what to copy and send."],
  ["Do you keep my screenshots?", "No. Screenshots are sanitized in memory, analyzed, and discarded after the request."],
  ["Can Milo manipulate someone for me?", "No. Milo is designed for clear, respectful communication and blocks coercive or unsafe requests."],
  ["What happens after my free analyses?", "Five successful analyses are free. Milo Plus is €5.99/month for up to 150 analyses."],
];

const trustItems = [
  { icon: EyeOff, title: "No screenshot history", text: "Your image is discarded after processing." },
  { icon: PencilLine, title: "You stay in control", text: "Every suggestion is editable. Nothing sends automatically." },
  { icon: HeartHandshake, title: "Respect built in", text: "Milo avoids pressure, coercion and invented claims." },
];

const toneExamples = [
  { tone: "Warm", reply: "I had a lovely time too. I'd really like to see you again.", note: "Open, kind and sincere" },
  { tone: "Confident", reply: "Definitely. I know a place you'll love—free Thursday?", note: "Clear, assured and specific" },
  { tone: "Playful", reply: "Round two? Only if you bring another dangerously good story.", note: "Light, witty and natural" },
  { tone: "Direct", reply: "Yes, I'd like that. Are you free Thursday evening?", note: "Simple, honest and easy to answer" },
];

export default function Home() {
  return (
    <main className="overflow-x-hidden outline-none" id="main-content" tabIndex={-1}>
      <SiteHeader />

      {/* Hero Section */}
      <section className="relative">
        <div className="premium-grid pointer-events-none absolute inset-0 -z-20 opacity-60" />

        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-20 pt-10 sm:px-8 sm:pt-16 lg:grid-cols-[1.05fr_.95fr] lg:gap-16 lg:pb-28 lg:pt-20">
          <div className="relative z-10">
            <div className="badge badge-neutral mb-6 inline-flex gap-2 px-3.5 py-3 text-xs font-extrabold uppercase tracking-wider soft-shadow">
              <Sparkles size={14} aria-hidden="true" />
              <span>Thoughtful replies, still in your voice</span>
            </div>

            <h1 className="font-display max-w-3xl text-4xl font-semibold leading-[1.05] tracking-[-0.04em] sm:text-6xl lg:text-[4.4rem]">
              Never stare at the{" "}
              <span className="relative whitespace-nowrap text-[var(--brand)]">
                reply box
                <span
                  className="absolute -bottom-1 left-0 h-2 w-full rounded-full bg-[var(--accent)]/40"
                  aria-hidden="true"
                />
              </span>{" "}
              again.
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-8 text-[var(--muted)] sm:text-lg">
              Upload a dating-chat screenshot and get three natural ways to respond—clear enough to move things forward, flexible enough to sound like you.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                className="btn btn-primary premium-button inline-flex min-h-14 items-center justify-center gap-2 rounded-full px-7 text-sm font-extrabold text-white"
                href="/login?next=/dashboard"
              >
                <span>Try 5 analyses free</span>
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link
                className="btn btn-outline inline-flex min-h-14 items-center justify-center gap-2 rounded-full border-[var(--line)] bg-[var(--surface)] px-7 text-sm font-bold text-[var(--foreground)] hover:border-[var(--brand)] hover:bg-[var(--brand-soft)]"
                href="/demo"
              >
                <MessageCircleHeart size={18} aria-hidden="true" />
                <span>See a real example</span>
              </Link>
            </div>

            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2.5 text-xs font-semibold text-[var(--muted)] sm:text-sm">
              {["No card required", "18+ only", "Nothing sends automatically"].map((item) => (
                <span className="flex items-center gap-1.5" key={item}>
                  <Check className="text-[var(--success)]" size={16} aria-hidden="true" />
                  {item}
                </span>
              ))}
            </div>
          </div>

          {/* Interactive Editorial Preview Card */}
          <div className="relative mx-auto w-full max-w-[34rem] lg:max-w-none">
            <div className="card card-shadow border border-[var(--line)] bg-[var(--surface)]">
              <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4 sm:px-6">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand-strong)]">
                    <MessageCircleHeart size={20} aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-sm font-extrabold">New match</p>
                    <p className="text-xs text-[var(--muted)]">Playful · early dating</p>
                  </div>
                </div>
                <span className="badge badge-success badge-sm inline-flex items-center gap-1 font-bold">
                  <LockKeyhole size={11} aria-hidden="true" /> Private
                </span>
              </div>

              <div className="card-body bg-gradient-to-b from-[var(--surface)] to-[var(--surface-soft)]/50 p-5 sm:p-6">
                {/* Clean Structured Transcript */}
                <div className="space-y-3 text-sm leading-6">
                  <div className="mr-8 max-w-[85%] rounded-2xl rounded-bl-sm border border-[var(--line)] bg-[var(--surface)] px-4 py-3 soft-shadow">
                    <p className="text-[11px] font-bold text-[var(--muted)]">Their message</p>
                    <p className="mt-0.5">I had fun tonight. Thanks for showing me that place.</p>
                  </div>
                  <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-[var(--brand-fill)] px-4 py-3 text-white">
                    <p className="text-[11px] font-bold text-white/70">Your message</p>
                    <p className="mt-0.5">Me too! I was hoping you&apos;d say that.</p>
                  </div>
                  <div className="mr-8 max-w-[85%] rounded-2xl rounded-bl-sm border border-[var(--line)] bg-[var(--surface)] px-4 py-3 soft-shadow">
                    <p className="text-[11px] font-bold text-[var(--muted)]">Their message</p>
                    <p className="mt-0.5">So… should we do it again?</p>
                  </div>
                </div>

                {/* Suggested Reply Card */}
                <div className="relative mt-5 rounded-2xl border border-[var(--brand)]/30 bg-[var(--surface)] p-4.5 soft-shadow">
                  <div className="flex items-center justify-between gap-3">
                    <div className="badge badge-primary badge-sm font-extrabold uppercase tracking-wider">
                      Confident choice
                    </div>
                    <BadgeCheck className="text-[var(--brand)]" size={18} aria-hidden="true" />
                  </div>
                  <p className="mt-2.5 font-bold leading-7 text-[var(--foreground)]">
                    “Definitely. I know a place you&apos;ll love—free Thursday?”
                  </p>
                  <div className="mt-3.5 flex items-center justify-between border-t border-[var(--line)] pt-3 text-xs text-[var(--muted)]">
                    <span>Clear, specific, low pressure</span>
                    <span className="flex items-center gap-1 font-bold text-[var(--brand)]">
                      <Copy size={13} aria-hidden="true" /> Copy
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="soft-shadow absolute -bottom-6 left-2 flex items-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-2.5 text-xs font-bold text-[var(--foreground)] sm:-left-6 sm:text-sm">
              <ShieldCheck className="text-[var(--success)]" size={18} aria-hidden="true" />
              <span>Deleted after analysis</span>
            </div>
            <MiloCat className="milo-settle absolute -bottom-14 -right-3 h-28 w-28 drop-shadow-xl sm:-right-10 sm:h-36 sm:w-36" />
          </div>
        </div>

        {/* Trust Badges */}
        <div className="mx-auto max-w-7xl px-4 pb-16 sm:px-8 lg:pb-20">
          <div className="grid overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--surface)] soft-shadow sm:grid-cols-3">
            {trustItems.map(({ icon: Icon, title, text }, index) => (
              <div
                className={`flex gap-3.5 p-5 sm:p-6 ${index > 0 ? "border-t border-[var(--line)] sm:border-l sm:border-t-0" : ""}`}
                key={title}
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand-strong)]">
                  <Icon size={19} aria-hidden="true" />
                </div>
                <div>
                  <p className="font-extrabold">{title}</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted)] sm:text-sm">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section className="border-y border-[var(--line)] bg-[var(--surface)] py-20 lg:py-24" id="how-it-works">
        <div className="mx-auto max-w-7xl px-4 sm:px-8">
          <div className="max-w-2xl">
            <span className="badge badge-neutral text-xs font-extrabold uppercase tracking-wider">
              A calmer way to reply
            </span>
            <h2 className="font-display mt-3 text-3xl font-semibold tracking-[-.025em] sm:text-5xl">
              From screenshot to something worth sending.
            </h2>
            <p className="mt-4 text-base leading-7 text-[var(--muted)] sm:text-lg">
              Milo helps with the blank page. The judgment, personality and final send always stay with you.
            </p>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {steps.map(({ icon: Icon, title, text }, index) => (
              <article
                className="interactive-card relative overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--background)] p-6 sm:p-7"
                key={title}
              >
                <span
                  className="absolute right-5 top-4 font-display text-5xl font-semibold text-[var(--brand)]/10"
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand-strong)]">
                  <Icon size={22} aria-hidden="true" />
                </div>
                <h3 className="mt-7 text-lg font-extrabold">{title}</h3>
                <p className="mt-2.5 text-sm leading-6 text-[var(--muted)]">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Tone Examples Section */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-8 lg:py-24" aria-labelledby="tone-examples-title">
        <div className="max-w-2xl">
          <span className="badge badge-neutral text-xs font-extrabold uppercase tracking-wider">
            Same intention, different energy
          </span>
          <h2 className="font-display mt-3 text-3xl font-semibold tracking-[-.025em] sm:text-5xl" id="tone-examples-title">
            Choose a tone that still sounds like you.
          </h2>
          <p className="mt-4 text-base leading-7 text-[var(--muted)] sm:text-lg">
            Milo gives you a starting point—not a personality transplant. Every suggestion stays editable.
          </p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {toneExamples.map((example) => (
            <article
              className="interactive-card rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-5 soft-shadow"
              key={example.tone}
            >
              <div className="badge badge-sm badge-neutral font-extrabold uppercase tracking-wider">
                {example.tone}
              </div>
              <p className="mt-4 font-bold leading-6">“{example.reply}”</p>
              <p className="mt-3 text-xs font-semibold text-[var(--muted)]">{example.note}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Privacy Section */}
      <section className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-8 lg:grid-cols-[.9fr_1.1fr] lg:py-24">
        <div>
          <span className="badge badge-success badge-sm inline-flex items-center gap-1.5 font-extrabold">
            <ShieldCheck size={14} aria-hidden="true" /> Privacy is a product feature
          </span>
          <h2 className="font-display mt-4 text-3xl font-semibold tracking-[-.025em] sm:text-5xl">
            Your conversation isn&apos;t our content.
          </h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-[var(--muted)]">
            Screenshots are processed only after you press analyze. Milo strips metadata when practical and doesn&apos;t keep the image or original chat.
          </p>
          <Link
            className="btn btn-ghost btn-sm mt-5 inline-flex items-center gap-2 font-extrabold text-[var(--brand-strong)]"
            href="/privacy"
          >
            <span>Read the privacy approach</span>
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
        <div className="grid gap-3.5 sm:grid-cols-2">
          {["No background monitoring", "No automatic sending", "No partner scoring", "No conversation archive"].map((item) => (
            <div
              className="flex min-h-24 items-start gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4.5 soft-shadow"
              key={item}
            >
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-50 text-[var(--success)] dark:bg-emerald-950">
                <Check size={15} aria-hidden="true" />
              </div>
              <div>
                <p className="font-extrabold text-sm">{item}</p>
                <p className="mt-0.5 text-xs leading-5 text-[var(--muted)]">Designed to keep you in charge.</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing Section */}
      <section className="border-y border-[var(--line)] bg-[var(--surface)]" id="pricing">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-20 sm:px-8 lg:grid-cols-[1fr_.9fr] lg:py-24">
          <div>
            <span className="badge badge-neutral text-xs font-extrabold uppercase tracking-wider">
              One plan, no games
            </span>
            <h2 className="font-display mt-3 max-w-xl text-3xl font-semibold tracking-[-.025em] sm:text-5xl">
              Try it free. Upgrade only if Milo earns it.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-[var(--muted)]">
              No weekly subscription tricks, no surprise usage charges and no card needed for your first five successful analyses.
            </p>
          </div>
          <div className="card card-shadow relative overflow-hidden rounded-[2rem] border-2 border-[var(--brand)] bg-[var(--surface)] p-6 sm:p-8">
            <div className="absolute right-0 top-0 rounded-bl-2xl bg-[var(--brand-fill)] px-3.5 py-1.5 text-[11px] font-black uppercase tracking-wider text-white">
              Simple monthly
            </div>
            <div className="flex items-start justify-between gap-4 pt-2">
              <div>
                <p className="font-extrabold text-[var(--brand-strong)]">Milo Plus</p>
                <p className="mt-2">
                  <span className="text-4xl font-black tracking-tight sm:text-5xl">€5.99</span>
                  <span className="text-sm text-[var(--muted)]"> / month</span>
                </p>
              </div>
              <MiloCat className="h-16 w-16 sm:h-20 sm:w-20" />
            </div>
            <ul className="my-6 space-y-3 text-sm">
              {[
                "5 successful analyses free",
                "150 analyses each paid month",
                "Warm, confident, playful and direct tones",
                "Cancel through Stripe anytime",
              ].map((item) => (
                <li className="flex gap-2.5" key={item}>
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--brand-soft)] text-[var(--brand-strong)]">
                    <Check size={13} aria-hidden="true" />
                  </span>
                  <span className="font-semibold">{item}</span>
                </li>
              ))}
            </ul>
            <Link
              className="btn btn-primary premium-button flex min-h-13 w-full items-center justify-center gap-2 rounded-full px-6 font-extrabold text-white"
              href="/login?next=/dashboard"
            >
              <span>Start with 5 free</span>
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <p className="mt-2.5 text-center text-xs text-[var(--muted)]">
              Adult accounts only · no card for the free allowance
            </p>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="bg-[#1d1d35] py-16 text-white dark:bg-[#09090e] lg:py-20" id="faq">
        <div className="mx-auto max-w-4xl px-4 sm:px-8">
          <span className="badge badge-outline border-white/30 text-xs font-extrabold uppercase tracking-wider text-[#aeb6ff]">
            Clear answers
          </span>
          <h2 className="font-display mt-3 text-3xl font-semibold tracking-[-.025em] sm:text-5xl">
            Questions, answered honestly.
          </h2>
          <div className="mt-8 divide-y divide-white/15 border-y border-white/15">
            {faqs.map(([question, answer]) => (
              <details className="group py-1" key={question}>
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 text-base font-bold sm:text-lg [&::-webkit-details-marker]:hidden">
                  {question}
                  <ChevronDown
                    className="shrink-0 text-white/50 transition-transform group-open:rotate-180"
                    size={20}
                    aria-hidden="true"
                  />
                </summary>
                <p className="max-w-2xl pb-5 text-sm leading-6 text-white/70 sm:text-base sm:leading-7">
                  {answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Call to Action Banner */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-8 sm:py-18">
        <div className="card card-shadow relative overflow-hidden rounded-[2rem] bg-[var(--brand-fill)] px-6 py-10 text-center text-white sm:px-10 sm:py-12">
          <MiloCat className="mx-auto h-20 w-20 sm:h-24 sm:w-24" />
          <h2 className="font-display mt-3 text-2xl font-semibold sm:text-4xl">
            A better reply is one screenshot away.
          </h2>
          <p className="mx-auto mt-2.5 max-w-xl text-sm text-white/90 sm:text-base">
            Five analyses are free. Keep the suggestion, change every word or ignore it completely—you&apos;re always the author.
          </p>
          <Link
            className="btn btn-sm btn-ghost mx-auto mt-6 inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-7 font-extrabold text-[var(--brand-on-light)] hover:bg-white/90"
            href="/login?next=/dashboard"
          >
            <span>Try Milo free</span>
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="mx-auto flex max-w-7xl flex-col gap-4 px-4 pb-28 pt-2 text-xs text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:pb-8 sm:text-sm">
        <p>© 2026 Milo. Suggestions, not instructions.</p>
        <div className="flex flex-wrap gap-x-5 gap-y-1">
          <Link className="inline-flex min-h-10 items-center hover:text-[var(--foreground)]" href="/privacy">
            Privacy
          </Link>
          <Link className="inline-flex min-h-10 items-center hover:text-[var(--foreground)]" href="/terms">
            Terms
          </Link>
          <Link className="inline-flex min-h-10 items-center hover:text-[var(--foreground)]" href="/login">
            Sign in
          </Link>
        </div>
      </footer>

      {/* Mobile Sticky CTA */}
      <div className="safe-bottom fixed inset-x-3 z-40 sm:hidden">
        <Link
          className="btn btn-primary premium-button flex min-h-13 items-center justify-center gap-2 rounded-full px-6 font-extrabold text-white"
          href="/login?next=/dashboard"
        >
          <span>Try 5 analyses free</span>
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </main>
  );
}
