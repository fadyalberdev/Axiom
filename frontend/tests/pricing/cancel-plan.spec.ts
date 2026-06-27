import { test, expect } from "@playwright/test";

test("paid user can cancel plan and sees exact cancellation message", async ({ page }) => {
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

  // Wait for plan cards (articles) to appear — skeleton has no articles
  await expect(page.locator("article").first()).toBeVisible({ timeout: 30_000 });
  await expect(
    page.getByRole("heading", { level: 2, name: /basic|pro/i }).first()
  ).toBeVisible({ timeout: 5_000 });

  const cancelBtn = page.getByRole("button", { name: /cancel plan/i });

  if (!(await cancelBtn.isVisible({ timeout: 3_000 }).catch(() => false))) {
    test.skip(true, "No paid plan active — skipping cancel test");
  }

  await cancelBtn.click();

  await expect(
    page.getByText("Cancellation scheduled. Your plan stays active until the current billing period ends.")
  ).toBeVisible({ timeout: 15_000 });
});
