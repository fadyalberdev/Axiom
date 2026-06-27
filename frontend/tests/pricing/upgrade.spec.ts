import { test, expect } from "@playwright/test";

test("upgrade to PRO plan via Stripe and verify Current plan PRO", async ({ page }) => {
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
  await expect(page.getByRole("heading", { level: 2, name: /basic/i })).toBeVisible();

  const upgradeBtn = page.getByRole("button", { name: /upgrade/i }).first();
  await expect(upgradeBtn).toBeVisible();
  await upgradeBtn.click();

  await page.waitForURL(/stripe/, { timeout: 15_000 });

  const emailInput = page.locator("input[type='email']").or(page.getByLabel(/email/i)).first();
  if (await emailInput.isVisible({ timeout: 5_000 })) {
    await emailInput.fill("Testuser1@gmail.com");
  }

  const cardInput = page.locator("input[name='cardnumber'], input[placeholder*='4242']").or(page.getByLabel(/card number/i)).first();
  if (await cardInput.isVisible({ timeout: 5_000 })) {
    await cardInput.fill("4242424242424242");
  }

  const expiryInput = page.locator("input[name='exp-date'], input[placeholder*='MM/YY']").or(page.getByLabel(/expiry/i)).first();
  if (await expiryInput.isVisible({ timeout: 5_000 })) {
    await expiryInput.fill("12/59");
  }

  const cvcInput = page.locator("input[name='cvc'], input[placeholder*='CVC']").or(page.getByLabel(/cvc/i)).first();
  if (await cvcInput.isVisible({ timeout: 5_000 })) {
    await cvcInput.fill("123");
  }

  const nameInput = page.locator("input[name='cardholder'], input[placeholder*='name']").or(page.getByLabel(/name on card/i)).first();
  if (await nameInput.isVisible({ timeout: 5_000 })) {
    await nameInput.fill("TESTuser1");
  }

  const subscribeBtn = page.getByRole("button", { name: /subscribe|pay/i }).first();
  if (await subscribeBtn.isVisible({ timeout: 5_000 })) {
    await subscribeBtn.click();
  }

  await page.waitForURL("/dashboard", { timeout: 30_000 });
  expect(page.url()).toContain("/dashboard");

  await page.goto("/pricing");
  await expect(page.locator("article").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/current plan pro/i)).toBeVisible({ timeout: 15_000 });
});
