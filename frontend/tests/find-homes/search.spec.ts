import { test, expect } from "@playwright/test";

test("regular keyword search returns listings and verifies first 3 cards", async ({ page }) => {
  await page.goto("/find-homes");

  const searchInput = page.getByPlaceholder(/search by location/i);
  await searchInput.fill("apartment under 7M");

  await expect(page.getByRole("button", { name: "Search" })).toBeVisible();
  await page.getByRole("button", { name: "Search" }).click();

  await expect(page.locator(".animate-spin").first()).not.toBeVisible({ timeout: 15_000 });

  // SearchListingCard renders as motion.div > Link[href^="/property/"]
  const cards = page.locator('a[href^="/property/"]');
  await expect(cards.first()).toBeVisible({ timeout: 10_000 });

  const cardCount = await cards.count();
  expect(cardCount).toBeGreaterThanOrEqual(3);

  await expect(page.getByText(/showing/i)).toBeVisible({ timeout: 10_000 });
});
