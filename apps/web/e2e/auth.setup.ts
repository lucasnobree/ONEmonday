import { test as setup, expect } from "@playwright/test";
import path from "node:path";

/**
 * Playwright "setup" project: logs in once with the local admin and saves the
 * session to a storageState file that the authenticated specs reuse. Override
 * the credentials with E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD.
 */
export const ADMIN_STATE = path.join(__dirname, ".auth", "admin.json");

setup("authenticate as admin", async ({ page }) => {
  const email = process.env.E2E_ADMIN_EMAIL ?? "admin@onemonday.local";
  const password = process.env.E2E_ADMIN_PASSWORD ?? "admin123";

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();

  // A successful login leaves /login for the dashboard.
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 15_000,
  });

  await page.context().storageState({ path: ADMIN_STATE });
  await expect(page).not.toHaveURL(/\/login/);
});
