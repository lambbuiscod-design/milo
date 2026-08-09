import "server-only";
import { FREE_LIFETIME_ALLOWANCE, PAID_MONTHLY_ALLOWANCE } from "@/lib/entitlements";
import type { AnalysisResult } from "@/lib/schemas";

type E2EState = {
  freeUsage: Map<string, number>;
  paidUsage: Map<string, number>;
  plusUsers: Set<string>;
};

const globalE2E = globalThis as typeof globalThis & { __miloE2EState?: E2EState };
const e2eState = globalE2E.__miloE2EState ??= {
  freeUsage: new Map<string, number>(),
  paidUsage: new Map<string, number>(),
  plusUsers: new Set<string>(),
};
const { freeUsage, paidUsage, plusUsers } = e2eState;

export const e2eAnalysisResult: AnalysisResult = {
  conversation_status: "clear",
  detected_language: "English",
  brief_context: "A positive conversation with an opening to suggest another date.",
  warning: null,
  replies: [
    { category: "safe", text: "I had a really nice time too. I’d love to do it again.", why_it_works: "It is warm, clear and respectful." },
    { category: "confident", text: "Definitely. Are you free Thursday for round two?", why_it_works: "It proposes a concrete next step without pressure." },
    { category: "playful", text: "Only if you promise to bring that dangerously good banter again 😄", why_it_works: "It keeps the tone light and personal." },
  ],
};

export function getE2EUsageState(userId: string) {
  const isPlus = plusUsers.has(userId);
  const allowance = isPlus ? PAID_MONTHLY_ALLOWANCE : FREE_LIFETIME_ALLOWANCE;
  const used = (isPlus ? paidUsage : freeUsage).get(userId) ?? 0;
  return {
    plan: isPlus ? ("plus" as const) : ("free" as const),
    allowance,
    used,
    remaining: Math.max(0, allowance - used),
  };
}

export function consumeE2EUsage(userId: string) {
  const state = getE2EUsageState(userId);
  const store = state.plan === "plus" ? paidUsage : freeUsage;
  store.set(userId, state.used + 1);
  return getE2EUsageState(userId);
}

export function activateE2EPlus(userId: string) {
  plusUsers.add(userId);
  paidUsage.set(userId, 0);
  return getE2EUsageState(userId);
}

export function resetE2EUsage(userId?: string) {
  if (userId) {
    freeUsage.delete(userId);
    paidUsage.delete(userId);
    plusUsers.delete(userId);
    return;
  }
  freeUsage.clear();
  paidUsage.clear();
  plusUsers.clear();
}
