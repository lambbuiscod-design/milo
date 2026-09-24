import { expect, test } from "@playwright/test";
import sharp from "sharp";

const runtimeErrors = new WeakMap<import("@playwright/test").Page, string[]>();
const validScreenshot = sharp({
  create: { width: 360, height: 640, channels: 3, background: "#f7f4ee" },
}).png().toBuffer();

function isDevelopmentRscDisconnect(message: string) {
  return message.includes("Connection closed.") && message.includes("react-server-dom-turbopack");
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  runtimeErrors.set(page, errors);
  page.on("pageerror", (error) => {
    if (!isDevelopmentRscDisconnect(`${error.message}\n${error.stack ?? ""}`)) {
      errors.push(`pageerror: ${error.message}`);
    }
  });
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const isExpectedProviderFailure =
      message.location().url.includes("/api/analyze") &&
      /status of 422/i.test(message.text());
    if (!isExpectedProviderFailure && !isDevelopmentRscDisconnect(message.text())) {
      errors.push(`console: ${message.text()}`);
    }
  });
});

test.afterEach(async ({ page }) => {
  expect(runtimeErrors.get(page) ?? []).toEqual([]);
});

async function uploadScreenshot(page: import("@playwright/test").Page) {
  await expect(page.getByRole("button", { name: /Choose screenshot/ })).toBeEnabled();
  await page.locator("#chat-image").setInputFiles({ name: "chat.png", mimeType: "image/png", buffer: await validScreenshot });
}

async function signInThroughOnboarding(page: import("@playwright/test").Page) {
  await page.context().clearCookies();
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard|\/login\?next=\/dashboard/);
  await page.getByLabel("Email address").fill("tester@milo.local");
  await page.getByLabel(/I confirm that I am 18 or older/).check();
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await page.waitForURL((url) => url.pathname === "/dashboard");
  await expect(page).toHaveURL(/\/dashboard$/);
}

test("landing page is usable at 360px without horizontal overflow", async ({ page }) => {
  const cspErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && /content security policy/i.test(message.text())) {
      cspErrors.push(message.text());
    }
  });
  await page.setViewportSize({ width: 360, height: 780 });
  const response = await page.goto("/");
  const policy = response?.headers()["content-security-policy"] ?? "";
  const scriptDirective = policy.split(";").find((directive) => directive.trim().startsWith("script-src ")) ?? "";
  expect(scriptDirective).toContain("'strict-dynamic'");
  expect(scriptDirective).not.toContain("'unsafe-inline'");
  await expect(page.getByRole("heading", { name: /Know what to say/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Get Milo/i }).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Skip to main content" });
  await expect(skipLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
  expect(cspErrors).toEqual([]);
});

test("demo lets a visitor edit and copy a reply", async ({ page }) => {
  await page.goto("/demo");
  const safeReply = page.getByRole("textbox", { name: "safe reply" });
  await safeReply.fill("I had a lovely time. Thursday works for me!");
  await page.getByRole("button", { name: "Copy reply" }).first().click();
  await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
});

test("clipboard denial shows recovery beside the affected reply", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/demo");
  await page.evaluate(() => {
    Object.defineProperty(Navigator.prototype, "clipboard", {
      configurable: true,
      get: () => ({
        writeText: () => Promise.reject(new DOMException("Clipboard blocked", "NotAllowedError")),
      }),
    });
  });
  await page.getByRole("button", { name: "Copy reply" }).first().click();
  const safeCard = page.getByRole("article").filter({ hasText: "Safe choice" });
  await expect(safeCard.getByRole("alert")).toContainText("Select the reply text and copy it manually");
});

