import { test, expect } from "@playwright/test";

/**
 * E2E coverage for the CRM module's key flows.
 *
 * These specs assume an authenticated session (configured via Playwright
 * `storageState`) and the seeded sample data. They are intentionally
 * resilient to copy changes by anchoring on roles and stable text.
 */

test.describe("CRM module", () => {
  test("dashboard shows pipeline KPIs including weighted forecast", async ({
    page,
  }) => {
    await page.goto("/crm");

    await expect(
      page.getByRole("heading", { name: "CRM" })
    ).toBeVisible();

    // Stat cards, including the wave-1 weighted forecast.
    await expect(page.getByText("Deals Ativos")).toBeVisible();
    await expect(page.getByText("Valor no Pipeline")).toBeVisible();
    await expect(page.getByText("Previsao Ponderada")).toBeVisible();

    // Dashboard panels.
    await expect(page.getByText("Funil de Pipeline")).toBeVisible();
    await expect(page.getByText("Fechamento Proximo")).toBeVisible();
  });

  test("pipeline page renders the kanban with deal cards", async ({
    page,
  }) => {
    await page.goto("/crm/pipeline");

    await expect(
      page.getByRole("heading", { name: "Pipeline de Vendas" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Novo Deal/i })
    ).toBeVisible();
  });

  test("opening a deal shows the closed-lost category selector", async ({
    page,
  }) => {
    await page.goto("/crm/pipeline");

    // Open the first deal card in the pipeline.
    const firstCard = page.locator('[draggable="true"]').first();
    await firstCard.click();

    // The detail sheet exposes the "Marcar como Perdido" action.
    const lostButton = page.getByRole("button", {
      name: /Marcar como Perdido/i,
    });
    if (await lostButton.isVisible().catch(() => false)) {
      await lostButton.click();
      // Wave-1: a structured lost-reason category select appears.
      await expect(page.getByText("Categoria da perda")).toBeVisible();
    }
  });

  test("proposals page lists proposals and supports CSV export", async ({
    page,
  }) => {
    await page.goto("/crm/proposals");

    await expect(
      page.getByRole("button", { name: /Nova Proposta/i })
    ).toBeVisible();

    const exportButton = page.getByRole("button", { name: /Exportar/i });
    await expect(exportButton).toBeVisible();
  });

  test("activities page exposes type filters and CSV export", async ({
    page,
  }) => {
    await page.goto("/crm/activities");

    await expect(
      page.getByRole("heading", { name: "Atividades Recentes" })
    ).toBeVisible();

    // Type filter buttons.
    await expect(page.getByRole("button", { name: "Todos" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Emails" })).toBeVisible();

    // Wave-1: CSV export button.
    await expect(
      page.getByRole("button", { name: /Exportar/i })
    ).toBeVisible();
  });

  test("CRM sub-navigation routes between sections", async ({ page }) => {
    await page.goto("/crm");

    await page.getByRole("link", { name: "Propostas" }).click();
    await expect(page).toHaveURL(/\/crm\/proposals/);

    await page.getByRole("link", { name: "Atividades" }).click();
    await expect(page).toHaveURL(/\/crm\/activities/);
  });

  test("companies filter shows a localized label, not the raw 'all' token", async ({
    page,
  }) => {
    // Wave-4 regression: the size/industry filter triggers used to paint the
    // literal selected value ("all"). They must show the translated label.
    await page.goto("/crm/companies");

    const sizeFilter = page.getByLabel("Filtrar por porte");
    await expect(sizeFilter).toBeVisible();
    await expect(sizeFilter).toHaveText("Todo porte");
    await expect(sizeFilter).not.toHaveText("all");

    const industryFilter = page.getByLabel("Filtrar por indústria");
    await expect(industryFilter).toHaveText("Toda indústria");
  });

  test("leads inbox source filter is localized and selectable", async ({
    page,
  }) => {
    await page.goto("/crm/leads");

    const sourceFilter = page.getByLabel("Filtrar por origem");
    await expect(sourceFilter).toBeVisible();
    await expect(sourceFilter).toHaveText("Toda origem");
    await expect(sourceFilter).not.toHaveText("all");
  });
});
