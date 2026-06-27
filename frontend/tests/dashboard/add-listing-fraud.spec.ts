import { test, expect } from "@playwright/test";

test("submit fraud listing → status shows Pending Review in My Listings table", async ({ page }) => {
  await page.goto("/login");

  await page.getByLabel("Email Address").fill("Testuser1@gmail.com");
  await page.locator('input[name="password"]').fill("Testuser123");
  await page.getByRole("button", { name: "Log In" }).click();

  await page.waitForURL("/dashboard", { timeout: 15_000 });

  // Dashboard heading confirms the page rendered
  await expect(
    page.getByRole("heading", { name: "Manage your AXIOM workspace." })
  ).toBeVisible({ timeout: 15_000 });

  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: /manage your axiom workspace/i })
  ).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: /add listing/i }).click();
  await expect(page.getByRole("heading", { name: /add new listing/i })).toBeVisible();

  const modal = page.getByRole("dialog");

  // ── Step 0: Basics ────────────────────────────────────────────────
  await modal.getByPlaceholder(/modern apartment/i).fill("Fraud Test Listing");
  await modal.getByPlaceholder(/enter property address/i).fill("456 Test Street, Cairo");
  await page.getByRole("button", { name: /details/i }).click();

  // ── Step 1: Details ───────────────────────────────────────────────
  await modal.locator('input[type="number"]').first().fill("9000");
  await modal.locator('input[type="number"]').nth(1).fill("80");

  const availDate = modal.locator('input[type="date"]');
  if (await availDate.isVisible()) await availDate.fill("2025-12-12");

  await page.getByRole("button", { name: /photos/i }).click();

  // ── Step 2: Submit ────────────────────────────────────────────────
  await page.getByRole("button", { name: /submit for review/i }).click();

  await expect(page.getByRole("heading", { name: /add new listing/i }))
    .not.toBeVisible({ timeout: 20_000 });

  await expect(page.getByText("Fraud Test Listing")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/pending review/i)).toBeVisible({ timeout: 15_000 });
});
