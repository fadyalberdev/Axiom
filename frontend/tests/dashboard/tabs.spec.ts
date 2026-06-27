import { test, expect } from "@playwright/test";

test("dashboard Listings and Saved tabs render correct content", async ({ page }) => {
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

  // h1 text is "Manage your AXIOM workspace." — regex avoids strict mode from .or() chains
  await expect(
    page.getByRole("heading", { name: /manage your axiom workspace/i })
  ).toBeVisible({ timeout: 15_000 });

  // ── Listings tab (default) ─────────────────────────────────────────
  const listingsTab = page.getByRole("tab", { name: /listings/i });
  await expect(listingsTab).toBeVisible({ timeout: 10_000 });
  await listingsTab.click({ timeout: 10_000 });

  const listingsPanel = page.getByRole("tabpanel");
  await expect(listingsPanel).toBeVisible({ timeout: 10_000 });
  await expect(
    listingsPanel.locator("article, [class*='card'], tr, p").first()
  ).toBeVisible({ timeout: 8_000 });

  // ── Saved tab ──────────────────────────────────────────────────────
  const savedTab = page.getByRole("tab", { name: /saved/i });
  await expect(savedTab).toBeVisible({ timeout: 10_000 });
  await savedTab.click({ timeout: 10_000 });

  await expect(listingsPanel).toBeVisible({ timeout: 10_000 });
  await expect(
    listingsPanel.locator("article, [class*='card'], p").first()
  ).toBeVisible({ timeout: 8_000 });

  // Switch back to Listings
  await listingsTab.click({ timeout: 10_000 });
  await expect(listingsPanel).toBeVisible({ timeout: 10_000 });
});
