import { test, expect } from "@playwright/test";

/**
 * End-to-end coverage for the Support Desk module key flows.
 *
 * These specs assume an authenticated session against a seeded
 * Supabase instance (sample_data_modules.sql) with the
 * "Desenvolvimento" sector selected. They are written to be run by the
 * shared E2E harness; this module only authors the specs.
 */

test.describe("Support Desk", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/support");
  });

  test("dashboard renders stats and SLA banner area", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Tickets Recentes" })
    ).toBeVisible();
    await expect(page.getByText("Total Tickets")).toBeVisible();
    await expect(page.getByText("SLA Violados")).toBeVisible();
  });

  test("tickets list shows filters and a tickets table", async ({ page }) => {
    await page.goto("/support/tickets");
    await expect(page.getByRole("heading", { name: "Tickets" })).toBeVisible();
    // Status, priority, category and tag filters are present.
    await expect(page.getByText("Responsavel")).toBeVisible();
    await expect(page.getByText("SLA", { exact: true })).toBeVisible();
  });

  test("opening a ticket shows the detail sheet with tabs", async ({
    page,
  }) => {
    await page.goto("/support/tickets");
    const firstRow = page.locator("table tbody tr").first();
    await firstRow.click();
    await expect(page.getByRole("tab", { name: "Detalhes" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Comentarios" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Atividade" })).toBeVisible();
    // Tags and Responsaveis sections from wave 1.
    await expect(page.getByText("Tags", { exact: true })).toBeVisible();
    await expect(page.getByText("Responsaveis")).toBeVisible();
  });

  test("a ticket can be tagged from the detail sheet", async ({ page }) => {
    await page.goto("/support/tickets");
    await page.locator("table tbody tr").first().click();
    await page.getByRole("button", { name: "Tag" }).click();
    const tagInput = page.getByPlaceholder("Buscar ou criar tag...");
    await expect(tagInput).toBeVisible();
    await tagInput.fill("regressao");
    // Either an existing tag or the create option is offered.
    await expect(
      page.getByText(/Criar "regressao"|regressao/).first()
    ).toBeVisible();
  });

  test("an open ticket can be assigned and resolved", async ({ page }) => {
    await page.goto("/support/tickets");
    // Pick the first open ticket (has a resolve action).
    const openRow = page
      .locator("table tbody tr", { hasText: "Aberto" })
      .first();
    await openRow.click();

    // Assignee picker is available.
    await expect(
      page.getByRole("button", { name: "Atribuir responsavel" })
    ).toBeVisible();

    // Resolve the ticket.
    await page.getByRole("button", { name: "Resolver Ticket" }).click();
    await expect(page.getByText("Ticket resolvido")).toBeVisible();

    // A resolved ticket exposes the reopen action.
    await expect(
      page.getByRole("button", { name: "Reabrir Ticket" })
    ).toBeVisible();
  });

  test("SLA rules page supports creating a rule", async ({ page }) => {
    await page.goto("/support/sla-rules");
    await expect(
      page.getByRole("heading", { name: "Regras de SLA" })
    ).toBeVisible();
    await page.getByRole("button", { name: "Nova Regra SLA" }).click();
    await expect(
      page.getByRole("heading", { name: "Nova Regra SLA" })
    ).toBeVisible();
    await page.getByLabel("Nome").fill("SLA E2E");
    await page.getByRole("button", { name: "Criar Regra" }).click();
    await expect(page.getByText("Regra SLA criada")).toBeVisible();
  });

  test("knowledge base page filters and opens the editor", async ({
    page,
  }) => {
    await page.goto("/support/knowledge-base");
    await expect(page.getByRole("button", { name: "Rascunhos" })).toBeVisible();
    await page.getByRole("button", { name: "Novo Artigo" }).click();
    await expect(
      page.getByRole("heading", { name: "Novo Artigo" })
    ).toBeVisible();
    // Editor offers a preview toggle.
    await expect(page.getByRole("button", { name: "Visualizar" })).toBeVisible();
  });

  test("canned responses page supports creating a response", async ({
    page,
  }) => {
    await page.goto("/support/canned-responses");
    await page.getByRole("button", { name: "Nova Resposta" }).click();
    await expect(
      page.getByRole("heading", { name: "Nova Resposta Pronta" })
    ).toBeVisible();
    await page.getByLabel("Titulo").fill("Resposta E2E");
    await page.getByLabel("Conteudo").fill("Conteudo de teste E2E.");
    await page.getByRole("button", { name: "Criar Resposta" }).click();
    await expect(page.getByText("Resposta criada")).toBeVisible();
  });
});
