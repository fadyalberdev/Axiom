import { test, expect } from "@playwright/test";

test("admin can approve a pending listing and it appears in find-homes", async ({ page }) => {

  await page.goto("/login");
  await page.getByPlaceholder("name@example.com").fill("Testuser1@gmail.com");
  await page.getByPlaceholder("Password").fill("Testuser123");
  await page.locator('button[type="submit"]').click();
  await page.waitForURL("/dashboard", { timeout: 15_000 });

  // Create a pending listing as regular user
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: /manage your axiom workspace/i })
  ).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: /add listing/i }).click();
  await expect(page.getByRole("heading", { name: /add new listing/i })).toBeVisible();

  const modal = page.getByRole("dialog");

  await modal.getByPlaceholder(/modern apartment/i).fill("Test Pending Listing for Approval");
  await modal.getByPlaceholder(/enter property address/i).fill("123 Test Street, Cairo,china");
  await page.getByRole("button", { name: /details/i }).click();

  await modal.locator('input[type="number"]').first().fill("1");
  await modal.locator('input[type="number"]').nth(1).fill("1");
  await modal.locator('input[type="date"]').first().fill('2024-11-01');
  await page.getByRole("button", { name: /photos/i }).click();

  await page.getByRole("button", { name: /submit for review/i }).click();
  await expect(page.getByRole("heading", { name: /add new listing/i }))
    .not.toBeVisible({ timeout: 20_000 });

  // Login as admin
  await page.goto("/admin/login");
  await page.getByPlaceholder("Admin").fill("admin");
  await page.getByPlaceholder("••••••••").fill("axiom_admin_2026");
  await page.locator('button[type="submit"]').click();
  await page.waitForURL("/admin/dashboard", { timeout: 15_000 });

  await page.getByRole('button', { name: 'Pending Approvals' }).click();

  const pendingFilter = page.getByRole("button", { name: /pending/i })
    .or(page.getByText(/pending/i).first());
  if (await pendingFilter.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await pendingFilter.click();
  }

  await expect(page.locator("table, [role='table']")).toBeVisible({ timeout: 10_000 });

  const pendingRow = page.locator("tr").filter({ hasText: /pending/i }).first();
  await expect(pendingRow).toBeVisible({ timeout: 10_000 });

  await pendingRow.getByRole("button", { name: /approve/i }).click();

  const confirmBtn = page.getByRole("button", { name: /confirm|yes/i });
  if (await confirmBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await confirmBtn.click();
  }

  await page.goto("/find-homes");
  await expect(page.locator(".animate-spin").first()).not.toBeVisible({ timeout: 15_000 });

  await expect(page.getByText("Test Pending Listing for Approval")).toBeVisible({ timeout: 10_000 });
});
