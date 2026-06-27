import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, ".env.test") });

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["html", { open: "never" }], ["list"]],
  timeout: 30_000,

  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    headless: false,
    launchOptions: { slowMo: 300 },
    video: "retain-on-failure",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },

  projects: [
    // ── Auth tests (unauthenticated) ──────────────────────────────────
    {
      name: "auth",
      testMatch: "**/auth/**/*.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        storageState: { cookies: [], origins: [] },
      },
    },

    // ── User-authenticated tests (login inline per test) ──────────────
    {
      name: "user",
      testMatch: [
        "**/find-homes/**/*.spec.ts",
        "**/property/**/*.spec.ts",
        "**/dashboard/**/*.spec.ts",
        "**/pricing/**/*.spec.ts",
        "**/chatbot/**/*.spec.ts",
      ],
      use: {
        ...devices["Desktop Chrome"],
        storageState: { cookies: [], origins: [] },
      },
    },

    // ── Admin tests (login inline per test) ───────────────────────────
    {
      name: "admin",
      testMatch: "**/admin/**/*.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        storageState: { cookies: [], origins: [] },
      },
    },
  ],
});
