import { defineConfig, devices } from "@playwright/test";

/**
 * E2E config. The dashboard requires a running Supabase stack and a seeded
 * admin user — see ONBOARDING.md for local setup. Override the target with
 * E2E_BASE_URL when pointing at a non-default host.
 *
 * Projects:
 *  - `setup`         logs in once and saves the admin session.
 *  - `public`        runs the unauthenticated specs (auth.spec.ts).
 *  - `authenticated` runs every module spec with the saved session.
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const ADMIN_STATE = "e2e/.auth/admin.json";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "html",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "public",
      testMatch: /auth\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "authenticated",
      testIgnore: [/auth\.spec\.ts/, /auth\.setup\.ts/],
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], storageState: ADMIN_STATE },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
