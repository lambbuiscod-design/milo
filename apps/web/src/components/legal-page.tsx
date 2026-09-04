import Link from "next/link";
import { MiloCat } from "@/components/milo-cat";

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 outline-none sm:px-6 sm:py-16" id="main-content" tabIndex={-1}>
      <Link className="group flex items-center gap-2 font-extrabold" href="/" aria-label="Milo home">
        <MiloCat className="h-10 w-10 transition-transform group-hover:-rotate-3" />
        <span className="text-lg font-bold">Milo</span>
      </Link>
      <div className="badge badge-neutral mt-10 font-extrabold uppercase tracking-wider text-[var(--brand)]">
        Legal review required before launch
      </div>
      <h1 className="font-display mt-2 text-3xl font-semibold sm:text-5xl">{title}</h1>
      <p className="mt-2 text-xs text-[var(--muted)] sm:text-sm">Draft updated {updated}</p>
      <div className="mt-8 space-y-7 text-sm leading-7 text-[var(--muted)] sm:text-base [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-extrabold [&_h2]:text-[var(--foreground)] [&_strong]:text-[var(--foreground)]">
        {children}
      </div>
    </main>
  );
}
