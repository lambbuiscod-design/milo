"use client";
import { MiloCat } from "@/components/milo-cat";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="grid min-h-screen place-items-center px-5 outline-none" id="main-content" tabIndex={-1}><div className="max-w-md text-center"><MiloCat className="mx-auto h-28 w-28" mood="thinking" /><h1 className="font-display text-4xl font-semibold">Milo dropped the yarn.</h1><p className="mt-3 text-[var(--muted)]">Something unexpected happened. Your screenshot was not saved.</p><button className="mt-6 min-h-12 rounded-full bg-[var(--brand-fill)] px-6 font-extrabold text-white" onClick={reset}>Try again</button></div></main>;
}
