"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Check,
  Clipboard,
  KeyRound,
  LoaderCircle,
  Plus,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Trash2,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  isCompleteTotpCode,
  normalizeTotpCode,
  safeFactorLabel,
  type PublicTotpFactor,
} from "@/lib/supabase/mfa";

type Enrollment = {
  factorId: string;
  qrCode: string;
  secret: string;
};

function factorDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "Date unavailable";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

export function MfaSecurityPanel({ demoMode = false }: { demoMode?: boolean }) {
  const router = useRouter();
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  const [factors, setFactors] = useState<PublicTotpFactor[]>([]);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(!demoMode);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function getSupabase() {
    supabaseRef.current ??= createClient();
    return supabaseRef.current;
  }

  async function loadFactors() {
    if (demoMode) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: factorsError } = await getSupabase().auth.mfa.listFactors();
      if (factorsError) throw factorsError;
      setFactors(data.totp as PublicTotpFactor[]);
    } catch {
      setError("Milo could not load your security settings. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (demoMode) return;
    let active = true;
    void Promise.resolve()
      .then(() => getSupabase().auth.mfa.listFactors())
      .then(({ data, error: factorsError }) => {
        if (!active) return;
        if (factorsError) throw factorsError;
        setFactors(data.totp as PublicTotpFactor[]);
      })
      .catch(() => {
        if (active) setError("Milo could not load your security settings. Check your connection and try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [demoMode]);

  async function startEnrollment() {
    setBusy(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const { data: existing, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) throw listError;

      const stale = existing.all.filter(
        (factor) => factor.factor_type === "totp" && factor.status === "unverified",
      );
      for (const factor of stale) {
        const { error: cleanupError } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
        if (cleanupError) throw cleanupError;
      }

      const suffix = crypto.randomUUID().slice(0, 6);
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `Milo authenticator • ${suffix}`,
      });
      if (enrollError) throw enrollError;
      setEnrollment({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
      setCode("");
      setCopied(false);
    } catch {
      setError("Milo could not start authenticator setup. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  async function cancelEnrollment() {
    if (!enrollment) return;
    setBusy(true);
    setError(null);
    try {
      const { error: cancelError } = await getSupabase().auth.mfa.unenroll({
        factorId: enrollment.factorId,
      });
      if (cancelError) throw cancelError;
      setEnrollment(null);
      setCode("");
      setCopied(false);
    } catch {
      setError("Milo could not cancel this setup. Retry before leaving the page.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyEnrollment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enrollment || !isCompleteTotpCode(code)) {
      setError("Enter the six-digit code from your authenticator app.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { error: verifyError } = await getSupabase().auth.mfa.challengeAndVerify({
        factorId: enrollment.factorId,
        code,
      });
      if (verifyError) throw verifyError;

      setEnrollment(null);
      setCode("");
      setCopied(false);
      router.push("/account?mfa=enabled");
    } catch {
      setCode("");
      setError("That code was not accepted. Wait for a new code and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copySecret() {
    if (!enrollment) return;
    try {
      await navigator.clipboard.writeText(enrollment.secret);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Copying was blocked by your browser. Select the setup key manually.");
    }
  }

  async function removeFactor(factorId: string) {
    setBusy(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const { data: assurance, error: assuranceError } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assuranceError || !assurance) throw assuranceError ?? new Error("AAL unavailable");
      if (assurance.currentLevel !== "aal2") {
        const destination = encodeURIComponent("/account?mfa=remove");
        router.push(`/mfa?next=${destination}`);
        return;
      }

      const { error: removeError } = await supabase.auth.mfa.unenroll({ factorId });
      if (removeError) throw removeError;
      const remaining = factors.filter((factor) => factor.id !== factorId);
      setFactors(remaining);
      setConfirmRemoveId(null);

      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        await supabase.auth.signOut({ scope: "local" });
        router.push("/login");
        return;
      }

      const destination =
        remaining.length > 0
          ? `/mfa?next=${encodeURIComponent("/account?mfa=removed")}`
          : "/account?mfa=removed";
      router.push(destination);
    } catch {
      setError("Milo could not remove that authenticator. Verify again and retry.");
    } finally {
      setBusy(false);
    }
  }

  if (demoMode) {
    return (
      <section
        className="card card-shadow mt-6 rounded-[1.75rem] border border-[var(--line)] bg-[var(--surface)] p-6 sm:p-8"
        aria-labelledby="mfa-security-title"
      >
        <h2 className="flex items-center gap-2 text-lg font-extrabold sm:text-xl" id="mfa-security-title">
          <ShieldCheck className="text-[var(--brand)]" size={20} />
          <span>Two-step verification</span>
        </h2>
        <p className="mt-3 text-sm leading-7 text-[var(--muted)] sm:text-base">
          Authenticator setup is disabled only in Milo&apos;s local automated-test mode. It is active for real Supabase accounts.
        </p>
      </section>
    );
  }

  return (
    <section
      className="card card-shadow mt-6 rounded-[1.75rem] border border-[var(--line)] bg-[var(--surface)] p-6 sm:p-8"
      aria-labelledby="mfa-security-title"
    >
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="badge badge-neutral mb-2 font-extrabold uppercase tracking-wider text-[var(--brand-strong)]">
            Account security
          </div>
          <h2 className="mt-1 flex items-center gap-2 text-lg font-extrabold sm:text-xl" id="mfa-security-title">
            <ShieldCheck className="text-[var(--success)]" size={20} />
            <span>Two-step verification</span>
          </h2>
          <p className="mt-2.5 max-w-2xl text-sm leading-6 text-[var(--muted)] sm:text-base sm:leading-7">
            Require a six-digit authenticator code after email sign-in. Once enabled, Milo blocks the dashboard, billing, analyses and account changes until the code is confirmed.
          </p>
        </div>
        <span
          className={`badge badge-sm font-extrabold uppercase tracking-wider ${factors.length > 0 ? "badge-success" : "badge-neutral text-[var(--muted)]"}`}
        >
          {factors.length > 0 ? "Enabled" : "Not enabled"}
        </span>
      </div>

      {loading ? (
        <div
          className="mt-6 flex min-h-24 items-center justify-center gap-2 rounded-2xl bg-[var(--background)] text-xs font-bold text-[var(--muted)] sm:text-sm"
          role="status"
        >
          <LoaderCircle className="animate-spin" size={18} aria-hidden="true" />
          <span>Loading security settings…</span>
        </div>
      ) : null}

      {!loading && factors.length > 0 ? (
        <div className="mt-6 space-y-3">
          {factors.map((factor, index) => (
            <article
              className="card rounded-2xl border border-[var(--line)] bg-[var(--background)] p-4"
              key={factor.id}
            >
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand-strong)]">
                    <Smartphone size={20} aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-extrabold">{safeFactorLabel(factor, index)}</p>
                    <p className="text-xs text-[var(--muted)]">Added {factorDate(factor.created_at)}</p>
                  </div>
                </div>
                {confirmRemoveId === factor.id ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-red-700 dark:text-red-300">Remove this factor?</span>
                    <button
                      className="btn btn-error btn-sm rounded-full text-white disabled:opacity-60"
                      disabled={busy}
                      onClick={() => void removeFactor(factor.id)}
                      type="button"
                    >
                      Yes, remove
                    </button>
                    <button
                      aria-label="Cancel factor removal"
                      className="btn btn-ghost btn-circle btn-sm border border-[var(--line)]"
                      disabled={busy}
                      onClick={() => setConfirmRemoveId(null)}
                      type="button"
                    >
                      <X size={15} aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <button
                    className="btn btn-ghost btn-sm inline-flex items-center gap-1.5 rounded-full text-xs font-bold text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950"
                    disabled={busy || Boolean(enrollment)}
                    onClick={() => setConfirmRemoveId(factor.id)}
                    type="button"
                  >
                    <Trash2 size={15} aria-hidden="true" />
                    <span>Remove</span>
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {enrollment ? (
        <div className="card mt-6 rounded-3xl border border-[var(--brand)]/30 bg-[var(--brand-soft)]/55 p-4 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="badge badge-neutral text-xs font-black uppercase tracking-wider text-[var(--brand-strong)]">
                Private setup
              </div>
              <h3 className="mt-1 text-base font-extrabold sm:text-lg">Scan with your authenticator app</h3>
            </div>
            <button
              aria-label="Cancel authenticator setup"
              className="btn btn-ghost btn-circle btn-sm border border-[var(--line)] bg-[var(--surface)]"
              disabled={busy}
              onClick={() => void cancelEnrollment()}
              type="button"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <p className="mt-2 text-xs leading-5 text-[var(--muted)] sm:text-sm sm:leading-6">
            Use 1Password, Authy, Google Authenticator, Apple Passwords or another TOTP app. The QR and key stay in this browser memory and go directly to Supabase Auth.
          </p>
          <div className="mt-5 grid gap-5 sm:grid-cols-[15rem_1fr] sm:items-center">
            <div className="mx-auto overflow-hidden rounded-2xl border border-white/70 bg-white p-3 shadow-sm">
              <Image
                alt="QR code for the Milo authenticator factor"
                height={216}
                priority
                src={enrollment.qrCode}
                unoptimized
                width={216}
              />
            </div>
            <div>
              <p className="text-sm font-extrabold">Can&apos;t scan it?</p>
              <p className="mt-1 text-xs text-[var(--muted)]">Enter this one-time setup key manually. Treat it like a password.</p>
              <div className="mt-2 flex items-stretch gap-2">
                <code className="min-w-0 flex-1 overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 text-xs font-bold tracking-[.08em]">
                  {enrollment.secret}
                </code>
                <button
                  aria-label="Copy setup key"
                  className="btn btn-ghost grid w-12 shrink-0 place-items-center rounded-xl border border-[var(--line)] bg-[var(--surface)]"
                  onClick={() => void copySecret()}
                  type="button"
                >
                  {copied ? (
                    <Check size={18} className="text-[var(--success)]" aria-hidden="true" />
                  ) : (
                    <Clipboard size={18} aria-hidden="true" />
                  )}
                </button>
              </div>

              <form className="mt-5" onSubmit={verifyEnrollment}>
                <label className="text-sm font-extrabold" htmlFor="enrollment-code">
                  Confirm the six-digit code
                </label>
                <div className="relative mt-2">
                  <KeyRound
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]"
                    size={18}
                    aria-hidden="true"
                  />
                  <input
                    autoComplete="one-time-code"
                    className="input input-bordered min-h-12 w-full rounded-2xl bg-[var(--surface)] pl-11 pr-4 font-mono text-lg font-black tracking-[.28em] focus:border-[var(--brand)]"
                    disabled={busy}
                    id="enrollment-code"
                    inputMode="numeric"
                    maxLength={6}
                    onChange={(event) => setCode(normalizeTotpCode(event.target.value))}
                    pattern="[0-9]{6}"
                    placeholder="000000"
                    required
                    value={code}
                  />
                </div>
                <button
                  className="btn btn-primary mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-5 font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={busy || !isCompleteTotpCode(code)}
                  type="submit"
                >
                  {busy ? (
                    <>
                      <LoaderCircle className="animate-spin" size={18} aria-hidden="true" />
                      <span>Verifying…</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={18} aria-hidden="true" />
                      <span>Enable authenticator</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : !loading ? (
        <button
          className="btn btn-primary mt-6 inline-flex min-h-12 items-center gap-2 rounded-full px-5 font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-60"
          disabled={busy}
          onClick={() => void startEnrollment()}
          type="button"
        >
          {busy ? (
            <LoaderCircle className="animate-spin" size={18} aria-hidden="true" />
          ) : (
            <Plus size={18} aria-hidden="true" />
          )}
          <span>{factors.length > 0 ? "Add backup authenticator" : "Set up authenticator"}</span>
        </button>
      ) : null}

      {error ? (
        <div
          className="alert alert-error mt-5 flex items-start justify-between gap-3 rounded-2xl p-4 text-xs font-semibold sm:text-sm"
          role="alert"
        >
          <p>{error}</p>
          {!enrollment ? (
            <button
              aria-label="Reload security settings"
              className="btn btn-ghost btn-circle btn-sm shrink-0"
              disabled={busy}
              onClick={() => void loadFactors()}
              type="button"
            >
              <RefreshCw size={16} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="alert alert-warning mt-6 rounded-2xl p-4 text-xs leading-5 sm:text-sm sm:leading-6">
        <p>
          <strong>Keep a backup.</strong> Supabase does not issue recovery codes. Add a second authenticator on a separate device or securely store its setup key before you lose access to your only factor.
        </p>
      </div>
    </section>
  );
}
