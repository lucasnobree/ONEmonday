import { test, expect } from "@playwright/test";

/**
 * E2E coverage for the Finance (Financeiro) module.
 *
 * These specs assume an authenticated session (configured via Playwright
 * `storageState`) and the seeded sample data. They anchor on roles and
 * stable text so they survive copy tweaks.
 */

test.describe("Finance module", () => {
  test("dashboard shows cash-flow KPIs and chart", async ({ page }) => {
    await page.goto("/finance");

    await expect(
      page.getByRole("heading", { name: "Financeiro" })
    ).toBeVisible();

    // Summary KPI cards.
    await expect(page.getByText("Receita Recebida")).toBeVisible();
    await expect(page.getByText("Despesa Paga")).toBeVisible();
    await expect(page.getByText("Caixa Liquido")).toBeVisible();
    await expect(page.getByText("A Receber (em aberto)")).toBeVisible();

    // Cash-flow chart panel.
    await expect(page.getByText("Fluxo de Caixa")).toBeVisible();
  });

  test("invoices page lists invoices and exposes status filters", async ({
    page,
  }) => {
    await page.goto("/finance/invoices");

    await expect(
      page.getByRole("heading", { name: "Faturas" })
    ).toBeVisible();

    // Create + export actions.
    await expect(
      page.getByRole("button", { name: /Nova Fatura/i })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Exportar/i })
    ).toBeVisible();

    // Status filter tabs.
    await expect(page.getByRole("button", { name: "Todas" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Paga" })).toBeVisible();
  });

  test("new-invoice dialog validates required fields", async ({ page }) => {
    await page.goto("/finance/invoices");

    await page.getByRole("button", { name: /Nova Fatura/i }).click();

    await expect(
      page.getByRole("heading", { name: "Nova Fatura" })
    ).toBeVisible();

    // The submit button is disabled until number + customer are filled.
    const submit = page.getByRole("button", { name: "Criar Fatura" });
    await expect(submit).toBeDisabled();

    await page.getByLabel("Numero").fill("INV-E2E-001");
    await page.getByLabel("Cliente").fill("Cliente Teste E2E");
    await expect(submit).toBeEnabled();
  });

  test("expenses page lists expenses with category filters", async ({
    page,
  }) => {
    await page.goto("/finance/expenses");

    await expect(
      page.getByRole("heading", { name: "Despesas" })
    ).toBeVisible();

    await expect(
      page.getByRole("button", { name: /Nova Despesa/i })
    ).toBeVisible();

    // Category filter tabs.
    await expect(page.getByRole("button", { name: "Todas" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Software" })).toBeVisible();
  });

  test("budgets page renders budget-vs-actual view", async ({ page }) => {
    await page.goto("/finance/budgets");

    await expect(
      page.getByRole("heading", { name: "Orcamentos" })
    ).toBeVisible();

    await expect(
      page.getByRole("button", { name: /Novo Orcamento/i })
    ).toBeVisible();
  });

  test("finance sub-navigation routes between sections", async ({ page }) => {
    await page.goto("/finance");

    await page.getByRole("link", { name: "Faturas" }).click();
    await expect(page).toHaveURL(/\/finance\/invoices/);

    await page.getByRole("link", { name: "Despesas" }).click();
    await expect(page).toHaveURL(/\/finance\/expenses/);

    await page.getByRole("link", { name: "Orcamentos" }).click();
    await expect(page).toHaveURL(/\/finance\/budgets/);
  });
});
