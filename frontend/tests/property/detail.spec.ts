import { test, expect } from "@playwright/test";

test("clicking a listing card opens property detail page", async ({ page }) => {
  await page.goto("/login");

  await page.getByLabel("Email Address").fill("Testuser1@gmail.com");
  await page.locator('input[name="password"]').fill("Testuser123");
  await page.getByRole("button", { name: "Log In" }).click();

  await page.waitForURL("/dashboard", { timeout: 15_000 });

  // Dashboard heading confirms the page rendered
  await expect(
    page.getByRole("heading", { name: "Manage your AXIOM workspace." })
  ).toBeVisible({ timeout: 15_000 });

  await page.goto("/find-homes");

  await expect(page.locator(".animate-spin").first()).not.toBeVisible({ timeout: 15_000 });

  // Click first listing card (links to /property/[id])
  const firstCard = page.locator("a[href^='/property/']").first();
  await expect(firstCard).toBeVisible({ timeout: 10_000 });

  const href = await firstCard.getAttribute("href");
  await firstCard.click();

  await page.waitForURL(/\/property\//, { timeout: 10_000 });

  // Property page essentials visible
  await expect(page.getByRole("heading").first()).toBeVisible();
  await expect(page.getByText(/EGP/i).first()).toBeVisible();

  // Map section rendered
  await expect(
    page.locator("iframe, [class*='map'], [id*='map']").first()
  ).toBeVisible({ timeout: 10_000 });
});
