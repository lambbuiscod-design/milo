import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);

for (const consumer of ["@electron/universal", "@typescript-eslint/typescript-estree"]) {
  const consumerRequire = createRequire(require.resolve(consumer));
  const matcherPath = consumerRequire.resolve("minimatch");

  test(`${consumer} retains its glob matching API after the security update`, () => {
    const { minimatch } = consumerRequire("minimatch");
    assert.equal(minimatch("lib/helper.node", "*.node", { matchBase: true }), true);
    assert.equal(minimatch("lib/helper.js", "*.node", { matchBase: true }), false);
    assert.equal(minimatch(".config/settings.ts", "**/*.ts", { dot: true }), true);
    assert.equal(minimatch("src/main.ts", "**/*.tsx", { dot: true }), false);
    // Load the real caller as well, to catch module/export incompatibilities.
    assert.doesNotThrow(() => consumerRequire(consumer));
  });

  test(`${consumer} bounds hostile glob preprocessing`, () => {
    // Isolate the amplification regression so an unsafe dependency cannot hang
    // the main test process. The patched matcher honors this expansion limit.
    execFileSync(process.execPath, ["-e", `
      const assert = require('node:assert/strict');
      const { Minimatch } = require(process.argv[1]);
      const matcher = new Minimatch('prefix/' + '**/../a/b/'.repeat(20) + '*.ts', {
        optimizationLevel: 2,
        braceExpandMax: 64,
      });
      assert.ok(matcher.globParts.length <= 64);
    `, matcherPath], { timeout: 5000, stdio: "pipe" });
  });
}
