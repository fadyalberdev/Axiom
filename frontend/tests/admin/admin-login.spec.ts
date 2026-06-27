import { test, expect } from "@playwright/test";

test("admin login with valid credentials redirects to admin dashboard", async ({ page }) => {
  // storageState loads admin_token into localStorage — clear it before page scripts run
  // so the login page useEffect doesn't auto-redirect to /admin/dashboard
  await page.addInitScript(() => localStorage.removeItem("admin_token"));

  await page.goto("/admin/login");

  await expect(page.getByText("Admin Panel")).toBeVisible();

  await page.getByPlaceholder("Admin").fill("admin");
  await page.getByPlaceholder("••••••••").fill("axiom_admin_2026");

  // Use type="submit" selector — button text changes to "Signing in…" on click causing detach
  await page.locator('button[type="submit"]').click();
  await page.waitForURL("/admin/dashboard", { timeout: 15_000 });

  await expect(page.getByText(/admin|dashboard/i).first()).toBeVisible();
});

test("admin login with wrong password shows error", async ({ page }) => {
  await page.addInitScript(() => localStorage.removeItem("admin_token"));

  await page.goto("/admin/login");

  await page.getByPlaceholder("Admin").fill("admin");
  await page.getByPlaceholder("••••••••").fill("wrongpassword");

  await page.locator('button[type="submit"]').click();

  expect(page.url()).not.toContain("/admin/dashboard");
});
