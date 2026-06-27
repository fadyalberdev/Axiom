import { test, expect } from "@playwright/test";

test("free user can start 7-day Basic trial and sees trial indicators", async ({ page }) => {
  await page.goto("/login");

  await page.getByLabel("Email Address").fill("Testuser1@gmail.com");
  await page.locator('input[name="password"]').fill("Testuser123");
  await page.getByRole("button", { name: "Log In" }).click();

  await page.waitForURL("/dashboard", { timeout: 15_000 });

  // Dashboard heading confirms the page rendered
  await expect(
    page.getByRole("heading", { name: "Manage your AXIOM workspace." })
  ).toBeVisible({ timeout: 15_000 });

  await page.goto("/login");
  await page.getByLabel("Email Address").fill("Testuser1@gmail.com");
  await page.locator('input[name="password"]').fill("Testuser123");
  await page.getByRole("button", { name: "Log In" }).click();
  await page.waitForURL("/dashboard", { timeout: 15_000 });

  await page.goto("/pricing");

  // Plan cards are <article> elements — wait for them to appear (isLoading skeleton has no articles)
  await expect(page.locator("article").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { level: 2, name: /basic/i })).toBeVisible();

  const trialBtn = page.getByRole("button", { name: /start 7.day basic trial/i });

  if (!(await trialBtn.isVisible({ timeout: 3_000 }).catch(() => false))) {
    test.skip(true, "Trial already used or user is not on free plan");
  }

  await trialBtn.click();

  await expect(page.getByText(/starting trial/i)).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText(/trial active/i)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/current plan trial/i)).toBeVisible({ timeout: 15_000 });
});
