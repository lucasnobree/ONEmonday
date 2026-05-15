import { test, expect } from "@playwright/test";

test.describe("autenticação", () => {
  test("rota protegida redireciona usuário não autenticado para o login", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByLabel("Email")).toBeVisible();
  });

  test("a tela de login expõe os campos de email e senha", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Senha")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Entrar" })
    ).toBeVisible();
  });

  test("credenciais inválidas mostram mensagem de erro", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("ninguem@exemplo.com");
    await page.getByLabel("Senha").fill("senhaerrada");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText(/incorret|erro/i)).toBeVisible();
  });
});
