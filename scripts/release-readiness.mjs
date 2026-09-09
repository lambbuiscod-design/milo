import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const webRoot = path.join(repositoryRoot, "apps", "web");

export const REQUIRED_PRODUCTION_ENV = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
  "RATE_LIMIT_HASH_SECRET",
  "OPENROUTER_API_KEY",
  "OPENROUTER_MODEL",
  "OPENROUTER_PROVIDER_ALLOWLIST",
  "MILO_DESKTOP_CLIENT_ID",
  "MILO_DESKTOP_REDIRECT_URI",
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
      !url.username && !url.password &&
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

function supabaseUrlIsValid(rawValue) {
  try {
    const url = new URL(rawValue);
    return url.protocol === "https:" && !url.username && !url.password &&
      url.pathname === "/" && !url.search && !url.hash &&
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  } catch {
    return false;
  }
}

function desktopRedirectIsValid(rawValue) {
  try {
    const url = new URL(rawValue);
    const port = Number(url.port);
    return (
      url.protocol === "http:" &&
      !url.username && !url.password &&
      url.hostname === "127.0.0.1" &&
      Number.isInteger(port) &&
      port >= 1024 &&
      port <= 65535 &&
      url.pathname === "/oauth/callback" &&
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
  if (!supabaseUrlIsValid(input.env.NEXT_PUBLIC_SUPABASE_URL ?? "")) {
    issues.push("NEXT_PUBLIC_SUPABASE_URL must be a non-local HTTPS Supabase origin.");
  }
  if (!desktopRedirectIsValid(input.env.MILO_DESKTOP_REDIRECT_URI ?? "")) {
    issues.push("MILO_DESKTOP_REDIRECT_URI must be an exact high-port 127.0.0.1 OAuth callback.");
  }
  if ((input.env.RATE_LIMIT_HASH_SECRET ?? "").length < 32) {
    issues.push("RATE_LIMIT_HASH_SECRET must contain at least 32 characters.");
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
    return execFileSync(command, args, {
      cwd: repositoryRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function main() {
  loadEnvConfig(webRoot);
  const legalCopy = [
    readFileSync(path.join(webRoot, "src", "app", "privacy", "page.tsx"), "utf8"),
    readFileSync(path.join(webRoot, "src", "app", "terms", "page.tsx"), "utf8"),
  ].join("\n");
  const gitRemote = optionalCommand("git", ["remote", "get-url", "origin"]);
  const worktreeState = optionalCommand("git", ["status", "--porcelain"]);
  const result = evaluateReleaseReadiness({
    env: process.env,
    gitRemote: gitRemote ?? "",
    legalCopy,
    vercelLinked: (() => {
      for (const linkRoot of [repositoryRoot, webRoot]) {
        try {
          readFileSync(path.join(linkRoot, ".vercel", "project.json"), "utf8");
          return true;
        } catch {
          // Check the next supported Vercel link location.
        }
      }
      return false;
    })(),
    worktreeClean: worktreeState !== null && worktreeState === "",
  });

  console.log(`[release-configuration] ${result.ready ? "CONFIGURED" : "NOT CONFIGURED"}`);
  console.log("- This checks configuration only. Local verification, database tests, signing and real integration approval remain separate gates in docs/RELEASE.md.");
  for (const issue of result.issues) console.log(`- ${issue}`);
  if (!result.ready) {
    console.log("- Manual gates still required: production SMTP, Supabase callbacks, Stripe test lifecycle, legal review and HTTPS verification.");
    process.exitCode = 1;
  }
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) main();
