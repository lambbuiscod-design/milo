"use client";

import { useEffect, useRef, useState } from "react";
import { KeyRound, LoaderCircle, LogOut, RefreshCw, ShieldCheck } from "lucide-react";
import { signOut } from "@/app/login/actions";
import { createClient } from "@/lib/supabase/client";
import {
  isCompleteTotpCode,
  normalizeTotpCode,
  safeFactorLabel,
  type PublicTotpFactor,
} from "@/lib/supabase/mfa";

export function MfaChallengeForm({
  next,
  initialUnavailable = false,
}: {
  next: string;
  initialUnavailable?: boolean;
}) {
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  const [factors, setFactors] = useState<PublicTotpFactor[]>([]);
  const [selectedFactorId, setSelectedFactorId] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(
    initialUnavailable ? "Milo could not check your verification status. Try again." : null,
  );

  function getSupabase() {
    supabaseRef.current ??= createClient();
    return supabaseRef.current;
  }

  async function loadFactors() {
    setLoading(true);
    setError(null);
    try {
      const { data, error: factorsError } = await getSupabase().auth.mfa.listFactors();
      if (factorsError) throw factorsError;
      const verified = data.totp as PublicTotpFactor[];
      setFactors(verified);
      setSelectedFactorId((current) =>
        verified.some((factor) => factor.id === current) ? current : (verified[0]?.id ?? ""),
      );
      if (verified.length === 0) {
        setError("No verified authenticator is available for this account. Sign out and contact support if this persists.");
      }
    } catch {
      setError("Milo could not load your authenticator. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    void Promise.resolve()
      .then(() => getSupabase().auth.mfa.listFactors())
      .then(({ data, error: factorsError }) => {
        if (!active) return;
        if (factorsError) throw factorsError;
        const verified = data.totp as PublicTotpFactor[];
        setFactors(verified);
        setSelectedFactorId(verified[0]?.id ?? "");
        setError(
          verified.length === 0
            ? "No verified authenticator is available for this account. Sign out and contact support if this persists."
            : null,
        );
      })
      .catch(() => {
        if (active) setError("Milo could not load your authenticator. Check your connection and try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFactorId || !isCompleteTotpCode(code)) {
      setError("Enter the six-digit code from your authenticator app.");
      return;
    }

    setVerifying(true);
    setError(null);
    try {
      const { error: verifyError } = await getSupabase().auth.mfa.challengeAndVerify({
        factorId: selectedFactorId,
        code,
      });
      if (verifyError) throw verifyError;
      setCode("");
      window.location.replace(next);
    } catch {
      setError("That code was not accepted. Wait for a new code in your authenticator app and try again.");
      setCode("");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div>
      <div className="alert alert-success flex items-start gap-3 rounded-2xl bg-emerald-50/80 p-3.5 text-xs leading-5 text-emerald-950 dark:bg-emerald-950/70 dark:text-emerald-100 sm:text-sm sm:leading-6">
        <ShieldCheck className="mt-0.5 shrink-0 text-[var(--success)]" size={18} aria-hidden="true" />
        <p>Your passwordless email sign-in is complete. This code verifies the authenticator in your possession.</p>
      </div>

      {loading ? (
        <div
          className="mt-6 flex min-h-36 items-center justify-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--background)] text-xs font-bold text-[var(--muted)] sm:text-sm"
          role="status"
        >
          <LoaderCircle className="animate-spin" size={18} aria-hidden="true" />
          <span>Loading your authenticator…</span>
        </div>
      ) : factors.length > 0 ? (
        <form className="mt-6" onSubmit={verify}>
          {factors.length > 1 ? (
            <fieldset>
              <legend className="text-sm font-extrabold">Choose an authenticator</legend>
              <div className="mt-2 grid gap-2">
                {factors.map((factor, index) => (
                  <label
                    className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-bold transition ${selectedFactorId === factor.id ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-strong)]" : "border-[var(--line)] bg-[var(--background)]"}`}
                    key={factor.id}
                  >
                    <input
                      checked={selectedFactorId === factor.id}
                      className="radio radio-primary radio-sm"
                      name="factor"
                      onChange={() => setSelectedFactorId(factor.id)}
                      type="radio"
                      value={factor.id}
                    />
                    <span>{safeFactorLabel(factor, index)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          <label className="mt-5 block text-sm font-extrabold" htmlFor="totp-code">
            Six-digit code
          </label>
          <div className="relative mt-2">
            <KeyRound
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]"
              size={19}
              aria-hidden="true"
            />
            <input
              autoComplete="one-time-code"
              autoFocus
              className="input input-bordered min-h-13 w-full rounded-2xl pl-12 pr-4 font-mono text-xl font-black tracking-[.28em] transition focus:border-[var(--brand)]"
              disabled={verifying}
              id="totp-code"
              inputMode="numeric"
              maxLength={6}
              onChange={(event) => setCode(normalizeTotpCode(event.target.value))}
              pattern="[0-9]{6}"
              placeholder="000000"
              required
              value={code}
            />
          </div>

          {error ? (
            <div className="alert alert-error mt-4 rounded-2xl p-3.5 text-xs font-semibold leading-5 sm:text-sm" role="alert">
              <span>{error}</span>
            </div>
          ) : null}

          <button
            className="btn btn-primary premium-button mt-5 flex min-h-13 w-full items-center justify-center gap-2 rounded-full px-6 font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={verifying || !isCompleteTotpCode(code)}
            type="submit"
          >
            {verifying ? (
              <>
                <LoaderCircle className="animate-spin" size={18} aria-hidden="true" />
                <span>Verifying…</span>
              </>
            ) : (
              <>
                <ShieldCheck size={18} aria-hidden="true" />
                <span>Verify and continue</span>
              </>
            )}
          </button>
        </form>
      ) : (
        <div className="mt-6">
          {error ? (
            <div className="alert alert-error rounded-2xl p-3.5 text-xs font-semibold leading-5 sm:text-sm" role="alert">
              <span>{error}</span>
            </div>
          ) : null}
          <button
            className="btn btn-outline mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-full border-[var(--line)] px-5 font-bold"
            onClick={() => void loadFactors()}
            type="button"
          >
            <RefreshCw size={16} aria-hidden="true" />
            <span>Try again</span>
          </button>
        </div>
      )}

      <form action={signOut} className="mt-5 text-center">
        <button
          className="btn btn-ghost btn-sm inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-xs font-bold text-[var(--muted)] hover:bg-[var(--background)] hover:text-[var(--foreground)] sm:text-sm"
          type="submit"
        >
          <LogOut size={15} aria-hidden="true" />
          <span>Sign out instead</span>
        </button>
      </form>
    </div>
  );
}
