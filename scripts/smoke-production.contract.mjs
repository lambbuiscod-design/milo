import assert from "node:assert/strict";
import {
  assertAnonymousDashboardRedirect,
  assertFinalLegalCopy,
  assertHealthResponse,
  assertSecurityHeaders,
  productionOrigin,
} from "./smoke-production.mjs";

const secureHeaders = {
  "content-security-policy": "default-src 'self'; script-src 'nonce-test' 'strict-dynamic'",
  "referrer-policy": "strict-origin-when-cross-origin",
  "strict-transport-security": "max-age=31536000",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
};

let passed = 0;
function check(name, run) {
  run();
  passed += 1;
  console.log(`[production-smoke-contract] passed: ${name}`);
}

check("production origin accepts only a bare HTTPS origin", () => {
  assert.equal(productionOrigin("https://milo.example/"), "https://milo.example");
  assert.throws(() => productionOrigin("http://milo.example"), /must use HTTPS/);
  assert.throws(() => productionOrigin("https://milo.example/demo"), /deployment origin/);
  assert.throws(() => productionOrigin("https://user:secret@milo.example"), /Credentials/);
});

check("production headers enforce the public security baseline", () => {
  const response = new Response("ok", { headers: secureHeaders });
  assert.doesNotThrow(() => assertSecurityHeaders(response, "/"));
  const missingHsts = new Response("ok", { headers: { ...secureHeaders, "strict-transport-security": "" } });
  assert.throws(() => assertSecurityHeaders(missingHsts, "/"), /missing HSTS/);
});

check("runtime health must be configured and ready", () => {
  assert.doesNotThrow(() => assertHealthResponse(new Response("", { status: 200 }), { status: "ok" }));
  assert.throws(
    () => assertHealthResponse(new Response("", { status: 503 }), { status: "not_ready" }),
    /expected 200/,
  );
  assert.throws(
    () => assertHealthResponse(new Response("", { status: 200 }), { status: "not_ready" }),
    /ready Milo runtime/,
  );
});

check("legal launch placeholders fail closed", () => {
  assert.doesNotThrow(() => assertFinalLegalCopy("Final privacy copy", "Final terms copy"));
  assert.throws(
    () => assertFinalLegalCopy("Replace before launch", "Final terms copy"),
    /Privacy Policy still contains/,
  );
});

check("anonymous dashboard must redirect internally to the preserved login destination", () => {
  const response = new Response(null, {
    status: 307,
    headers: { location: "https://milo.example/login?next=%2Fdashboard" },
  });
  assert.doesNotThrow(() => assertAnonymousDashboardRedirect(response, "https://milo.example"));

  const external = new Response(null, {
    status: 307,
    headers: { location: "https://example.org/login?next=%2Fdashboard" },
  });
  assert.throws(
    () => assertAnonymousDashboardRedirect(external, "https://milo.example"),
    /redirected away/,
  );
});

console.log(`[production-smoke-contract] ${passed} checks passed.`);
