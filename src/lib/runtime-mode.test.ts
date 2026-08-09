import { afterEach, describe, expect, it } from "vitest";
import { isE2EMode } from "@/lib/runtime-mode";

describe("test-only runtime mode", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalE2E = process.env.MILO_E2E_MODE;
  afterEach(() => {
    Object.assign(process.env, { NODE_ENV: originalNodeEnv, MILO_E2E_MODE: originalE2E });
  });

  it("cannot activate in production", () => {
    Object.assign(process.env, { NODE_ENV: "production", MILO_E2E_MODE: "true" });
    expect(isE2EMode()).toBe(false);
  });
});
