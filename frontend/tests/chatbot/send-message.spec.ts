import { test, expect } from "@playwright/test";

test("AI chatbot opens, accepts message, and streams response without error", async ({ page }) => {
  await page.goto("/login");

  await page.getByLabel("Email Address").fill("Testuser1@gmail.com");
  await page.locator('input[name="password"]').fill("Testuser123");
  await page.getByRole("button", { name: "Log In" }).click();

  await page.waitForURL("/dashboard", { timeout: 15_000 });

  // Dashboard heading confirms the page rendered
  await expect(
    page.getByRole("heading", { name: "Manage your AXIOM workspace." })
  ).toBeVisible({ timeout: 15_000 });

  await page.goto("/");

  // Floating button has aria-label="Open AI chat"
  const aiButton = page.getByRole("button", { name: /open ai chat/i });
  await expect(aiButton).toBeVisible({ timeout: 10_000 });
  await aiButton.click();

  // ChatDrawer renders as motion.div (not role="dialog") — wait for the input inside it
  const input = page.getByPlaceholder("Ask about properties, prices, areas...");
  await expect(input).toBeVisible({ timeout: 5_000 });

  await input.fill("What properties are available in Maadi?");

  await page.getByRole('button').filter({ hasText: /^$/ }).nth(4).click();

  // Wait for AI response message to appear
  await expect(
    page.locator('div').filter({ hasText: /^Here is 1 apartment in Maadi:$/ })
  ).toBeVisible({ timeout: 1000_000 });

  // No error state visible
  await expect(page.getByText(/error|failed|500/i)).not.toBeVisible();
});
