"use client";

import { MiloCat } from "@/components/milo-cat";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="grid min-h-screen place-items-center px-5 outline-none" id="main-content" tabIndex={-1}>
      <div className="max-w-md text-center">
        <MiloCat className="mx-auto h-28 w-28" mood="thinking" />
        <h1 className="font-display mt-4 text-3xl font-semibold sm:text-4xl">Milo dropped the yarn.</h1>
        <p className="mt-3 text-sm text-[var(--muted)] sm:text-base">
          Something unexpected happened. Your screenshot was not saved.
        </p>
        <button
          className="btn btn-primary premium-button mt-6 min-h-12 rounded-full px-6 font-extrabold text-white"
          onClick={reset}
          type="button"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
