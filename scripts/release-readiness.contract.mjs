import assert from "node:assert/strict";
import {
  evaluateReleaseReadiness,
  REQUIRED_PRODUCTION_ENV,
} from "./release-readiness.mjs";

const completeEnv = Object.fromEntries(REQUIRED_PRODUCTION_ENV.map((name) => [name, `${name}-configured`]));
completeEnv.NEXT_PUBLIC_APP_URL = "https://milo.example";

const ready = evaluateReleaseReadiness({
  env: completeEnv,
  gitRemote: "https://github.com/example/milo.git",
  legalCopy: "Final reviewed legal copy",
  vercelLinked: true,
  worktreeClean: true,
});
assert.deepEqual(ready, { ready: true, issues: [] });

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
assert(blocked.issues.some((issue) => issue.includes("MILO_E2E_MODE")));
assert(blocked.issues.some((issue) => issue.includes("launch placeholder")));
assert(blocked.issues.some((issue) => issue.includes("Git remote")));
assert(blocked.issues.some((issue) => issue.includes("Vercel")));
assert(blocked.issues.some((issue) => issue.includes("uncommitted")));

console.log("[release-readiness-contract] passed");
