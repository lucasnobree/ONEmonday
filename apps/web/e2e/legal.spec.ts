import { test, expect, type Page } from "@playwright/test";

/**
 * E2E coverage for the Legal (Juridico) module key flows.
 *
 * Assumes the standard local stack: the seeded global admin
 * (admin@onemonday.com) with the Legal module enabled for the active sector
 * (migration 00080 enables `legal` for every sector).
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

test.describe("Legal dashboard", () => {
  test("shows the dashboard sections and stat cards", async ({ page }) => {
    await page.goto("/legal");

    await expect(
      page.getByRole("heading", { name: "Juridico" })
    ).toBeVisible();
    await expect(page.getByText("Contratos Ativos")).toBeVisible();
    await expect(page.getByText("Vencem em 30 dias")).toBeVisible();
    await expect(page.getByText("Contratos por Status")).toBeVisible();
    await expect(
      page.getByText("Renovacoes que Exigem Acao")
    ).toBeVisible();
    await expect(
      page.getByText("Demandas Juridicas Abertas")
    ).toBeVisible();
  });

  test("navigates between the module tabs", async ({ page }) => {
    await page.goto("/legal");

    await page.getByRole("link", { name: "Contratos" }).click();
    await expect(page).toHaveURL(/\/legal\/contracts/);
    await expect(
      page.getByPlaceholder("Buscar por titulo ou contraparte")
    ).toBeVisible();

    await page.getByRole("link", { name: "Demandas" }).click();
    await expect(page).toHaveURL(/\/legal\/matters/);

    await page.getByRole("link", { name: "Clausulas" }).click();
    await expect(page).toHaveURL(/\/legal\/clauses/);
  });
});

test.describe("Contract repository", () => {
  test("creates a contract and sees it in the list", async ({ page }) => {
    await page.goto("/legal/contracts");

    await page.getByRole("button", { name: "Novo Contrato" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    const title = `E2E Contrato ${Date.now()}`;
    await dialog
      .getByPlaceholder("Ex: Contrato de prestacao de servicos")
      .fill(title);
    await dialog.getByPlaceholder("Ex: Acme Ltda").fill("E2E Counterparty");
    await dialog.getByRole("button", { name: "Criar Contrato" }).click();

    await expect(dialog).not.toBeVisible();
    await expect(page.getByText(title)).toBeVisible();
  });

  test("filters contracts by the free-text search", async ({ page }) => {
    await page.goto("/legal/contracts");

    const search = page.getByPlaceholder(
      "Buscar por titulo ou contraparte"
    );
    await search.fill("zzz-nao-existe-zzz");
    await expect(
      page.getByText(
        "Nenhum contrato encontrado com os filtros selecionados."
      )
    ).toBeVisible();
  });
});

test.describe("Legal matters intake", () => {
  test("creates a legal matter", async ({ page }) => {
    await page.goto("/legal/matters");

    await page.getByRole("button", { name: "Nova Demanda" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    const title = `E2E Demanda ${Date.now()}`;
    await dialog
      .getByPlaceholder("Ex: Revisar contrato de fornecedor")
      .fill(title);
    await dialog.getByRole("button", { name: "Criar Demanda" }).click();

    await expect(dialog).not.toBeVisible();
    await expect(page.getByText(title)).toBeVisible();
  });
});

test.describe("Clause library", () => {
  test("creates a clause and sees it as a card", async ({ page }) => {
    await page.goto("/legal/clauses");

    await page.getByRole("button", { name: "Nova Clausula" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    const title = `E2E Clausula ${Date.now()}`;
    await dialog
      .getByPlaceholder("Ex: Confidencialidade mutua")
      .fill(title);
    await dialog
      .getByPlaceholder("Texto da clausula")
      .fill("Conteudo de teste da clausula E2E.");
    await dialog.getByRole("button", { name: "Criar Clausula" }).click();

    await expect(dialog).not.toBeVisible();
    await expect(page.getByText(title)).toBeVisible();
  });
});
