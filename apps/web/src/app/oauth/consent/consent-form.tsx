"use client";

import { useActionState } from "react";
import { LoaderCircle, ShieldCheck } from "lucide-react";
import { decideAuthorization, type ConsentActionState } from "@/app/oauth/consent/actions";

type ConsentFormProps = {
  authorizationId: string;
  clientName: string;
  scopes: string[];
};

const INITIAL_STATE: ConsentActionState = { status: "idle", message: null };

export function ConsentForm({ authorizationId, clientName, scopes }: ConsentFormProps) {
  const [state, formAction, pending] = useActionState(decideAuthorization, INITIAL_STATE);
  return (
    <form action={formAction} className="mt-7 space-y-5">
      <input name="authorization_id" type="hidden" value={authorizationId} />
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-soft)] p-4">
        <p className="text-xs leading-5 sm:text-sm sm:leading-6 text-[var(--muted)]">
          <strong className="text-[var(--foreground)]">{clientName}</strong> is requesting access to your Milo account.
        </p>
        <ul className="mt-3 space-y-2 text-xs leading-5 sm:text-sm sm:leading-6">
          {scopes.map((scope) => (
            <li className="flex items-center gap-2" key={scope}>
              <ShieldCheck aria-hidden="true" className="text-[var(--brand)]" size={16} />
              <span>
                {scope === "openid"
                  ? "Sign you in securely"
                  : scope === "email"
                    ? "See your verified email"
                    : "See your basic profile"}
              </span>
            </li>
          ))}
        </ul>
      </div>
      {state.status === "error" ? (
        <div className="alert alert-error rounded-2xl p-3 text-xs font-semibold sm:text-sm" role="alert">
          <span>{state.message}</span>
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          className="btn btn-outline min-h-12 rounded-full border-[var(--line)] px-5 font-extrabold transition hover:bg-[var(--surface-soft)] disabled:cursor-wait disabled:opacity-60"
          disabled={pending}
          name="decision"
          type="submit"
          value="deny"
        >
          Deny
        </button>
        <button
          className="btn btn-primary premium-button flex min-h-12 items-center justify-center gap-2 rounded-full px-5 font-extrabold text-white disabled:cursor-wait disabled:opacity-60"
          disabled={pending}
          name="decision"
          type="submit"
          value="approve"
        >
          {pending ? <LoaderCircle aria-hidden="true" className="animate-spin" size={17} /> : null}
          <span>Approve Milo</span>
        </button>
      </div>
      <p className="text-center text-xs leading-5 text-[var(--muted)]">
        You can revoke access later from your account settings.
      </p>
    </form>
  );
}
