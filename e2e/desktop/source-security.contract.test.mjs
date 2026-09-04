import assert from "node:assert/strict";
import test from "node:test";
import { inspectDesktopSource } from "../../scripts/desktop-security-check.mjs";

test("desktop source satisfies the Phase 2 security contract", async () => {
  const result = await inspectDesktopSource();
  assert.deepEqual(result.failures, [], result.failures.join("\n"));
});
