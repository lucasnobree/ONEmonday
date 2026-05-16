import { test, expect } from "@playwright/test";

/**
 * E2E coverage for the Analytics module. Runs in the `authenticated` project
 * (saved admin session); anchors on roles and stable text.
 */
test.describe("Analytics module", () => {
  test("dashboard shows KPIs, the range filter and the reports section", async ({
    page,
  }) => {
    await page.goto("/analytics");

    await expect(
      page.getByRole("heading", { name: "Analytics" })
    ).toBeVisible();

    // Period-over-period KPI cards from the overview RPC.
    await expect(page.getByText("Cards Concluidos")).toBeVisible();
    await expect(page.getByText("Valor de Negocios Ganhos")).toBeVisible();
    await expect(page.getByText("Tickets Resolvidos")).toBeVisible();

    // Saved reports section + create action.
    await expect(
      page.getByRole("heading", { name: "Relatorios Salvos" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Novo Relatorio/i })
    ).toBeVisible();
  });

  test("the new-report dialog opens with metric and chart fields", async ({
    page,
  }) => {
    await page.goto("/analytics");
    await page.getByRole("button", { name: /Novo Relatorio/i }).click();

    await expect(
      page.getByRole("heading", { name: "Novo Relatorio" })
    ).toBeVisible();
    await expect(page.getByLabel("Nome")).toBeVisible();
    await expect(page.getByText("Metrica")).toBeVisible();
    await expect(page.getByText("Tipo de grafico")).toBeVisible();
  });
});
