import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

export const REQUIRED_PRODUCTION_ENV = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
  "RATE_LIMIT_HASH_SECRET",
  "OPENROUTER_API_KEY",
  "OPENROUTER_MODEL",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_ID",
  "ADMIN_EMAILS",
];

function productionUrlIsValid(rawValue) {
  try {
    const url = new URL(rawValue);
    return (
      url.protocol === "https:" &&
      !["localhost", "127.0.0.1", "::1"].includes(url.hostname) &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

export function evaluateReleaseReadiness(input) {
  const issues = [];
  const missingEnv = REQUIRED_PRODUCTION_ENV.filter((name) => !input.env[name]?.trim());
  if (missingEnv.length > 0) issues.push(`Missing environment variables: ${missingEnv.join(", ")}`);
  if (!productionUrlIsValid(input.env.NEXT_PUBLIC_APP_URL ?? "")) {
    issues.push("NEXT_PUBLIC_APP_URL must be a bare, non-local HTTPS production origin.");
  }
  if (input.env.MILO_E2E_MODE === "true") {
    issues.push("MILO_E2E_MODE must never be enabled for a deployment.");
  }
  if (input.legalCopy.includes("Replace before launch")) {
    issues.push("Privacy Policy or Terms still contains a launch placeholder.");
  }
  if (!input.gitRemote) issues.push("Git remote 'origin' is not configured.");
  if (!input.vercelLinked) issues.push("The repository is not linked to a Vercel project.");
  if (!input.worktreeClean) issues.push("The Git worktree has uncommitted changes.");
  return { ready: issues.length === 0, issues };
}

function optionalCommand(command, args) {
  try {
    return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

function main() {
  loadEnvConfig(process.cwd());
  const legalCopy = [
    readFileSync("src/app/privacy/page.tsx", "utf8"),
    readFileSync("src/app/terms/page.tsx", "utf8"),
  ].join("\n");
  const gitRemote = optionalCommand("git", ["remote", "get-url", "origin"]);
  const worktreeState = optionalCommand("git", ["status", "--porcelain"]);
  const result = evaluateReleaseReadiness({
    env: process.env,
    gitRemote: gitRemote ?? "",
    legalCopy,
    vercelLinked: (() => {
      try {
        readFileSync(".vercel/project.json", "utf8");
        return true;
      } catch {
        return false;
      }
    })(),
    worktreeClean: worktreeState !== null && worktreeState === "",
  });

  console.log(`[release-readiness] ${result.ready ? "READY" : "NOT READY"}`);
  for (const issue of result.issues) console.log(`- ${issue}`);
  if (!result.ready) {
    console.log("- Manual gates still required: production SMTP, Supabase callbacks, Stripe test lifecycle, legal review and HTTPS verification.");
    process.exitCode = 1;
  }
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) main();
