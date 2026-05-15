import { test, expect, type Page } from "@playwright/test";

/**
 * E2E coverage for the HR (RH Portal) module key flows.
 *
 * These specs assume the standard local stack: the seeded global admin
 * (admin@onemonday.com) and the seeded HR sector with sample employees.
 * Credentials can be overridden via E2E_EMAIL / E2E_PASSWORD.
 *
 * Per project policy E2E specs are written but NOT executed by this agent
 * (the dev server and Supabase CLI are shared resources).
 */

const EMAIL = process.env.E2E_EMAIL ?? "admin@onemonday.com";
const PASSWORD = process.env.E2E_PASSWORD ?? "onemonday123";

async function login(page: Page) {
  await page.goto("/login");
  await page.locator("#email").fill(EMAIL);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

test.beforeEach(async ({ page }) => {
  await login(page);
});

test.describe("HR dashboard", () => {
  test("shows the enriched dashboard sections", async ({ page }) => {
    await page.goto("/hr");
    await expect(
      page.getByText("Distribuicao por Departamento")
    ).toBeVisible();
    await expect(page.getByText("Onboardings Ativos")).toBeVisible();
    // Wave 1 addition: expiring documents card.
    await expect(page.getByText("Documentos Vencendo")).toBeVisible();
  });
});

test.describe("Employee directory", () => {
  test("filters employees with the free-text search", async ({ page }) => {
    await page.goto("/hr/employees");

    const search = page.getByPlaceholder("Buscar por nome, email ou cargo");
    await expect(search).toBeVisible();

    const rows = page.locator("table tbody tr");
    await expect(rows.first()).toBeVisible();

    // Searching for an unlikely term should empty the table.
    await search.fill("zzz-nao-existe-zzz");
    await expect(
      page.getByText("Nenhum colaborador encontrado com os filtros selecionados.")
    ).toBeVisible();

    await search.fill("");
    await expect(rows.first()).toBeVisible();
  });

  test("opens the employee profile sheet with documents tab", async ({
    page,
  }) => {
    await page.goto("/hr/employees");
    await page.locator("table tbody tr").first().click();

    await expect(page.getByRole("tab", { name: "Documentos" })).toBeVisible();
    await page.getByRole("tab", { name: "Documentos" }).click();
    // Wave 1 addition: optional expiry date field on the upload bar.
    await expect(page.getByText("Validade (opcional)")).toBeVisible();
  });
});

test.describe("Onboarding", () => {
  test("switches between active onboardings and templates", async ({
    page,
  }) => {
    await page.goto("/hr/onboarding");

    await page.getByRole("button", { name: "Templates" }).click();
    await expect(
      page.getByRole("button", { name: "Novo Template" })
    ).toBeVisible();

    await page.getByRole("button", { name: "Ativos" }).click();
  });

  test("creates and discards an onboarding template", async ({ page }) => {
    await page.goto("/hr/onboarding");
    await page.getByRole("button", { name: "Templates" }).click();
    await page.getByRole("button", { name: "Novo Template" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog
      .getByPlaceholder("Ex: Onboarding Desenvolvedor")
      .fill("E2E Template Temporario");
    await dialog.getByRole("button", { name: "Adicionar" }).click();
    await dialog
      .getByPlaceholder("Titulo da etapa")
      .fill("Configurar acessos");

    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).not.toBeVisible();
  });
});

test.describe("Time off", () => {
  test("lists requests with a balance column", async ({ page }) => {
    await page.goto("/hr/time-off");
    await expect(
      page.getByText("Solicitacoes de Ferias e Ausencias")
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Saldo" })
    ).toBeVisible();
  });
});
