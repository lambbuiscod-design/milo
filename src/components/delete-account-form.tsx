"use client";

import { useState } from "react";

export function DeleteAccountForm() {
  const [confirmed, setConfirmed] = useState(false);
  return <form action="/api/account/delete" className="mt-5" method="post">
    <label className="flex max-w-xl items-start gap-3 text-sm leading-6 text-[var(--muted)]">
      <input className="mt-1 size-5 accent-red-600" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} type="checkbox" />
      <span>I understand this permanently deletes my Milo data and cannot be undone.</span>
    </label>
    <button className="mt-4 min-h-11 rounded-full border border-red-300 px-5 font-bold text-red-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-300" disabled={!confirmed} type="submit">Delete my account permanently</button>
  </form>;
}
