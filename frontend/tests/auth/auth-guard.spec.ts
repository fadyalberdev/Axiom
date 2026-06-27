import { test, expect } from "@playwright/test";

test("unauthenticated user redirected from /dashboard to /login", async ({ page }) => {
  await page.goto("/dashboard");

  await page.waitForURL(/\/login/, { timeout: 10_000 });

  expect(page.url()).toContain("/login");
  expect(page.url()).toContain("redirect=/dashboard");
});
