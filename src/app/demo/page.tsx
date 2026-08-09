import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FlaskConical } from "lucide-react";
import { CoachWorkspace } from "@/components/coach-workspace";

export const metadata: Metadata = { title: "Interactive demo" };

export default function DemoPage() {
  return (
    <main className="outline-none" id="main-content" tabIndex={-1}>
      <div className="border-b border-[var(--brand)]/15 bg-[var(--brand-soft)] px-4 py-3 text-sm text-[var(--foreground)]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-center gap-2 text-center sm:flex-row sm:gap-3">
          <span className="inline-flex items-center gap-1.5 font-extrabold"><FlaskConical className="text-[var(--brand-strong)]" size={16} aria-hidden="true" /> Demo mode</span>
          <span className="text-[var(--muted)]">No screenshot is uploaded and no AI request is made.</span>
          <Link className="inline-flex min-h-11 items-center gap-1 font-extrabold text-[var(--brand-strong)]" href="/login?next=/dashboard">Start free <ArrowRight size={15} aria-hidden="true" /></Link>
        </div>
      </div>
      <CoachWorkspace demo initialRemaining={5} />
    </main>
  );
}
