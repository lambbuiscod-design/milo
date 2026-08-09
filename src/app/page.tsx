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
    text: "Compare three honest suggestions, edit your favorite, then copy it when you’re ready.",
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
  { tone: "Warm", reply: "I had a lovely time too. I’d really like to see you again.", note: "Open, kind and sincere" },
  { tone: "Confident", reply: "Definitely. I know a place you’ll love—free Thursday?", note: "Clear, assured and specific" },
  { tone: "Playful", reply: "Round two? Only if you bring another dangerously good story 😄", note: "Light, witty and natural" },
  { tone: "Direct", reply: "Yes, I’d like that. Are you free Thursday evening?", note: "Simple, honest and easy to answer" },
];

export default function Home() {
  return (
    <main className="overflow-hidden outline-none" id="main-content" tabIndex={-1}>
      <SiteHeader />

      <section className="relative">
        <div className="premium-grid pointer-events-none absolute inset-0 -z-20" />
        <div className="pointer-events-none absolute -left-40 top-10 -z-10 h-96 w-96 rounded-full bg-[var(--accent)]/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-32 top-0 -z-10 h-[32rem] w-[32rem] rounded-full bg-[var(--brand-fill)]/14 blur-3xl" />

        <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 pb-24 pt-12 sm:px-8 sm:pt-16 lg:grid-cols-[1.05fr_.95fr] lg:gap-16 lg:pb-32 lg:pt-24">
          <div className="relative z-10">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--brand)]/20 bg-[var(--brand-soft)] px-3.5 py-2 text-sm font-extrabold text-[var(--brand-strong)] soft-shadow">
              <Sparkles size={15} aria-hidden="true" /> Thoughtful replies, still in your voice
            </div>
            <h1 className="font-display max-w-3xl text-[3.15rem] font-semibold leading-[.98] tracking-[-0.045em] sm:text-6xl lg:text-[4.6rem]">
              Never stare at the <span className="relative whitespace-nowrap text-[var(--brand)]">reply box<span className="absolute -bottom-1 left-0 h-2 w-full rounded-full bg-[var(--accent)]/45" aria-hidden="true" /></span> again.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--muted)] sm:text-xl">
              Upload a dating-chat screenshot and get three natural ways to respond—clear enough to move things forward, flexible enough to sound like you.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link className="premium-button inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-[var(--brand-fill)] px-7 font-extrabold text-white" href="/login?next=/dashboard">
                Try 5 analyses free <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)] px-7 font-bold transition hover:border-[var(--brand)] hover:bg-[var(--brand-soft)]" href="/demo">
                <MessageCircleHeart size={18} aria-hidden="true" /> See a real example
              </Link>
            </div>
            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2.5 text-sm font-semibold text-[var(--muted)]">
              {["No card required", "18+ only", "Nothing sends automatically"].map((item) => (
                <span className="flex items-center gap-1.5" key={item}><Check className="text-[var(--success)]" size={16} aria-hidden="true" />{item}</span>
              ))}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[34rem] lg:max-w-none">
            <div className="absolute -inset-5 -z-10 rotate-3 rounded-[2.4rem] bg-gradient-to-br from-[var(--accent)]/25 to-[var(--brand)]/20 blur-sm" />
            <div className="card-shadow overflow-hidden rounded-[2rem] border border-[var(--line)] bg-[var(--surface)]">
              <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4 sm:px-6">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[var(--brand-soft)]"><MessageCircleHeart className="text-[var(--brand)]" size={21} aria-hidden="true" /></span>
                  <div><p className="font-extrabold">New match</p><p className="text-xs text-[var(--muted)]">Playful · early dating</p></div>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-extrabold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"><LockKeyhole size={12} aria-hidden="true" /> Private</span>
              </div>
              <div className="bg-gradient-to-b from-[var(--surface)] to-[var(--surface-soft)]/60 p-5 sm:p-6">
                <div className="space-y-3 text-sm leading-6 sm:text-base">
                  <div className="mr-10 max-w-[80%] rounded-2xl rounded-bl-md border border-[var(--line)] bg-[var(--surface)] px-4 py-3 soft-shadow">I had fun tonight 😊</div>
                  <div className="ml-auto max-w-[82%] rounded-2xl rounded-br-md bg-[var(--brand-fill)] px-4 py-3 text-white">Me too! I was hoping you&apos;d say that.</div>
                  <div className="mr-10 max-w-[80%] rounded-2xl rounded-bl-md border border-[var(--line)] bg-[var(--surface)] px-4 py-3 soft-shadow">So… should we do it again?</div>
                </div>

                <div className="relative mt-6 overflow-hidden rounded-2xl border border-[var(--brand)]/30 bg-[var(--surface)] p-4 soft-shadow sm:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] font-black uppercase tracking-[.16em] text-[var(--brand-strong)]">Confident choice</p>
                    <BadgeCheck className="text-[var(--brand)]" size={18} aria-hidden="true" />
                  </div>
                  <p className="mt-2 font-bold leading-7">“Definitely. I know a place you&apos;ll love—free Thursday?”</p>
                  <div className="mt-4 flex items-center justify-between border-t border-[var(--line)] pt-3 text-xs text-[var(--muted)]">
                    <span>Clear, specific, low pressure</span><span className="flex items-center gap-1 font-bold text-[var(--brand)]"><Copy size={13} aria-hidden="true" /> Copy</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="soft-shadow absolute -bottom-8 left-2 flex items-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm font-bold sm:-left-8">
              <ShieldCheck className="text-[var(--success)]" size={19} aria-hidden="true" /> Deleted after analysis
            </div>
            <MiloCat className="milo-settle absolute -bottom-16 -right-3 h-28 w-28 drop-shadow-xl sm:-right-12 sm:h-36 sm:w-36" />
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-5 pb-16 sm:px-8 lg:pb-24">
          <div className="grid overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--surface)] soft-shadow sm:grid-cols-3">
            {trustItems.map(({ icon: Icon, title, text }, index) => (
              <div className={`flex gap-3 p-5 sm:p-6 ${index > 0 ? "border-t border-[var(--line)] sm:border-l sm:border-t-0" : ""}`} key={title}>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand-strong)]"><Icon size={19} aria-hidden="true" /></span>
                <div><p className="font-extrabold">{title}</p><p className="mt-1 text-sm leading-6 text-[var(--muted)]">{text}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-[var(--line)] bg-[var(--surface)] py-20 lg:py-28" id="how-it-works">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-extrabold uppercase tracking-[.18em] text-[var(--brand)]">A calmer way to reply</p>
            <h2 className="font-display mt-3 text-4xl font-semibold tracking-[-.025em] sm:text-5xl">From screenshot to something worth sending.</h2>
            <p className="mt-5 text-lg leading-8 text-[var(--muted)]">Milo helps with the blank page. The judgment, personality and final send always stay with you.</p>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {steps.map(({ icon: Icon, title, text }, index) => (
              <article className="interactive-card relative overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--background)] p-6 sm:p-7" key={title}>
                <span className="absolute right-5 top-4 font-display text-6xl font-semibold text-[var(--brand)]/8" aria-hidden="true">{index + 1}</span>
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand-strong)]"><Icon size={23} aria-hidden="true" /></span>
                <h3 className="mt-8 text-xl font-extrabold">{title}</h3>
                <p className="mt-3 leading-7 text-[var(--muted)]">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-24" aria-labelledby="tone-examples-title">
        <div className="max-w-2xl">
          <p className="text-sm font-extrabold uppercase tracking-[.18em] text-[var(--brand)]">Same intention, different energy</p>
          <h2 className="font-display mt-3 text-4xl font-semibold tracking-[-.025em] sm:text-5xl" id="tone-examples-title">Choose a tone that still sounds like you.</h2>
          <p className="mt-5 text-lg leading-8 text-[var(--muted)]">Milo gives you a starting point—not a personality transplant. Every suggestion stays editable.</p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {toneExamples.map((example) => (
            <article className="interactive-card rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-5 soft-shadow" key={example.tone}>
              <p className="text-xs font-black uppercase tracking-[.14em] text-[var(--brand-strong)]">{example.tone}</p>
              <p className="mt-4 leading-7">“{example.reply}”</p>
              <p className="mt-4 text-sm font-semibold text-[var(--muted)]">{example.note}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[.9fr_1.1fr] lg:py-28">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-sm font-extrabold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"><ShieldCheck size={16} aria-hidden="true" /> Privacy is a product feature</span>
          <h2 className="font-display mt-5 text-4xl font-semibold tracking-[-.025em] sm:text-5xl">Your conversation isn&apos;t our content.</h2>
          <p className="mt-5 max-w-xl text-lg leading-8 text-[var(--muted)]">Screenshots are processed only after you press analyze. Milo strips metadata when practical and doesn&apos;t keep the image or original chat.</p>
          <Link className="mt-6 inline-flex min-h-11 items-center gap-2 font-extrabold text-[var(--brand-strong)]" href="/privacy">Read the privacy approach <ArrowRight size={17} aria-hidden="true" /></Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {["No background monitoring", "No automatic sending", "No partner scoring", "No conversation archive"].map((item) => (
            <div className="flex min-h-28 items-start gap-3 rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-5 soft-shadow" key={item}>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-50 text-[var(--success)] dark:bg-emerald-950"><Check size={16} aria-hidden="true" /></span>
              <div><p className="font-extrabold">{item}</p><p className="mt-1 text-sm leading-6 text-[var(--muted)]">Designed to keep you—not Milo—in charge.</p></div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-[var(--line)] bg-[var(--surface)]" id="pricing">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[1fr_.9fr] lg:py-28">
          <div>
            <p className="text-sm font-extrabold uppercase tracking-[.18em] text-[var(--brand)]">One plan, no games</p>
            <h2 className="font-display mt-3 max-w-xl text-4xl font-semibold tracking-[-.025em] sm:text-5xl">Try it free. Upgrade only if Milo earns it.</h2>
            <p className="mt-5 max-w-xl text-lg leading-8 text-[var(--muted)]">No weekly subscription tricks, no surprise usage charges and no card needed for your first five successful analyses.</p>
          </div>
          <div className="card-shadow relative overflow-hidden rounded-[2rem] border-2 border-[var(--brand)] bg-[var(--surface)] p-7 sm:p-9">
            <div className="absolute right-0 top-0 rounded-bl-2xl bg-[var(--brand-fill)] px-4 py-2 text-xs font-black uppercase tracking-[.12em] text-white">Simple monthly</div>
            <div className="flex items-start justify-between gap-4 pt-3">
              <div><p className="font-extrabold text-[var(--brand-strong)]">Milo Plus</p><p className="mt-2"><span className="text-5xl font-black tracking-tight">€5.99</span><span className="text-[var(--muted)]"> / month</span></p></div>
              <MiloCat className="h-20 w-20" />
            </div>
            <ul className="my-8 space-y-3.5">
              {["5 successful analyses free", "150 analyses each paid month", "Warm, confident, playful and direct tones", "Cancel through Stripe anytime"].map((item) => <li className="flex gap-3" key={item}><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--brand-soft)] text-[var(--brand-strong)]"><Check size={14} aria-hidden="true" /></span><span className="font-semibold">{item}</span></li>)}
            </ul>
            <Link className="premium-button flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-[var(--brand-fill)] px-6 font-extrabold text-white" href="/login?next=/dashboard">Start with 5 free <ArrowRight size={18} aria-hidden="true" /></Link>
            <p className="mt-3 text-center text-xs text-[var(--muted)]">Adult accounts only · no card for the free allowance</p>
          </div>
        </div>
      </section>

      <section className="bg-[#1d1d35] py-20 text-white dark:bg-[#09090e] lg:py-24" id="faq">
        <div className="mx-auto max-w-4xl px-5 sm:px-8">
          <p className="text-sm font-extrabold uppercase tracking-[.18em] text-[#aeb6ff]">Clear answers</p>
          <h2 className="font-display mt-3 text-4xl font-semibold tracking-[-.025em] sm:text-5xl">Questions, answered honestly.</h2>
          <div className="mt-9 divide-y divide-white/15 border-y border-white/15">
            {faqs.map(([question, answer]) => (
              <details className="group py-1" key={question}>
                <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-4 text-lg font-bold [&::-webkit-details-marker]:hidden">
                  {question}<ChevronDown className="shrink-0 text-white/50 transition-transform group-open:rotate-180" size={20} aria-hidden="true" />
                </summary>
                <p className="max-w-2xl pb-5 leading-7 text-white/70">{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="relative overflow-hidden rounded-[2rem] bg-[var(--brand-fill)] px-6 py-10 text-center text-white card-shadow sm:px-10 sm:py-14">
          <div className="pointer-events-none absolute -left-12 -top-20 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
          <MiloCat className="mx-auto h-24 w-24" />
          <h2 className="font-display mt-3 text-3xl font-semibold sm:text-4xl">A better reply is one screenshot away.</h2>
          <p className="mx-auto mt-3 max-w-xl text-white/90">Five analyses are free. Keep the suggestion, change every word or ignore it completely—you&apos;re always the author.</p>
          <Link className="mt-7 inline-flex min-h-13 items-center gap-2 rounded-full bg-white px-7 font-extrabold text-[var(--brand-on-light)] transition hover:-translate-y-0.5" href="/login?next=/dashboard">Try Milo free <ArrowRight size={18} aria-hidden="true" /></Link>
        </div>
      </section>

      <footer className="mx-auto flex max-w-7xl flex-col gap-5 px-5 pb-28 pt-3 text-sm text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:pb-8">
        <p>© 2026 Milo. Suggestions, not instructions.</p>
        <div className="flex flex-wrap gap-x-5 gap-y-1"><Link className="inline-flex min-h-11 items-center hover:text-[var(--foreground)]" href="/privacy">Privacy</Link><Link className="inline-flex min-h-11 items-center hover:text-[var(--foreground)]" href="/terms">Terms</Link><Link className="inline-flex min-h-11 items-center hover:text-[var(--foreground)]" href="/login">Sign in</Link></div>
      </footer>

      <div className="safe-bottom fixed inset-x-3 z-40 sm:hidden">
        <Link className="premium-button flex min-h-14 items-center justify-center gap-2 rounded-full bg-[var(--brand-fill)] px-6 font-extrabold text-white" href="/login?next=/dashboard">Try 5 analyses free <ArrowRight size={17} aria-hidden="true" /></Link>
      </div>
    </main>
  );
}
