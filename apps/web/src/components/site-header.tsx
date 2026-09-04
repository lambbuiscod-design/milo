import Link from "next/link";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { MiloCat } from "@/components/milo-cat";

export function SiteHeader() {
  return (
    <header className="glass sticky top-0 z-50 border-b border-[var(--line)]/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:h-[4.5rem] sm:px-8">
        <Link
          className="group flex min-h-11 items-center gap-2.5 rounded-full font-extrabold tracking-tight transition-transform hover:opacity-90"
          href="/"
          aria-label="Milo home"
        >
          <MiloCat className="h-10 w-10 transition-transform duration-200 group-hover:-rotate-3 sm:h-11 sm:w-11" />
          <span className="text-lg font-bold tracking-tight">Milo</span>
          <span className="badge badge-sm badge-neutral hidden font-extrabold uppercase tracking-wider sm:inline-flex">
            Reply coach
          </span>
        </Link>
        <nav aria-label="Primary navigation" className="flex items-center gap-1 sm:gap-2">
          <Link
            className="btn btn-ghost btn-sm hidden text-sm font-semibold text-[var(--muted)] hover:text-[var(--foreground)] md:inline-flex"
            href="/#how-it-works"
          >
            How it works
          </Link>
          <Link
            className="btn btn-ghost btn-sm hidden text-sm font-semibold text-[var(--muted)] hover:text-[var(--foreground)] sm:inline-flex"
            href="/#pricing"
          >
            Pricing
          </Link>
          <Link
            className="btn btn-ghost btn-sm text-sm font-bold sm:px-4"
            href="/login"
          >
            Sign in
          </Link>
          <Link
            className="btn btn-primary btn-sm premium-button hidden min-h-10 items-center gap-1.5 rounded-full px-4 text-xs font-extrabold sm:inline-flex"
            href="/login?next=/dashboard"
          >
            <Sparkles size={14} aria-hidden="true" />
            <span>Try Milo</span>
            <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
        </nav>
      </div>
    </header>
  );
}
