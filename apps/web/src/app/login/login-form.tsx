"use client";

import Link from "next/link";
import { CheckCircle2, LoaderCircle, Mail, ShieldCheck } from "lucide-react";
import { useActionState } from "react";
import {
  sendMagicLink,
  type MagicLinkState,
} from "@/app/login/actions";

type LoginFormProps = {
  next: string;
  initialError: string | null;
  initiallySent: boolean;
  isLocalPreview: boolean;
  previewMode: boolean;
};

const INITIAL_MAGIC_LINK_STATE: MagicLinkState = {
  status: "idle",
  message: null,
};

export function LoginForm({ next, initialError, initiallySent, isLocalPreview, previewMode }: LoginFormProps) {
  const initialState: MagicLinkState = initialError
    ? { status: "error", message: initialError }
    : initiallySent
      ? { status: "success", message: "Your secure sign-in link is on its way." }
      : INITIAL_MAGIC_LINK_STATE;
  const [state, formAction, pending] = useActionState(sendMagicLink, initialState);
  const sent = state.status === "success";

  return (
    <div>
      {previewMode ? (
        <div className="alert alert-info mb-5 rounded-2xl p-4 text-xs font-semibold leading-5 sm:text-sm sm:leading-6">
          <span>
            Local preview is active. Enter any email-shaped address, confirm 18+, and Milo will open the demo account without sending an email.
          </span>
        </div>
      ) : null}

      {state.status === "error" ? (
        <div
          className="alert alert-error mb-5 rounded-2xl p-4 text-xs font-semibold leading-5 sm:text-sm sm:leading-6"
          role="alert"
        >
          <span>{state.message}</span>
        </div>
      ) : null}

      {sent ? (
        <section
          aria-labelledby="magic-link-sent-title"
          className="card mb-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-50"
          role="status"
        >
          <div className="flex items-start gap-3">
            <CheckCircle2 aria-hidden="true" className="mt-0.5 shrink-0 text-emerald-700 dark:text-emerald-300" size={22} />
            <div>
              <h2 className="font-extrabold" id="magic-link-sent-title">Check your inbox</h2>
              <p className="mt-1 text-sm leading-6">{state.message}</p>
            </div>
          </div>
          <ol className="mt-4 space-y-2 border-t border-emerald-200 pt-4 text-sm leading-6 dark:border-emerald-800">
            <li><strong>1.</strong> Open the email from Milo and select the sign-in link.</li>
            <li><strong>2.</strong> {isLocalPreview ? "For this local preview, use this same computer while Milo is running." : "Open the link in this browser to return securely to Milo."}</li>
            <li><strong>3.</strong> If it is missing, check spam or wait a minute before resending.</li>
          </ol>
        </section>
      ) : null}

      <form action={formAction} aria-describedby="sign-in-privacy-note" className="space-y-4">
        <input name="next" type="hidden" value={next} />
        <label className="block" htmlFor="login-email">
          <span className="mb-2 block text-sm font-bold">Email address</span>
          <span className="relative block">
            <Mail aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={19} />
            <input
              autoComplete="email"
              className="input input-bordered min-h-12 w-full rounded-2xl pl-12 pr-4 text-sm sm:text-base disabled:cursor-wait disabled:opacity-60"
              disabled={pending}
              id="login-email"
              inputMode="email"
              name="email"
              placeholder="you@example.com"
              required
              type="email"
            />
          </span>
        </label>

        <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-2xl border border-[var(--line)] p-3.5 text-xs leading-5 sm:text-sm sm:leading-6 transition hover:bg-[var(--surface-soft)]">
          <input
            className="checkbox checkbox-primary checkbox-sm mt-0.5 shrink-0 rounded"
            disabled={pending}
            name="adultConfirmed"
            required
            type="checkbox"
          />
          <span>
            I confirm that I am 18 or older and agree to Milo&apos;s{" "}
            <Link className="font-bold underline underline-offset-2" href="/terms">Terms</Link>.
          </span>
        </label>

        <button
          className="btn btn-primary premium-button flex min-h-13 w-full items-center justify-center gap-2 rounded-full px-6 font-extrabold text-white disabled:cursor-wait disabled:opacity-60"
          disabled={pending}
          type="submit"
        >
          {pending ? (
            <>
              <LoaderCircle aria-hidden="true" className="animate-spin" size={19} />
              <span>Sending secure link…</span>
            </>
          ) : sent ? (
            "Resend sign-in link"
          ) : (
            "Email me a sign-in link"
          )}
        </button>
      </form>

      <p className="mt-6 flex items-start justify-center gap-2 text-center text-xs leading-5 text-[var(--muted)]" id="sign-in-privacy-note">
        <ShieldCheck aria-hidden="true" className="mt-0.5 shrink-0" size={15} />
        <span>Screenshot content is never included in authentication.</span>
      </p>
    </div>
  );
}
