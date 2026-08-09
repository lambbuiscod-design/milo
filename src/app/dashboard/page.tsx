import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { CoachWorkspace } from "@/components/coach-workspace";
import { requireUser } from "@/lib/auth";
import { getUsageForUser } from "@/lib/usage";

export const metadata: Metadata = { title: "Reply coach" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const usage = await getUsageForUser(user.id);
  return <AppShell email={user.email ?? "Signed in"}><CoachWorkspace initialRemaining={usage.remaining} /></AppShell>;
}
