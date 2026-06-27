import { test, expect } from "@playwright/test";

test("user can sign up and log in", async ({ page }) => {
  const timestamp = Date.now();
  const testEmail = `testuser${timestamp}@gmail.com`;
  const testPassword = "Testuser123";

  await page.goto("/signup");

  await page.getByRole('textbox', { name: 'Full Name' }).fill("Test User");
  await page.getByLabel(/email/i).fill(testEmail);
  await page.getByRole('textbox', { name: 'Phone Number *' }).fill("01012345678");
  await page.locator('label').filter({ hasText: /^Male$/ }).click();
  // Use id selector — getByLabel(/password/i) also matches aria-label="Show password" buttons
  await page.locator("#signup-password").fill(testPassword);
  await page.locator("#confirm-password").fill(testPassword);
  await page.getByRole('checkbox', { name: 'I agree to the Terms of' }).click();

  await page.getByRole("button", { name: /sign up|create account/i }).click();

  await page.waitForURL(/\/(login|dashboard)/, { timeout: 15_000 });

  if (page.url().includes("/login")) {
    await page.getByLabel("Email Address").fill(testEmail);
    await page.locator('input[name="password"]').fill(testPassword);
    await page.getByRole("button", { name: "Log In" }).click();
    await page.waitForURL("/dashboard", { timeout: 15_000 });
  }

  await expect(
    page.getByRole("heading", { name: /manage your axiom workspace/i })
  ).toBeVisible({ timeout: 10_000 });
  expect(page.url()).toContain("/dashboard");
});
