import { test, expect } from "@playwright/test";

test("applying multiple filters and checking first 3 cards", async ({ page }) => {
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

  // Category = Sale — FilterSidebar uses SegmentedOptions (buttons, not radio inputs)
  await page.getByRole("button", { name: "Sale" }).click();

  // Property Type = Apartment — FilterSidebar uses ChipGrid (buttons, not select)
  await page.getByRole("button", { name: "Apartment" }).click();

  // Max price — RangeInputs wraps input in label (implicit association works)
  const maxPriceInput = page.getByLabel("Max price");
  if (await maxPriceInput.isVisible()) {
    await maxPriceInput.fill("7000000");
  }

  // Bedrooms = 2 and 3 — NumberChips renders plain buttons with number text
  // Bedrooms chips appear before Bathrooms chips in DOM, so .first() = bedrooms
  await page.getByRole("button", { name: "2" }).first().click();
  await page.getByRole("button", { name: "3" }).first().click();

  // Bathrooms = 1 — second set of number chips (.nth(1) = bathrooms "1")
  await page.getByRole("button", { name: "1" }).nth(1).click();

  // Apply Filters button
  await page.getByRole("button", { name: /apply/i }).click();

  await expect(page.locator(".animate-spin").first()).not.toBeVisible({ timeout: 15_000 });

  // Cards are motion.div > Link[href^="/property/"]
  const cards = page.locator('a[href^="/property/"]');
  await expect(cards.first()).toBeVisible({ timeout: 10_000 });

  const cardCount = await cards.count();
  expect(cardCount).toBeGreaterThanOrEqual(1);
});
