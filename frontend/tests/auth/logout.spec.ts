import { test, expect } from "@playwright/test";

test("logout clears session and WhatsApp contact redirects to login", async ({ page }) => {
  // Login first
  await page.goto("/login");
  await page.getByLabel("Email Address").fill("Testuser1@gmail.com");
  await page.locator('input[name="password"]').fill("Testuser123");
  await page.getByRole("button", { name: "Log In" }).click();
  await page.waitForURL("/dashboard", { timeout: 15_000 });

  // Find and click logout - it's in a dropdown menu
  // First click the user avatar/menu to open dropdown
  await page.getByRole("button", { name: /menu|profile|avatar/i }).or(page.locator("button").filter({ has: page.locator("img") })).first().click({ timeout: 5_000 });
  
  // Then click logout in the dropdown
  await page.getByRole("menuitem", { name: "Log Out" }).or(page.getByText("Log Out")).click({ timeout: 5_000 });

  // Should land on home or login
  await page.waitForURL(/\/(login)?$/, { timeout: 10_000 });

  // Go to a listing
  await page.goto("/find-homes");
  await expect(page.locator(".animate-spin").first()).not.toBeVisible({ timeout: 15_000 });

  // Click on first listing to go to property detail
  const firstCard = page.locator("a[href^='/property/']").first();
  await expect(firstCard).toBeVisible({ timeout: 10_000 });
  await firstCard.click();

  await page.waitForURL(/\/property\//, { timeout: 10_000 });

  // Click WhatsApp contact button
  const whatsappBtn = page.getByRole("button", { name: /whatsapp|contact/i })
    .or(page.getByText(/whatsapp/i))
    .first();
  await whatsappBtn.click();

  // Should redirect to login page
  await page.waitForURL(/\/login/, { timeout: 10_000 });
  expect(page.url()).toContain("/login");
});
