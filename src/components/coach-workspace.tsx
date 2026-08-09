"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useSyncExternalStore, type DragEvent } from "react";
import {
  ArrowRight,
  Check,
  Clipboard,
  FileImage,
  Heart,
  ImagePlus,
  Info,
  LoaderCircle,
  MessageSquareHeart,
  PencilLine,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  UploadCloud,
  X,
} from "lucide-react";
import { MiloCat } from "@/components/milo-cat";
import {
  MAX_PROCESSED_IMAGE_BYTES,
  validateSelectedImageFile,
} from "@/lib/image-upload";
import type { AnalysisResult } from "@/lib/schemas";

const DEMO_RESULT: AnalysisResult = {
  conversation_status: "clear",
  detected_language: "English",
  brief_context: "A new match is clearly interested in meeting again.",
  warning: null,
  replies: [
    { category: "safe", text: "I had a great time too. I’d definitely be up for doing it again 😊", why_it_works: "Warm and clear without adding pressure." },
    { category: "confident", text: "Definitely. I know a place you’ll love—free Thursday?", why_it_works: "Moves the conversation forward with a concrete, easy plan." },
    { category: "playful", text: "Only if round two includes your dangerously good story selection 😄", why_it_works: "Keeps the chemistry while referencing your shared time." },
  ],
};

const toneOptions = [
  { value: "warm", label: "Warm", detail: "Open & kind" },
  { value: "confident", label: "Confident", detail: "Clear & assured" },
  { value: "playful", label: "Playful", detail: "Light & witty" },
  { value: "direct", label: "Direct", detail: "Simple & honest" },
] as const;

const stages = [
  ["new_match", "New match"],
  ["first_dates", "First dates"],
  ["dating", "Dating"],
  ["relationship", "Relationship"],
  ["conflict", "Conflict or apology"],
] as const;

const categoryMeta = {
  safe: { label: "Safe choice", icon: ShieldCheck, accent: "text-emerald-700 dark:text-emerald-300", surface: "bg-emerald-50 dark:bg-emerald-950/70" },
  confident: { label: "Confident choice", icon: Sparkles, accent: "text-[var(--brand-strong)]", surface: "bg-[var(--brand-soft)]" },
  playful: { label: "Playful choice", icon: Heart, accent: "text-pink-700 dark:text-pink-300", surface: "bg-pink-50 dark:bg-pink-950/60" },
} as const;

const orderedCategories = ["safe", "confident", "playful"] as const;
const RESULTS_TITLE_ID = "milo-analysis-results-title";

function formatFileSize(bytes: number) {
  const megabytes = bytes / (1024 * 1024);
  return `${megabytes.toFixed(megabytes >= 1 ? 1 : 2)} MB`;
}

