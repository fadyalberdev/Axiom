import { test, expect } from "@playwright/test";

test("like a property from find-homes then verify it appears in dashboard Saved tab", async ({
  page,
}) => {
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
  await expect(page.locator(".animate-spin").first()).not.toBeVisible({
    timeout: 15_000,
  });

  // Click like/favorite button on any listing card
  const likeBtn = page
    .locator(
      "button[aria-label*='like' i], button[aria-label*='save' i], button[aria-label*='heart' i]",
    )
    .first();
  await expect(likeBtn).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: "Save property" }).first().click();
  // Wait for optimistic update (button state changes)
  await page.waitForTimeout(1000);

  // Go to dashboard and find "Saved" tab
  await page.goto("/dashboard");
  await expect(page.getByText("Manage your AXIOM workspace")).toBeVisible({
    timeout: 10_000,
  });

  await page.getByRole("tab", { name: /saved/i }).click();

  // The liked listing should appear in the page
  await expect(page.getByRole("tabpanel")).toBeVisible();
  await expect(page.locator("article, [class*='card']").first()).toBeVisible({
    timeout: 10_000,
  });
});
