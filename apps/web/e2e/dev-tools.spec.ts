import { test, expect } from "@playwright/test";

/**
 * E2E coverage for the Dev-Tools module. Runs in the `authenticated` project
 * (saved admin session); anchors on roles and stable text.
 */
test.describe("Dev-Tools module", () => {
  test("dashboard exposes the incident/service/deploy/flag tabs", async ({
    page,
  }) => {
    await page.goto("/dev-tools");

    await expect(
      page.getByRole("heading", { name: "Dev Tools" })
    ).toBeVisible();

    for (const tab of [
      "Visao Geral",
      "Incidentes",
      "Servicos",
      "Deploys",
      "Flags",
    ]) {
      await expect(page.getByRole("tab", { name: tab })).toBeVisible();
    }
  });

  test("overview tab shows incident and reliability metrics", async ({
    page,
  }) => {
    await page.goto("/dev-tools");

    await expect(page.getByText("Incidentes Abertos")).toBeVisible();
    await expect(page.getByText("MTTA medio")).toBeVisible();
    await expect(page.getByText("MTTR medio")).toBeVisible();
  });

  test("the incidents tab opens the new-incident dialog", async ({ page }) => {
    await page.goto("/dev-tools");
    await page.getByRole("tab", { name: "Incidentes" }).click();

    await page.getByRole("button", { name: "Novo" }).click();
    await expect(
      page.getByRole("heading", { name: "Novo Incidente" })
    ).toBeVisible();
    await expect(page.getByLabel("Titulo")).toBeVisible();
  });
});
