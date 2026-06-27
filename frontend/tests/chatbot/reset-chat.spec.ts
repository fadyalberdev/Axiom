import { test, expect } from "@playwright/test";

test("reset chat button clears conversation history and shows only welcome text", async ({ page }) => {
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

  const aiButton = page.getByRole("button", { name: /open ai chat/i });
  await aiButton.click();

  // ChatDrawer renders as motion.div — wait for the input
  const input = page.getByPlaceholder("Ask about properties, prices, areas...");
  await expect(input).toBeVisible({ timeout: 5_000 });

  await input.fill("Hello");
  await page.getByRole('button').filter({ hasText: /^$/ }).nth(4).click(); // Click the send button (no visible text, only icon)

  // Wait for response
  await expect(
    page.locator('div').filter({ hasText: 'Hello! How can I assist you' }).nth(5)
  ).toBeVisible({ timeout: 1000_000 });

  // Reset button has title="Clear chat" (RotateCcw icon, no visible text)
  const resetBtn = page.locator('button[title="Clear chat"]');
  await expect(resetBtn).toBeVisible();
  await resetBtn.click();

  await expect(page.locator('div').filter({ hasText: 'Hello! How can I assist you' }).nth(5)).not.toBeVisible();

  const welcomeText = "مرحباً / Hello — I speak Arabic and English. Tell me what you're looking for and I'll search our live listings across Egypt for you.";
  await expect(page.getByText(welcomeText)).toBeVisible({ timeout: 10_000 });
});
