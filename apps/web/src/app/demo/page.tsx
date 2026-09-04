import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FlaskConical } from "lucide-react";
import { CoachWorkspace } from "@/components/coach-workspace";

export const metadata: Metadata = { title: "Interactive demo" };

export default function DemoPage() {
  return (
    <main className="outline-none" id="main-content" tabIndex={-1}>
      <div className="border-b border-[var(--brand)]/15 bg-[var(--brand-soft)] px-4 py-2.5 text-xs text-[var(--foreground)] sm:text-sm">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-center gap-2 text-center sm:flex-row sm:gap-3">
          <span className="badge badge-neutral inline-flex items-center gap-1.5 font-extrabold uppercase tracking-wider">
            <FlaskConical className="text-[var(--brand-strong)]" size={14} aria-hidden="true" />
            <span>Demo mode</span>
          </span>
          <span className="text-[var(--muted)]">No screenshot is uploaded and no AI request is made.</span>
          <Link
            className="btn btn-ghost btn-xs inline-flex items-center gap-1 font-extrabold text-[var(--brand-strong)] hover:bg-[var(--surface)]"
            href="/login?next=/dashboard"
          >
            <span>Start free</span>
            <ArrowRight size={13} aria-hidden="true" />
          </Link>
        </div>
      </div>
      <CoachWorkspace demo initialRemaining={5} />
    </main>
  );
}
