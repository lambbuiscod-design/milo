import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { MiloCat } from "@/components/milo-cat";

export function SiteHeader() {
  return (
    <header className="glass sticky top-0 z-50 border-b border-[var(--line)]">
      <div className="mx-auto flex h-[4.25rem] w-full max-w-7xl items-center justify-between px-5 sm:px-8">

        {/* Wordmark */}
        <Link
          className="group flex min-h-11 items-center gap-3 rounded-sm transition-opacity hover:opacity-80"
          href="/"
          aria-label="Milo home"
        >
          <MiloCat
            className="h-9 w-9 transition-transform duration-200 group-hover:-rotate-3 sm:h-10 sm:w-10"
          />
          <span className="font-display text-xl font-semibold tracking-tight">Milo</span>
          <span className="editorial-kicker hidden sm:inline">Reply Coach</span>
        </Link>

        {/* Navigation */}
        <nav aria-label="Primary navigation" className="flex items-center gap-0.5 sm:gap-1">
          <Link
            className="hidden min-h-10 items-center rounded-sm px-3 py-2 text-sm font-medium text-[var(--muted)] transition-colors hover:text-[var(--foreground)] md:flex"
            href="/#how-it-works"
          >
            How it works
          </Link>
          <Link
            className="hidden min-h-10 items-center rounded-sm px-3 py-2 text-sm font-medium text-[var(--muted)] transition-colors hover:text-[var(--foreground)] sm:flex"
            href="/#pricing"
          >
            Pricing
          </Link>

          <div className="mx-2 hidden h-4 w-px bg-[var(--line)] sm:block" aria-hidden="true" />

          <Link
            className="min-h-10 rounded-sm px-3 py-2 text-sm font-semibold text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
            href="/login"
          >
            Sign in
          </Link>
          <Link
            className="btn btn-primary premium-button hidden min-h-10 items-center gap-1.5 rounded-full px-5 text-sm font-bold text-white sm:inline-flex"
            href="/login?next=/dashboard"
          >
            <span>Try Milo free</span>
            <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </nav>
      </div>

      {/* Classic rule — a single hairline under the nav */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-[var(--line-strong)] to-transparent opacity-60" aria-hidden="true" />
    </header>
  );
}
