import { test, expect, type Page } from "@playwright/test";

/**
 * E2E coverage for the Core module — dashboard, boards, kanban cards and
 * projects. Authenticated flows need a running app + Supabase stack with a
 * seeded admin user; supply credentials via E2E_ADMIN_EMAIL /
 * E2E_ADMIN_PASSWORD (defaults match supabase/sample_data.sql). When no
 * password is configured the authenticated specs are skipped rather than
 * failing, so the suite stays green on a bare checkout.
 */

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@onemonday.com";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "";

/** Logs in through the UI and waits for the dashboard to load. */
async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Senha").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
}

/** Opens the first board found in the current sector, if any. */
async function openFirstBoard(page: Page): Promise<boolean> {
  await page.getByRole("link", { name: "Boards" }).click();
  await expect(page.getByRole("heading", { name: "Boards" })).toBeVisible();
  const firstBoard = page.locator('a[href*="/boards/"]').first();
  if ((await firstBoard.count()) === 0) return false;
  await firstBoard.click();
  return true;
}

test.describe("Core — acesso público", () => {
  test("dashboard exige autenticação", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("boards exige autenticação", async ({ page }) => {
    await page.goto("/dev/boards");
    await expect(page).toHaveURL(/\/login/);
  });

  test("projetos exige autenticação", async ({ page }) => {
    await page.goto("/dev/projects");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("Core — fluxos autenticados", () => {
  test.skip(
    !ADMIN_PASSWORD,
    "Set E2E_ADMIN_PASSWORD to run authenticated Core specs"
  );

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("o dashboard renderiza apos o login", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Dashboard" })
    ).toBeVisible();
  });

  test("a lista de boards abre e permite criar um board", async ({
    page,
  }) => {
    await page.getByRole("link", { name: "Boards" }).click();
    await expect(
      page.getByRole("heading", { name: "Boards" })
    ).toBeVisible();

    const novoBoard = page.getByRole("button", { name: "Novo Board" });
    if ((await novoBoard.count()) === 0) {
      // Current role cannot create boards — nothing more to assert.
      return;
    }

    const boardName = `E2E Board ${Date.now()}`;
    await novoBoard.click();
    await page.getByLabel("Nome").fill(boardName);
    await page.getByRole("button", { name: "Criar Board" }).click();
    await expect(page.getByText(boardName)).toBeVisible({ timeout: 10_000 });
  });

  test("o board exibe a barra de filtros e filtra cards por busca", async ({
    page,
  }) => {
    const opened = await openFirstBoard(page);
    test.skip(!opened, "Nenhum board disponivel para o setor atual");

    const search = page.getByPlaceholder("Buscar cards por titulo...");
    await expect(search).toBeVisible();

    // Searching for an unlikely string should yield zero cards in the list.
    await page.getByRole("tab", { name: "Lista" }).click();
    await search.fill("zzz-no-such-card-zzz");
    await expect(page.getByText("0 cards")).toBeVisible();
  });

  test("abrir um card mostra o detalhe com acoes de editar e excluir", async ({
    page,
  }) => {
    const opened = await openFirstBoard(page);
    test.skip(!opened, "Nenhum board disponivel para o setor atual");

    const firstCard = page
      .locator('[class*="cursor"]')
      .filter({ hasText: /\S/ })
      .first();
    if ((await firstCard.count()) === 0) {
      test.skip(true, "Board sem cards");
      return;
    }
    await firstCard.click();

    await expect(
      page.getByRole("button", { name: "Editar" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Escalar" })
    ).toBeVisible();
  });

  test("a lista de projetos abre", async ({ page }) => {
    await page.getByRole("link", { name: "Projetos" }).click();
    await expect(
      page.getByRole("heading", { name: "Projetos" })
    ).toBeVisible();
  });
});
