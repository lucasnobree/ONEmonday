import { test, expect } from "@playwright/test";

/**
 * E2E coverage for the Marketing module. Runs in the `authenticated` project
 * (saved admin session); anchors on roles and stable text.
 */
test.describe("Marketing module", () => {
  test("the module shell exposes the four nav tabs", async ({ page }) => {
    await page.goto("/marketing");

    await expect(
      page.getByRole("heading", { name: "Marketing" })
    ).toBeVisible();

    for (const tab of ["Visao Geral", "Campanhas", "Calendario", "Audiencias"]) {
      await expect(page.getByRole("link", { name: tab })).toBeVisible();
    }
  });

  test("campaigns page lists campaigns and opens the create dialog", async ({
    page,
  }) => {
    await page.goto("/marketing/campaigns");

    await expect(
      page.getByRole("heading", { name: "Campanhas" })
    ).toBeVisible();

    await page.getByRole("button", { name: /Nova Campanha/i }).click();
    await expect(
      page.getByRole("heading", { name: /Campanha/i })
    ).toBeVisible();
  });

  test("the content calendar page renders", async ({ page }) => {
    await page.goto("/marketing/calendar");
    await expect(
      page.getByRole("heading", { name: "Calendario Editorial" })
    ).toBeVisible();
  });

  test("audiences page lists segments and opens the create dialog", async ({
    page,
  }) => {
    await page.goto("/marketing/audiences");

    await expect(
      page.getByRole("heading", { name: "Audiencias" })
    ).toBeVisible();

    await page.getByRole("button", { name: /Nova Audiencia/i }).click();
    await expect(
      page.getByRole("heading", { name: /Audiencia/i })
    ).toBeVisible();
  });
});
