"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, Home, LayoutDashboard, LogOut, ShieldCheck } from "lucide-react";
import { MiloCat } from "@/components/milo-cat";
import { signOut } from "@/app/login/actions";

export function AppShell({ children, email }: { children: React.ReactNode; email: string }) {
  const pathname = usePathname();
  const coachActive = pathname === "/dashboard";
  const accountActive = pathname === "/account";

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="sticky top-0 hidden h-screen border-r border-[var(--line)] bg-[var(--surface)] px-5 py-6 lg:flex lg:flex-col">
        <Link className="group flex items-center gap-2.5 rounded-full text-lg font-extrabold" href="/">
          <MiloCat className="h-11 w-11 transition-transform group-hover:-rotate-3" />
          Milo
        </Link>
        <div className="mt-8 rounded-3xl bg-[var(--brand-soft)] p-4">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.12em] text-[var(--brand-strong)]">
            <ShieldCheck size={16} aria-hidden="true" /> Private workspace
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Screenshots are removed immediately after each analysis.</p>
        </div>
        <nav className="mt-7 space-y-1.5" aria-label="App navigation">
          <Link aria-current={coachActive ? "page" : undefined} className={`flex min-h-12 items-center gap-3 rounded-2xl px-4 font-bold transition-colors ${coachActive ? "bg-[var(--brand-soft)] text-[var(--brand-strong)]" : "text-[var(--muted)] hover:bg-[var(--background)] hover:text-[var(--foreground)]"}`} href="/dashboard"><LayoutDashboard size={19} aria-hidden="true" /> Reply coach</Link>
          <Link aria-current={accountActive ? "page" : undefined} className={`flex min-h-12 items-center gap-3 rounded-2xl px-4 font-semibold transition-colors ${accountActive ? "bg-[var(--brand-soft)] text-[var(--brand-strong)]" : "text-[var(--muted)] hover:bg-[var(--background)] hover:text-[var(--foreground)]"}`} href="/account"><CreditCard size={19} aria-hidden="true" /> Plan & account</Link>
          <Link className="flex min-h-12 items-center gap-3 rounded-2xl px-4 font-semibold text-[var(--muted)] transition-colors hover:bg-[var(--background)] hover:text-[var(--foreground)]" href="/"><Home size={19} aria-hidden="true" /> Milo home</Link>
        </nav>
        <div className="mt-auto rounded-2xl border border-[var(--line)] p-4">
          <p className="truncate text-xs text-[var(--muted)]" title={email}>{email}</p>
          <form action={signOut}>
            <button className="mt-3 flex min-h-11 w-full items-center gap-2 rounded-xl text-sm font-bold transition-colors hover:text-[var(--brand-strong)]" type="submit"><LogOut size={16} aria-hidden="true" /> Sign out</button>
          </form>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="glass sticky top-0 z-40 flex h-16 items-center justify-between border-b border-[var(--line)] px-4 lg:hidden">
          <Link className="flex min-h-11 items-center gap-2 font-extrabold" href="/"><MiloCat className="h-10 w-10" /> Milo</Link>
          <form action={signOut}>
            <button aria-label="Sign out" className="grid h-11 w-11 place-items-center rounded-full border border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]" type="submit"><LogOut size={17} aria-hidden="true" /></button>
          </form>
        </header>
        <main className="app-content-bottom outline-none lg:pb-0" id="main-content" tabIndex={-1}>{children}</main>
        <nav aria-label="Mobile app navigation" className="safe-bottom glass fixed inset-x-3 z-50 grid grid-cols-2 rounded-2xl border border-[var(--line)] p-1.5 shadow-2xl lg:hidden">
          <Link aria-current={coachActive ? "page" : undefined} className={`flex min-h-12 items-center justify-center gap-2 rounded-xl px-3 text-sm font-extrabold transition-colors ${coachActive ? "bg-[var(--brand-fill)] text-white" : "text-[var(--muted)]"}`} href="/dashboard"><LayoutDashboard size={18} aria-hidden="true" /> Coach</Link>
          <Link aria-current={accountActive ? "page" : undefined} className={`flex min-h-12 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold transition-colors ${accountActive ? "bg-[var(--brand-fill)] text-white" : "text-[var(--muted)]"}`} href="/account"><CreditCard size={18} aria-hidden="true" /> Account</Link>
        </nav>
      </div>
    </div>
  );
}
