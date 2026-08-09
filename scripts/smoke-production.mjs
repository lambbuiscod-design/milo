import { pathToFileURL } from "node:url";

const REQUEST_TIMEOUT_MS = 20_000;

function fail(message) {
  throw new Error(`[production-smoke] ${message}`);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

export function productionOrigin(rawValue) {
  assert(rawValue, "MILO_PRODUCTION_URL is required.");
  let url;
  try {
    url = new URL(rawValue);
  } catch {
    fail("MILO_PRODUCTION_URL must be a valid absolute URL.");
  }

  assert(url.protocol === "https:", "MILO_PRODUCTION_URL must use HTTPS.");
  assert(!url.username && !url.password, "Credentials are not allowed in the smoke-test URL.");
  assert(!url.search && !url.hash, "The smoke-test URL must not contain a query string or fragment.");
  assert(url.pathname === "/" || url.pathname === "", "The smoke-test URL must be the deployment origin.");
  return url.origin;
}

async function request(origin, path, redirect = "manual") {
  const response = await fetch(new URL(path, origin), {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "Milo-production-smoke/1.0",
    },
    redirect,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  console.log(`[production-smoke] ${path} -> ${response.status}`);
  return response;
}

export function assertSecurityHeaders(response, path) {
  const header = (name) => response.headers.get(name) ?? "";
  assert(header("strict-transport-security").includes("max-age="), `${path} is missing HSTS.`);
  assert(header("content-security-policy").includes("'strict-dynamic'"), `${path} is missing Milo's production CSP.`);
  assert(header("x-content-type-options").toLowerCase() === "nosniff", `${path} is missing nosniff.`);
  assert(header("x-frame-options").toUpperCase() === "DENY", `${path} is missing clickjacking protection.`);
  assert(
    header("referrer-policy").toLowerCase() === "strict-origin-when-cross-origin",
    `${path} has an unexpected Referrer-Policy.`,
  );
}

export function assertFinalLegalCopy(privacyBody, termsBody) {
  assert(!privacyBody.includes("Replace before launch"), "Privacy Policy still contains a launch placeholder.");
  assert(!termsBody.includes("Replace before launch"), "Terms of Service still contains a launch placeholder.");
}

export function assertAnonymousDashboardRedirect(response, origin) {
  assert([302, 303, 307, 308].includes(response.status), "/dashboard did not redirect an anonymous visitor.");
  const location = response.headers.get("location");
  assert(location, "/dashboard redirect is missing a Location header.");
  const destination = new URL(location, origin);
  assert(destination.origin === origin, "/dashboard redirected away from the configured deployment origin.");
  assert(destination.pathname === "/login", "/dashboard did not redirect to /login.");
  assert(destination.searchParams.get("next") === "/dashboard", "/dashboard redirect lost its intended destination.");
}

export function assertHealthResponse(response, payload) {
  assert(response.status === 200, `/api/health returned ${response.status}, expected 200.`);
  assert(payload?.status === "ok", "/api/health did not report a ready Milo runtime.");
}

async function publicPage(origin, path, requiredText) {
  const response = await request(origin, path);
  assert(response.status === 200, `${path} returned ${response.status}, expected 200.`);
  assertSecurityHeaders(response, path);
  assert(
    (response.headers.get("content-type") ?? "").toLowerCase().includes("text/html"),
    `${path} did not return HTML.`,
  );
  const body = await response.text();
  assert(body.includes(requiredText), `${path} did not contain its expected page marker.`);
  return { response, body };
}

async function main() {
  const origin = productionOrigin(process.env.MILO_PRODUCTION_URL?.trim());
  console.log(`[production-smoke] checking ${origin}`);

  const health = await request(origin, "/api/health");
  let healthPayload;
  try {
    healthPayload = await health.json();
  } catch {
    fail("/api/health did not return valid JSON.");
  }
  assertHealthResponse(health, healthPayload);

  await publicPage(origin, "/", "Never stare at the reply box again");
  const login = await publicPage(origin, "/login", "No password is required");
  assert(
    (login.response.headers.get("cache-control") ?? "").includes("no-store"),
    "/login must not be stored by shared or browser caches.",
  );
  await publicPage(origin, "/demo", "Why this works");
  const privacy = await publicPage(origin, "/privacy", "Privacy Policy");
  const terms = await publicPage(origin, "/terms", "Terms of Service");

  assertFinalLegalCopy(privacy.body, terms.body);

  const dashboard = await request(origin, "/dashboard");
  assertAnonymousDashboardRedirect(dashboard, origin);

  console.log("[production-smoke] public deployment checks passed.");
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  });
}
