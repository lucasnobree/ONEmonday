import { test, expect } from "@playwright/test";

/**
 * E2E coverage for the nav phase 2 screens: role-based landing, "Meu
 * Trabalho", the admin Global Overview, and the sidebar Settings group.
 *
 * These specs assume an authenticated admin session (Playwright
 * `storageState`) over the seeded sample data, and anchor on roles and stable
 * copy so they survive restyling.
 */

test.describe("Nav phase 2", () => {
  test("an admin lands on the Global Overview at /", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Visão Geral" })
    ).toBeVisible();
  });

  test("the top zone exposes Meu Trabalho and Visão Geral", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(
      page.getByRole("link", { name: "Início" })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Meu Trabalho" })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Visão Geral" })
    ).toBeVisible();
  });

  test("Meu Trabalho renders the personal cross-board task view", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Meu Trabalho" }).click();
    await expect(page).toHaveURL(/\/meu-trabalho/);
    await expect(
      page.getByRole("heading", { name: "Meu Trabalho" })
    ).toBeVisible();
    // The "Concluídas" toggle is present.
    await expect(page.getByText("Mostrar concluídas")).toBeVisible();
  });

  test("Visão Geral drills into a sector dashboard and back", async ({
    page,
  }) => {
    await page.goto("/overview");
    await expect(
      page.getByRole("heading", { name: "Visão Geral" })
    ).toBeVisible();

    // Drill into the first sector overview card.
    await page
      .getByRole("button", { name: "Ver detalhes" })
      .first()
      .click();
    await expect(
      page.getByRole("button", { name: "Visão Geral" })
    ).toBeVisible();

    // Back to the overview.
    await page.getByRole("button", { name: "Visão Geral" }).click();
    await expect(
      page.getByRole("button", { name: "Ver detalhes" }).first()
    ).toBeVisible();
  });

  test("the sidebar Settings group reaches every sub-page", async ({
    page,
  }) => {
    await page.goto("/");

    const settingsToggle = page.getByRole("button", {
      name: "Configurações",
    });
    await settingsToggle.click();
    await expect(settingsToggle).toHaveAttribute("aria-expanded", "true");

    // Admin sees the gated sub-pages too.
    const profileLink = page.getByRole("link", { name: "Perfil" });
    await expect(profileLink).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Integrações" })
    ).toBeVisible();

    await profileLink.click();
    await expect(page).toHaveURL(/\/settings\/profile/);
    await expect(profileLink).toHaveAttribute("aria-current", "page");
  });
});
