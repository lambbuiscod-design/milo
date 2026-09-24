import { expect, test } from "@playwright/test";

const runtimeErrors = new WeakMap<import("@playwright/test").Page, string[]>();

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  runtimeErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
});

test.afterEach(async ({ page }) => {
  expect(runtimeErrors.get(page) ?? []).toEqual([]);
});

test("production landing page has secure headers and no overflow", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  const headers = response?.headers() ?? {};
  expect(headers["content-security-policy"]).toContain("'strict-dynamic'");
  expect(headers["strict-transport-security"]).toContain("max-age=31536000");
  await expect(page.getByRole("heading", { name: /Know what to say/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /A companion you can trust/i })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("production demo exposes exactly three editable replies", async ({ page }) => {
  await page.goto("/demo");
  await expect(page.getByRole("textbox", { name: /reply$/ })).toHaveCount(3);
  await expect(page.getByText("Why this works")).toHaveCount(3);
  const confident = page.getByRole("textbox", { name: "confident reply" });
  await confident.fill("Thursday sounds great. What time works for you?");
  await expect(confident).toHaveValue("Thursday sounds great. What time works for you?");
});

test("production protects the dashboard and exposes legal pages", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=/);
  await expect(page.getByLabel(/I confirm that I am 18 or older/)).toBeVisible();

  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "Privacy Policy" })).toBeVisible();
  await page.goto("/terms");
  await expect(page.getByRole("heading", { name: "Terms of Service" })).toBeVisible();
});
