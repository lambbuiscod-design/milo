"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { sanitizeAuthDestination } from "@/lib/supabase/auth-redirect";
import { isE2EMode, MILO_E2E_AUTH_COOKIE } from "@/lib/runtime-mode";
import { authErrorMessage } from "@/lib/auth-errors";
import { createAdultAttestation } from "@/lib/adult-attestation";

export type MagicLinkState = {
  status: "idle" | "success" | "error";
  message: string | null;
};

export async function sendMagicLink(
  _previousState: MagicLinkState,
  formData: FormData,
): Promise<MagicLinkState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const adultConfirmed = formData.get("adultConfirmed") === "on";
  const next = sanitizeAuthDestination(String(formData.get("next") ?? "/dashboard"));
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return { status: "error", message: authErrorMessage("invalid_email") };
  }
  if (!adultConfirmed) {
    return { status: "error", message: authErrorMessage("adult_required") };
  }
  if (isE2EMode()) {
    const cookieStore = await cookies();
    cookieStore.set(MILO_E2E_AUTH_COOKIE, "1", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: false,
    });
    redirect(next);
  }
  const supabase = await createClient();
  if (!supabase || !env.RATE_LIMIT_HASH_SECRET || !env.SUPABASE_SECRET_KEY) {
    return { status: "error", message: authErrorMessage("auth_unconfigured") };
  }

  const callback = new URL("/auth/callback", env.NEXT_PUBLIC_APP_URL);
  callback.searchParams.set("next", next);
  callback.searchParams.set(
    "adult_attestation",
    createAdultAttestation(email, env.RATE_LIMIT_HASH_SECRET),
  );
  let authError: { name: string } | null = null;
  try {
    const result = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: callback.toString(),
      },
    });
    authError = result.error;
  } catch (error) {
    authError = { name: error instanceof Error ? error.name : "UnknownError" };
  }
  if (authError) {
    console.error("[auth/magic-link] request failed", { errorType: authError.name });
    return { status: "error", message: authErrorMessage("magic_link_failed") };
  }

  // Keep the confirmation generic to avoid account enumeration. The submitted
  // address is never copied into URLs, browser history, or request logs.
  return {
    status: "success",
    message: "Your secure sign-in link is on its way.",
  };
}

export async function signOut() {
  if (isE2EMode()) {
    const cookieStore = await cookies();
    cookieStore.delete(MILO_E2E_AUTH_COOKIE);
    redirect("/");
  }
  const supabase = await createClient();
  await supabase?.auth.signOut();
  redirect("/");
}
