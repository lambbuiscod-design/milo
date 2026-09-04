"use client";

import { useState } from "react";

export function DeleteAccountForm() {
  const [confirmed, setConfirmed] = useState(false);

  return (
    <form action="/api/account/delete" className="mt-5" method="post">
      <label className="flex max-w-xl cursor-pointer items-start gap-3 text-xs leading-5 sm:text-sm sm:leading-6 text-[var(--muted)]">
        <input
          checked={confirmed}
          className="checkbox checkbox-error checkbox-sm mt-0.5 shrink-0 rounded"
          onChange={(event) => setConfirmed(event.target.checked)}
          type="checkbox"
        />
        <span>I understand this permanently deletes my Milo data and cannot be undone.</span>
      </label>
      <button
        className="btn btn-error btn-outline mt-4 min-h-11 rounded-full px-5 text-xs sm:text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!confirmed}
        type="submit"
      >
        Delete my account permanently
      </button>
    </form>
  );
}
