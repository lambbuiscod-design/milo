import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { MiloCat } from "@/components/milo-cat";

export function SiteHeader() {
  return (
    <header className="glass sticky top-0 z-50 border-b border-[var(--line)]/80">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:h-[4.5rem] sm:px-8">
        <Link className="group flex min-h-11 items-center gap-2.5 rounded-full font-extrabold tracking-tight" href="/" aria-label="Milo home">
          <MiloCat className="h-10 w-10 transition-transform duration-200 group-hover:-rotate-3 sm:h-11 sm:w-11" />
          <span className="text-lg">Milo</span>
          <span className="hidden rounded-full bg-[var(--brand-soft)] px-2 py-1 text-[10px] font-black uppercase tracking-[.12em] text-[var(--brand-strong)] sm:inline">Reply coach</span>
        </Link>
        <nav aria-label="Primary navigation" className="flex items-center gap-1 sm:gap-2">
          <Link className="hidden min-h-11 items-center rounded-full px-3 py-2 text-sm font-semibold text-[var(--muted)] transition-colors hover:text-[var(--foreground)] md:inline-flex" href="/#how-it-works">
            How it works
          </Link>
          <Link className="hidden min-h-11 items-center rounded-full px-3 py-2 text-sm font-semibold text-[var(--muted)] transition-colors hover:text-[var(--foreground)] sm:inline-flex" href="/#pricing">
            Pricing
          </Link>
          <Link className="inline-flex min-h-11 items-center rounded-full px-3 py-2 text-sm font-bold transition-colors hover:bg-[var(--surface-soft)] sm:px-4" href="/login">
            Sign in
          </Link>
          <Link className="premium-button hidden min-h-11 items-center gap-1.5 rounded-full bg-[var(--brand-fill)] px-4 text-sm font-extrabold text-white sm:inline-flex" href="/login?next=/dashboard">
            Try Milo <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </nav>
      </div>
    </header>
  );
}
