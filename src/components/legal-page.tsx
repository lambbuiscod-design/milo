import Link from "next/link";
import { MiloCat } from "@/components/milo-cat";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return <main className="mx-auto max-w-3xl px-5 py-10 outline-none sm:py-16" id="main-content" tabIndex={-1}><Link className="flex items-center gap-2 font-extrabold" href="/"><MiloCat className="h-11 w-11" /> Milo</Link><p className="mt-12 text-sm font-extrabold uppercase tracking-[.16em] text-[var(--brand)]">Legal review required before launch</p><h1 className="font-display mt-2 text-4xl font-semibold sm:text-5xl">{title}</h1><p className="mt-3 text-sm text-[var(--muted)]">Draft updated {updated}</p><div className="mt-10 space-y-8 leading-7 text-[var(--muted)] [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-extrabold [&_h2]:text-[var(--foreground)] [&_strong]:text-[var(--foreground)]">{children}</div></main>;
}