export function CoachWorkspace({ initialRemaining, demo = false }: { initialRemaining: number; demo?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadButtonRef = useRef<HTMLButtonElement>(null);
  const analyzeButtonRef = useRef<HTMLButtonElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const shouldFocusResultsRef = useRef(false);
  const preparationIdRef = useRef(0);
  const preparationAbortRef = useRef<AbortController | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [tone, setTone] = useState<(typeof toneOptions)[number]["value"]>("warm");
  const [stage, setStage] = useState<(typeof stages)[number][0]>("new_match");
  const [context, setContext] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(demo ? DEMO_RESULT : null);
  const [analysisId, setAnalysisId] = useState<string | null>(demo ? "demo" : null);
  const [remaining, setRemaining] = useState(initialRemaining);
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const hydrated = useSyncExternalStore(() => () => undefined, () => true, () => false);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  useEffect(() => () => {
    preparationIdRef.current += 1;
    preparationAbortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (!result || !shouldFocusResultsRef.current) return;
    shouldFocusResultsRef.current = false;
    window.requestAnimationFrame(() => {
      const results = resultsRef.current;
      if (!results) return;
      results.focus({ preventScroll: true });
      results.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
    });
  }, [analysisId, result]);

  function chooseFile(nextFile?: File) {
    if (!nextFile) return;
    const validationError = validateSelectedImageFile(nextFile);
    if (validationError) {
      setError(validationError);
      return;
    }
    const preparationId = preparationIdRef.current + 1;
    preparationIdRef.current = preparationId;
    preparationAbortRef.current?.abort();
    preparationAbortRef.current = null;
    if (preview) URL.revokeObjectURL(preview);
    setFile(nextFile);
    setUploadFile(null);
    setPreview(URL.createObjectURL(nextFile));
    setError(null);
    setResult(null);
    setAnalysisId(null);

    if (nextFile.size <= MAX_PROCESSED_IMAGE_BYTES) {
      setUploadFile(nextFile);
      setPreparing(false);
      return;
    }

    setPreparing(true);
    const controller = new AbortController();
    preparationAbortRef.current = controller;
    void import("@/lib/client-image-preprocessor")
      .then(({ prepareImageForUpload }) => prepareImageForUpload(nextFile, { signal: controller.signal }))
      .then((prepared) => {
        if (preparationIdRef.current !== preparationId) return;
        setUploadFile(prepared);
      })
      .catch((caught: unknown) => {
        if (preparationIdRef.current !== preparationId) return;
        setUploadFile(null);
        setError(caught instanceof Error ? caught.message : "Milo could not prepare that screenshot. Try another image.");
      })
      .finally(() => {
        if (preparationIdRef.current === preparationId) {
          preparationAbortRef.current = null;
          setPreparing(false);
        }
      });
  }

  function clearFile() {
    preparationIdRef.current += 1;
    preparationAbortRef.current?.abort();
    preparationAbortRef.current = null;
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setFile(null);
    setUploadFile(null);
    setPreparing(false);
    setResult(null);
    setAnalysisId(null);
    setError(null);
    setCopied(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function resetForAnotherAnalysis() {
    setContext("");
    setTone("warm");
    setStage("new_match");
    setCopied(null);
    setError(null);
    if (demo) {
      setResult(null);
      setAnalysisId(null);
    } else {
      clearFile();
    }
    window.requestAnimationFrame(() => {
      (demo ? analyzeButtonRef.current : uploadButtonRef.current)?.focus();
    });
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setDragging(false);
    chooseFile(event.dataTransfer.files?.[0]);
  }

  function openPaywall() {
    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "paywall_viewed",
        surface: "analysis_limit",
      }),
      keepalive: true,
    }).catch(() => undefined);
    window.location.assign("/account?upgrade=1");
  }

  async function analyze() {
    if (demo) {
      setBusy(true);
      setError(null);
      window.setTimeout(() => {
        shouldFocusResultsRef.current = true;
        setResult(DEMO_RESULT);
        setAnalysisId(`demo-${Date.now()}`);
        setBusy(false);
      }, 650);
      return;
    }
    if (remaining <= 0) {
      openPaywall();
      return;
    }
    if (!file) {
      setError("Choose a chat screenshot first.");
      uploadButtonRef.current?.focus();
      return;
    }
    if (preparing) {
      setError("Milo is still preparing that screenshot on your device.");
      return;
    }
    if (!uploadFile) {
      setError("Choose a different screenshot so Milo can prepare it safely.");
      return;
    }

    const body = new FormData();
    body.set("image", uploadFile);
    body.set("tone", tone);
    body.set("relationshipStage", stage);
    body.set("optionalContext", context);
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/analyze", { method: "POST", body });
      const payload = await response.json() as { result?: AnalysisResult; analysisId?: string; error?: string; remaining?: number; code?: string };
      if (!response.ok || !payload.result) {
        if (payload.code === "PAYWALL") {
          openPaywall();
          return;
        }
        if (payload.code === "MFA_REQUIRED") window.location.assign("/mfa?next=/dashboard");
        throw new Error(payload.error ?? "Milo could not analyze that screenshot.");
      }
      shouldFocusResultsRef.current = true;
      setResult(payload.result);
      setAnalysisId(payload.analysisId ?? null);
      if (typeof payload.remaining === "number") setRemaining(payload.remaining);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function copyReply(text: string, category: string) {
    await navigator.clipboard.writeText(text);
    setCopied(category);
    window.setTimeout(() => setCopied(null), 1600);
    if (!demo) {
      void fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "reply_copied", category }),
      }).catch(() => undefined);
    }
  }

  const fileSize = file ? formatFileSize(file.size) : null;
  const preparedFileSize = uploadFile && uploadFile !== file ? formatFileSize(uploadFile.size) : null;
  const resultKey = `${analysisId ?? "result"}:${result?.brief_context ?? ""}`;

  return (
    <div className="relative mx-auto max-w-7xl px-4 py-7 sm:px-8 sm:py-11" aria-busy={busy || preparing}>
      <div className="pointer-events-none absolute right-0 top-0 -z-10 h-72 w-72 rounded-full bg-[var(--brand-fill)]/8 blur-3xl" />
      <header className="mb-8 flex items-start justify-between gap-4 sm:mb-10">
        <div className="max-w-2xl">
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.18em] text-[var(--brand-strong)]"><MessageSquareHeart size={16} aria-hidden="true" /> Milo coach</p>
          <h1 className="font-display mt-2 text-[2.5rem] font-semibold leading-tight tracking-[-.035em] sm:text-5xl">Turn this chat into your next reply.</h1>
          <p className="mt-3 max-w-xl leading-7 text-[var(--muted)]">Share the visible conversation, choose how you want to sound, and keep the final word.</p>
        </div>
        <div className="soft-shadow shrink-0 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-right sm:px-4 sm:py-3">
          <p className="text-[10px] font-black uppercase tracking-[.11em] text-[var(--muted)] sm:text-xs">Analyses left</p>
          <p className="mt-0.5 text-xl font-black text-[var(--brand-strong)] sm:text-2xl">{demo ? "Demo" : remaining}</p>
        </div>
      </header>

      <ol className="mb-6 grid grid-cols-3 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] text-xs font-bold text-[var(--muted)] soft-shadow sm:text-sm" aria-label="Analysis steps">
        {["Add chat", "Choose tone", "Pick a reply"].map((label, index) => (
          <li className={`flex min-h-12 items-center justify-center gap-2 px-2 text-center ${index > 0 ? "border-l border-[var(--line)]" : ""} ${index === 0 || (index === 2 && result) ? "text-[var(--brand-strong)]" : ""}`} key={label}>
            <span className={`hidden h-6 w-6 place-items-center rounded-full text-[11px] sm:grid ${index === 0 || (index === 2 && result) ? "bg-[var(--brand-fill)] text-white" : "bg-[var(--surface-soft)]"}`}>{index + 1}</span>{label}
          </li>
        ))}
      </ol>

      <div className="grid gap-5 lg:grid-cols-[.92fr_1.08fr] lg:gap-6">
        <section className="card-shadow rounded-[1.75rem] border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-6" aria-labelledby="screenshot-title">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[.14em] text-[var(--muted)]">Step 1</p>
              <h2 className="mt-1 flex items-center gap-2 text-lg font-extrabold" id="screenshot-title"><ImagePlus className="text-[var(--brand)]" size={21} aria-hidden="true" /> {demo ? "Example conversation" : "Conversation screenshot"}</h2>
            </div>
            {demo ? <span className="rounded-full bg-[var(--brand-soft)] px-3 py-1.5 text-xs font-bold text-[var(--brand-strong)]">Sample loaded</span> : file ? <span className="rounded-full bg-[var(--brand-soft)] px-3 py-1.5 text-xs font-bold text-[var(--brand-strong)]">{preparing ? "Preparing…" : uploadFile ? "Ready" : "Try another"}</span> : null}
          </div>

          <input ref={inputRef} accept="image/png,image/jpeg,image/webp" aria-label="Choose conversation screenshot" className="sr-only" id="chat-image" onChange={(event) => chooseFile(event.target.files?.[0])} onClick={(event) => { event.currentTarget.value = ""; }} tabIndex={-1} type="file" />
          {demo ? (
            <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--background)]">
              <div className="border-b border-[var(--line)] bg-[var(--surface)] px-4 py-3">
                <p className="text-xs font-black uppercase tracking-[.12em] text-[var(--brand-strong)]">Fictional new match</p>
                <p className="mt-1 text-sm text-[var(--muted)]">A safe sample—no real names or messages.</p>
              </div>
              <div className="space-y-3 p-4 text-sm leading-6">
                <p className="mr-8 rounded-2xl rounded-bl-md border border-[var(--line)] bg-[var(--surface)] px-4 py-3">I had a great time tonight 😊</p>
                <p className="ml-8 rounded-2xl rounded-br-md bg-[var(--brand-fill)] px-4 py-3 text-white">Me too! I was hoping you&apos;d say that.</p>
                <p className="mr-8 rounded-2xl rounded-bl-md border border-[var(--line)] bg-[var(--surface)] px-4 py-3">So… should we do it again?</p>
              </div>
            </div>
          ) : preview ? (
            <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--background)]">
              <div className="relative bg-black/[.04] p-3 dark:bg-white/[.03]">
                <Image alt="Selected conversation screenshot" className="mx-auto max-h-72 w-auto rounded-lg object-contain" height={600} src={preview} unoptimized width={360} />
                <button aria-label="Remove screenshot" className="absolute right-3 top-3 grid h-11 w-11 place-items-center rounded-full bg-[#1d1d35]/85 text-white shadow-lg transition hover:bg-[#1d1d35]" onClick={clearFile} type="button"><X size={18} aria-hidden="true" /></button>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-[var(--line)] px-4 py-3">
                <div className="min-w-0"><p className="truncate text-sm font-bold">{file?.name}</p><p className="text-xs text-[var(--muted)]">{preparing ? `${fileSize} · optimizing privately on your device…` : preparedFileSize ? `${fileSize} · optimized to ${preparedFileSize}` : uploadFile ? `${fileSize} · ready to analyze` : `${fileSize} · choose another screenshot`}</p></div>
                <button className="min-h-11 shrink-0 rounded-full px-3 py-2 text-sm font-extrabold text-[var(--brand-strong)] transition hover:bg-[var(--brand-soft)]" onClick={() => inputRef.current?.click()} type="button">Replace screenshot</button>
              </div>
            </div>
          ) : (
            <button
              ref={uploadButtonRef}
              className={`mt-4 flex min-h-60 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition focus-visible:border-[var(--focus)] focus-visible:bg-[var(--brand-soft)]/60 disabled:cursor-wait disabled:opacity-70 ${dragging ? "border-[var(--brand)] bg-[var(--brand-soft)]" : "border-[var(--line)] bg-[var(--background)] hover:border-[var(--brand)] hover:bg-[var(--brand-soft)]/60"}`}
              disabled={!hydrated}
              onClick={() => inputRef.current?.click()}
              onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
              type="button"
            >
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand-strong)] soft-shadow"><UploadCloud size={27} aria-hidden="true" /></span>
              <span className="mt-4 text-lg font-extrabold">Choose screenshot</span>
              <span className="mt-1 max-w-xs text-sm leading-6 text-[var(--muted)]">Tap to open your camera roll, or drop an image here on desktop.</span>
              <span className="mt-4 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-xs font-bold text-[var(--muted)]">PNG, JPEG or WebP · maximum 8 MB</span>
            </button>
          )}

          <div className="mt-4 flex gap-3 rounded-2xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-950 dark:bg-emerald-950/70 dark:text-emerald-100">
            <ShieldCheck className="mt-0.5 shrink-0 text-[var(--success)]" size={20} aria-hidden="true" />
            <p><strong>Private by design.</strong> Large screenshots are optimized only in your browser. Milo strips metadata during processing and never stores the screenshot or original conversation.</p>
          </div>
        </section>

        <section className="card-shadow rounded-[1.75rem] border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-6" aria-labelledby="direction-title">
          <div>
            <p className="text-xs font-black uppercase tracking-[.14em] text-[var(--muted)]">Step 2</p>
            <h2 className="mt-1 flex items-center gap-2 text-lg font-extrabold" id="direction-title"><Sparkles className="text-[var(--brand)]" size={21} aria-hidden="true" /> Shape your reply</h2>
          </div>

          <fieldset className="mt-5" disabled={busy}>
            <label className="text-sm font-extrabold" htmlFor="stage">Relationship stage</label>
            <div className="relative mt-2">
              <select className="min-h-13 w-full appearance-none rounded-2xl border border-[var(--line)] bg-[var(--background)] px-4 pr-10 font-semibold transition focus:border-[var(--brand)]" id="stage" onChange={(event) => setStage(event.target.value as typeof stage)} value={stage}>
                {stages.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <ArrowRight className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 rotate-90 text-[var(--muted)]" size={16} aria-hidden="true" />
            </div>

            <p className="mt-5 text-sm font-extrabold" id="tone-label">Desired tone</p>
            <div aria-labelledby="tone-label" className="mt-2 grid grid-cols-2 gap-2" role="group">
              {toneOptions.map((option) => {
                const selected = tone === option.value;
                return (
                  <button aria-pressed={selected} className={`min-h-16 rounded-2xl border px-3 py-2.5 text-left transition ${selected ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-strong)] shadow-sm" : "border-[var(--line)] hover:border-[var(--brand)]/50 hover:bg-[var(--background)]"}`} key={option.value} onClick={() => setTone(option.value)} type="button">
                    <span className="block text-sm font-extrabold">{option.label}</span><span className={`mt-0.5 block text-xs ${selected ? "text-[var(--brand-strong)]/75" : "text-[var(--muted)]"}`}>{option.detail}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
              <label className="text-sm font-extrabold" htmlFor="context">Optional context</label>
              <span className="text-xs font-semibold text-[var(--muted)]">{context.length}/500</span>
            </div>
            <textarea aria-describedby="context-help" className="mt-2 min-h-28 w-full resize-y rounded-2xl border border-[var(--line)] bg-[var(--background)] p-4 leading-6 transition placeholder:text-[var(--muted)]/75 focus:border-[var(--brand)]" id="context" maxLength={500} onChange={(event) => setContext(event.target.value)} placeholder="Example: We met yesterday and I want to suggest a second date." value={context} />
            <p className="mt-2 flex items-center gap-1.5 text-xs leading-5 text-[var(--muted)]" id="context-help"><Info size={13} aria-hidden="true" /> Don&apos;t add names, phone numbers or details Milo doesn&apos;t need.</p>
          </fieldset>

          {error ? <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold leading-6 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200" role="alert">{error}</p> : null}

          <button ref={analyzeButtonRef} className="premium-button relative mt-5 flex min-h-14 w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-[var(--brand-fill)] px-6 font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none" disabled={busy || preparing} onClick={analyze} type="button">
            {preparing ? <><LoaderCircle className="animate-spin" size={20} aria-hidden="true" /> <span role="status">Preparing screenshot…</span></> : busy ? <><MiloCat className="milo-bob h-10 w-10" mood="thinking" /> <span role="status">Milo is reading carefully…</span></> : <><MessageSquareHeart size={20} aria-hidden="true" /> {remaining <= 0 && !demo ? "View upgrade options" : "Analyze conversation"}</>}
          </button>
          <p className="mt-3 text-center text-xs leading-5 text-[var(--muted)]">Milo reads only after you press this button. Nothing is sent to another app.</p>
        </section>
      </div>

      {result ? (
        <div ref={resultsRef} aria-labelledby={RESULTS_TITLE_ID} className="scroll-mt-24 rounded-[2rem] outline-none focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-4 focus-visible:outline-[var(--focus)]" role="region" tabIndex={-1}>
          <Results
            key={resultKey}
            analysisId={analysisId}
            result={result}
            copied={copied}
            onCopy={copyReply}
            onTryTone={() => { setResult(null); window.requestAnimationFrame(() => analyzeButtonRef.current?.focus()); }}
            onReset={resetForAnotherAnalysis}
            demo={demo}
          />
        </div>
      ) : null}
    </div>
  );
}

function Results({ analysisId, result, copied, onCopy, onTryTone, onReset, demo }: {
  analysisId: string | null;
  result: AnalysisResult;
  copied: string | null;
  onCopy: (text: string, category: string) => Promise<void>;
  onTryTone: () => void;
  onReset: () => void;
  demo: boolean;
}) {
  const [texts, setTexts] = useState(() => Object.fromEntries(result.replies.map((reply) => [reply.category, reply.text])) as Record<string, string>);
  const [feedbackState, setFeedbackState] = useState<Record<string, "helpful" | "not_helpful">>({});
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<{ category: string; message: string } | null>(null);

  async function handleCopy(text: string, category: string) {
    setCopyError(null);
    try {
      await onCopy(text, category);
    } catch {
      setCopyError({
        category,
        message: "Milo could not access your clipboard. Select the reply text and copy it manually.",
      });
    }
  }

  if (result.conversation_status === "unsafe") {
    return (
      <section className="mt-8 rounded-[1.75rem] border border-amber-300 bg-amber-50 p-5 text-amber-950 soft-shadow dark:bg-amber-950 dark:text-amber-100 sm:p-7" aria-live="polite">
        <div className="flex flex-col gap-4 sm:flex-row">
          <MiloCat className="h-20 w-20 shrink-0" mood="thinking" />
          <div><p className="text-xs font-black uppercase tracking-[.14em] text-amber-700 dark:text-amber-300">Safety first</p><h2 className="mt-1 text-xl font-extrabold" id={RESULTS_TITLE_ID}>This needs care, not a clever reply.</h2><p className="mt-2 max-w-3xl leading-7">{result.warning ?? "Milo cannot help produce this message. Consider stepping away and contacting appropriate real-world support if anyone is in danger."}</p></div>
        </div>
      </section>
    );
  }

  async function submitFeedback(category: string, value: "helpful" | "not_helpful") {
    setFeedbackError(null);
    try {
      if (!demo && analysisId) {
        const response = await fetch("/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ analysisId, category, value }),
        });
        if (!response.ok) throw new Error("Feedback request failed");
      }
      setFeedbackState((current) => ({ ...current, [category]: value }));
    } catch {
      setFeedbackError("Milo could not save that feedback. Please try again.");
    }
  }

  return (
    <section className="mt-12 scroll-mt-24" aria-live="polite">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.18em] text-[var(--brand-strong)]"><Check className="rounded-full bg-[var(--brand-fill)] p-0.5 text-white" size={17} aria-hidden="true" /> Three ways forward</p>
          <h2 className="font-display mt-2 text-3xl font-semibold tracking-[-.025em] sm:text-4xl" id={RESULTS_TITLE_ID}>Pick one, then make it yours.</h2>
          <p className="mt-2 max-w-2xl leading-7 text-[var(--muted)]">{result.brief_context}</p>
          {result.warning ? <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-200">{result.warning}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-bold transition hover:border-[var(--brand)]" onClick={onTryTone} type="button"><PencilLine size={16} aria-hidden="true" /> Try another tone</button>
          <button className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-bold text-[var(--brand-strong)] transition hover:bg-[var(--brand-soft)]" onClick={onReset} type="button"><RotateCcw size={16} aria-hidden="true" /> {demo ? "Replay demo" : "Analyze another screenshot"}</button>
        </div>
      </div>

      {feedbackError ? <p className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200" role="alert">{feedbackError}</p> : null}
      <div className="grid gap-4 lg:grid-cols-3">
        {orderedCategories.map((category) => {
          const reply = result.replies.find((item) => item.category === category);
          if (!reply) return null;
          const text = texts[category] ?? "";
          const meta = categoryMeta[category];
          const Icon = meta.icon;
          const selectedFeedback = feedbackState[category];

          return (
            <article className="interactive-card flex flex-col rounded-[1.65rem] border border-[var(--line)] bg-[var(--surface)] p-5 soft-shadow" key={category}>
              <div className="flex items-center justify-between gap-3">
                <p className={`flex items-center gap-2 text-xs font-black uppercase tracking-[.13em] ${meta.accent}`}><span className={`grid h-8 w-8 place-items-center rounded-xl ${meta.surface}`}><Icon size={16} aria-hidden="true" /></span>{meta.label}</p>
                <span className="rounded-full bg-[var(--background)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--muted)]">Editable</span>
              </div>
              <textarea aria-label={`${category} reply`} className="mt-4 min-h-36 w-full resize-y rounded-2xl border border-transparent bg-[var(--background)] p-4 font-semibold leading-7 transition focus:border-[var(--brand)]" maxLength={280} onChange={(event) => setTexts((current) => ({ ...current, [category]: event.target.value }))} value={text} />
              <p className="mt-2 text-right text-xs font-semibold text-[var(--muted)]">{text.length}/280</p>
              <div className={`mt-4 flex-1 rounded-2xl p-4 ${meta.surface}`}><p className="text-xs font-black uppercase tracking-[.11em] text-[var(--muted)]">Why this works</p><p className="mt-1.5 text-sm leading-6">{reply.why_it_works}</p></div>
              <button aria-describedby={copyError?.category === category ? `${category}-copy-error` : undefined} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--foreground)] px-4 font-extrabold text-[var(--background)] transition hover:opacity-90" onClick={() => void handleCopy(text, category)} type="button">{copied === category ? <><Check size={17} aria-hidden="true" /> Copied</> : <><Clipboard size={17} aria-hidden="true" /> Copy reply</>}</button>
              {copyError?.category === category ? <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold leading-6 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200" id={`${category}-copy-error`} role="alert">{copyError.message}</p> : null}
              <div className="mt-4 flex items-center justify-between text-xs text-[var(--muted)]">
                <span>{selectedFeedback ? "Thanks for the feedback" : "Was this helpful?"}</span>
                <div className="flex gap-1">
                  <button aria-label={`${category} reply was helpful`} aria-pressed={selectedFeedback === "helpful"} className={`grid h-11 w-11 place-items-center rounded-full transition ${selectedFeedback === "helpful" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : "hover:bg-[var(--background)]"}`} onClick={() => void submitFeedback(category, "helpful")} type="button"><ThumbsUp size={16} aria-hidden="true" /></button>
                  <button aria-label={`${category} reply was not helpful`} aria-pressed={selectedFeedback === "not_helpful"} className={`grid h-11 w-11 place-items-center rounded-full transition ${selectedFeedback === "not_helpful" ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200" : "hover:bg-[var(--background)]"}`} onClick={() => void submitFeedback(category, "not_helpful")} type="button"><ThumbsDown size={16} aria-hidden="true" /></button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      <div className="mx-auto mt-6 flex max-w-2xl items-start justify-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-center text-xs leading-5 text-[var(--muted)]"><FileImage className="mt-0.5 shrink-0" size={14} aria-hidden="true" /><p>Milo provides suggestions, not instructions. You are responsible for every message you send.</p></div>
    </section>
  );
}
