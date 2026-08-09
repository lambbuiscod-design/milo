// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import {
  activateE2EPlus,
  consumeE2EUsage,
  getE2EUsageState,
  resetE2EUsage,
} from "@/lib/e2e-mocks";

const USER_ID = "00000000-0000-4000-8000-000000000001";

afterEach(() => resetE2EUsage());

describe("E2E entitlement state", () => {
  it("keeps free and paid billing-period usage separate", () => {
    expect(getE2EUsageState(USER_ID)).toMatchObject({ plan: "free", allowance: 5, remaining: 5 });
    consumeE2EUsage(USER_ID);
    expect(getE2EUsageState(USER_ID)).toMatchObject({ plan: "free", used: 1, remaining: 4 });

    activateE2EPlus(USER_ID);
    expect(getE2EUsageState(USER_ID)).toMatchObject({ plan: "plus", allowance: 150, used: 0, remaining: 150 });
    consumeE2EUsage(USER_ID);
    expect(getE2EUsageState(USER_ID)).toMatchObject({ plan: "plus", used: 1, remaining: 149 });
  });
});
