import assert from "node:assert/strict";
import {
  evaluateReleaseReadiness,
  REQUIRED_PRODUCTION_ENV,
} from "./release-readiness.mjs";

const completeEnv = Object.fromEntries(REQUIRED_PRODUCTION_ENV.map((name) => [name, `${name}-configured`]));
completeEnv.NEXT_PUBLIC_APP_URL = "https://milo.example";
completeEnv.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
completeEnv.MILO_DESKTOP_REDIRECT_URI = "http://127.0.0.1:43821/oauth/callback";
completeEnv.RATE_LIMIT_HASH_SECRET = "a".repeat(32);

for (const requiredName of [
  "OPENROUTER_PROVIDER_ALLOWLIST",
  "MILO_DESKTOP_CLIENT_ID",
  "MILO_DESKTOP_REDIRECT_URI",
]) {
  assert(REQUIRED_PRODUCTION_ENV.includes(requiredName), `${requiredName} must be release-required`);
}

const ready = evaluateReleaseReadiness({
  env: completeEnv,
  gitRemote: "https://github.com/example/milo.git",
  legalCopy: "Final reviewed legal copy",
  vercelLinked: true,
  worktreeClean: true,
});
assert.deepEqual(ready, { ready: true, issues: [] });

for (const [name, value] of [
  ["NEXT_PUBLIC_APP_URL", "https://user:password@milo.example"],
  ["NEXT_PUBLIC_APP_URL", "https://[::1]"],
  ["NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co/rest/v1"],
  ["NEXT_PUBLIC_SUPABASE_URL", "https://user:password@project.supabase.co"],
  ["MILO_DESKTOP_REDIRECT_URI", "http://user:password@127.0.0.1:43821/oauth/callback"],
]) {
  const result = evaluateReleaseReadiness({
    env: { ...completeEnv, [name]: value },
    gitRemote: "https://github.com/example/milo.git", legalCopy: "Reviewed",
    vercelLinked: true, worktreeClean: true,
  });
  assert.equal(result.ready, false, `${name} must reject malformed origins`);
}

const blocked = evaluateReleaseReadiness({
  env: { NEXT_PUBLIC_APP_URL: "http://localhost:3000", MILO_E2E_MODE: "true" },
  gitRemote: "",
  legalCopy: "Replace before launch",
  vercelLinked: false,
  worktreeClean: false,
});
assert.equal(blocked.ready, false);
assert(blocked.issues.some((issue) => issue.startsWith("Missing environment variables:")));
assert(blocked.issues.some((issue) => issue.includes("non-local HTTPS")));
assert(blocked.issues.some((issue) => issue.includes("Supabase origin")));
assert(blocked.issues.some((issue) => issue.includes("OAuth callback")));
assert(blocked.issues.some((issue) => issue.includes("32 characters")));
assert(blocked.issues.some((issue) => issue.includes("MILO_E2E_MODE")));
assert(blocked.issues.some((issue) => issue.includes("launch placeholder")));
assert(blocked.issues.some((issue) => issue.includes("Git remote")));
assert(blocked.issues.some((issue) => issue.includes("Vercel")));
assert(blocked.issues.some((issue) => issue.includes("uncommitted")));

console.log("[release-readiness-contract] passed");
