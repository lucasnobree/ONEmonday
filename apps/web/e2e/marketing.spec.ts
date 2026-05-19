import { test, expect } from "@playwright/test";

/**
 * E2E coverage for the Marketing module. Runs in the `authenticated` project
 * (saved admin session); anchors on roles and stable text.
 */
test.describe("Marketing module", () => {
  test("the sidebar tree exposes the Marketing sub-pages", async ({
    page,
  }) => {
    // Post nav-shell refactor: Marketing sub-pages live in the sidebar tree,
    // not an in-screen tab strip. Expand the Marketing module to reveal them.
    await page.goto("/marketing");

    await expect(
      page.getByRole("heading", { name: "Marketing" })
    ).toBeVisible();

    const nav = page.getByRole("navigation", { name: "Navegação por setor" });
    const marketingModule = nav
      .getByRole("button", { name: "Marketing" })
      .first();
    if ((await marketingModule.getAttribute("aria-expanded")) !== "true") {
      await marketingModule.click();
    }

    for (const sub of ["Visão Geral", "Campanhas", "Calendário", "Audiências"]) {
      await expect(nav.getByRole("link", { name: sub })).toBeVisible();
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
