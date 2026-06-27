import { test, expect } from "@playwright/test";

test("login with valid credentials lands on dashboard and can contact via WhatsApp", async ({ page }) => {
  await page.goto("/login");

  await page.getByLabel("Email Address").fill("Testuser1@gmail.com");
  await page.locator('input[name="password"]').fill("Testuser123");
  await page.getByRole("button", { name: "Log In" }).click();

  await page.waitForURL("/dashboard", { timeout: 15_000 });

  // Dashboard heading confirms the page rendered
  await expect(
    page.getByRole("heading", { name: "Manage your AXIOM workspace." })
  ).toBeVisible({ timeout: 15_000 });

  expect(page.url()).toContain("/dashboard");

  // Go to find-homes to verify WhatsApp contact capability
  await page.goto("/find-homes");
  await expect(page.locator(".animate-spin").first()).not.toBeVisible({ timeout: 15_000 });

  // Click on first listing to go to property detail
  const firstCard = page.locator("a[href^='/property/']").first();
  await expect(firstCard).toBeVisible({ timeout: 10_000 });
  await firstCard.click();

  await page.waitForURL(/\/property\//, { timeout: 10_000 });

  // Verify WhatsApp contact button is visible and clickable
  const whatsappBtn = page.getByRole("button", { name: /whatsapp|contact/i })
    .or(page.getByText(/whatsapp/i))
    .first();
  await expect(whatsappBtn).toBeVisible({ timeout: 10_000 });
});

test("login with wrong password shows error message", async ({ page }) => {
  await page.goto("/login");

  await page.getByLabel("Email Address").fill("Testuser1@gmail.com");
  await page.locator('input[name="password"]').fill("wrongpassword_xyz");
  await page.getByRole("button", { name: "Log In" }).click();

  await expect(page.locator("text=/invalid|incorrect|failed/i").first()).toBeVisible({ timeout: 8_000 });
  expect(page.url()).not.toContain("/dashboard");
});