test("mocked user signs in, preserves failed usage, gets safety handling, reaches the paywall, upgrades, and deletes the account", async ({ page }, testInfo) => {
  testInfo.setTimeout(480_000);
  if (testInfo.project.name === "mobile-chromium") {
    await page.setViewportSize({ width: 360, height: 780 });
    expect(page.viewportSize()).toEqual({ width: 360, height: 780 });
  }
  await signInThroughOnboarding(page);
  // The development server compiles route handlers lazily. Warm the route
  // outside assertion timing so slow Windows filesystems do not look like a
  // product failure; POST behavior remains fully exercised below.
  const requestHeaders = {
    Origin: "http://127.0.0.1:3100",
    "Sec-Fetch-Site": "same-origin",
  };
  const analyzeWarmup = await page.request.post("/api/analyze", {
    headers: requestHeaders,
    multipart: {},
  });
  expect(analyzeWarmup.status()).toBe(400);
  const feedbackWarmup = await page.request.post("/api/feedback", {
    headers: requestHeaders,
    data: {},
  });
  expect(feedbackWarmup.status()).toBe(400);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await expect(page.getByText("Analyses left").locator("..").getByText("5")).toBeVisible();
  await page.getByRole("button", { name: "Analyze conversation" }).click();
  await expect(page.getByText("Choose a chat screenshot first.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Choose screenshot/ })).toBeFocused();
  await uploadScreenshot(page);
  await expect(page.getByRole("button", { name: "Replace screenshot" })).toBeVisible();

  await page.getByLabel(/Optional context/).fill("force-error");
  await page.getByRole("button", { name: "Analyze conversation" }).click();
  await expect(page.getByText("Mock provider failure", { exact: true })).toBeVisible();
  await expect(page.getByText("Analyses left").locator("..").getByText("5")).toBeVisible();

  await page.getByLabel(/Optional context/).fill("unsafe-test");
  await page.getByRole("button", { name: "Analyze conversation" }).click();
  await expect(page.getByRole("heading", { name: /needs care/i })).toBeVisible();
  await expect(page.getByText("Analyses left").locator("..").getByText("5")).toBeVisible();

  await page.getByLabel(/Optional context/).fill("");
  for (let expected = 4; expected >= 0; expected -= 1) {
    await page.getByRole("button", { name: /Analyze conversation|View upgrade options/ }).click();
    await expect(page.getByText("Analyses left").locator("..").getByText(String(expected))).toBeVisible();
    if (expected === 4) {
      const results = page.getByRole("region", { name: "Pick one, then make it yours." });
      await expect(results).toBeFocused();
      await expect.poll(async () => (await results.boundingBox())?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(780);
    }
  }

  const confident = page.getByRole("textbox", { name: "confident reply" });
  await confident.fill("Yes — Thursday sounds great. What time works for you?");
  await page.getByRole("button", { name: "Copy reply" }).nth(1).click();
  await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
  await page.getByRole("button", { name: "confident reply was helpful" }).click();
  await expect(page.getByText("Thanks for the feedback")).toBeVisible();

  await page.getByRole("button", { name: "View upgrade options" }).click();
  await expect(page).toHaveURL(/\/account\?upgrade=1/);
  await page.getByRole("button", { name: /Upgrade for €5\.99/ }).click();
  await expect(page).toHaveURL(/checkout=success/);
  await expect(page.getByText(/Payment received/)).toBeVisible();
  await expect(page.getByText("Milo Plus", { exact: true })).toBeVisible();
  await expect(page.getByText(/0\s+of 150 used/)).toBeVisible();

  await page.goto("/dashboard");
  await expect(page.getByText("Analyses left").locator("..").getByText("150")).toBeVisible();
  await uploadScreenshot(page);
  await page.getByLabel("Relationship stage").selectOption("dating");
  await page.getByRole("button", { name: /Direct Simple & honest/ }).click();
  await page.getByLabel(/Optional context/).fill("This context belongs only to the current conversation.");
  await page.getByRole("button", { name: "Analyze conversation" }).click();
  await expect(page.getByText("Analyses left").locator("..").getByText("149")).toBeVisible();
  await expect(page.getByRole("textbox", { name: /reply$/ })).toHaveCount(3);
  await expect(page.getByText("Why this works")).toHaveCount(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

  await page.getByRole("button", { name: "Analyze another screenshot" }).click();
  await expect(page.getByRole("button", { name: /Choose screenshot/ })).toBeFocused();
  await expect(page.getByLabel(/Optional context/)).toHaveValue("");
  await expect(page.getByLabel("Relationship stage")).toHaveValue("new_match");
  await expect(page.getByRole("button", { name: /Warm Open & kind/ })).toHaveAttribute("aria-pressed", "true");

  await page.goto("/account");
  await expect(page.getByText(/1\s+of 150 used/)).toBeVisible();
  const usageProgress = page.getByRole("progressbar", { name: "Monthly analyses used" });
  await expect(usageProgress).toHaveAttribute("aria-valuenow", "1");
  await expect(usageProgress).toHaveAttribute("aria-valuemax", "150");

  await page.getByLabel(/I understand this permanently deletes/).check();
  await page.getByRole("button", { name: /Delete my account permanently/ }).click();
  await expect(page).toHaveURL(/deleted=1/);
});
