import { test, expect } from "@playwright/test";

/**
 * E2E coverage for the Monday.com-style navigation shell (Phase 1).
 *
 * The flat module list + header sector dropdown were replaced by a
 * collapsible Sector → Module → Sub-page sidebar tree. These specs assume an
 * authenticated admin session (Playwright `storageState`) and the seeded
 * sample data. They anchor on roles and stable copy to survive restyling.
 */

test.describe("Navigation shell", () => {
  test("sidebar renders the tree zones, not the old sector dropdown", async ({
    page,
  }) => {
    await page.goto("/");

    const nav = page.getByRole("navigation", { name: "Navegação por setor" });
    await expect(nav).toBeVisible();

    // Top zone: Início link + command palette trigger.
    await expect(page.getByRole("link", { name: "Início" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Buscar/i })).toBeVisible();

    // Bottom zone: Configurações link.
    await expect(
      page.getByRole("link", { name: "Configurações" })
    ).toBeVisible();

    // The legacy header sector <select> must be gone.
    await expect(
      page.getByRole("combobox", { name: /setor/i })
    ).toHaveCount(0);
  });

  test("expanding a sector reveals its modules and drills into a sub-page", async ({
    page,
  }) => {
    await page.goto("/");

    const nav = page.getByRole("navigation", { name: "Navegação por setor" });

    // Expand the first sector group, then the CRM module within it.
    const sectorToggle = nav
      .getByRole("button", { expanded: false })
      .first();
    await sectorToggle.click();

    const crmModule = nav.getByRole("button", { name: "CRM" }).first();
    await crmModule.click();
    await expect(crmModule).toHaveAttribute("aria-expanded", "true");

    // Sub-pages are now links; navigating to one lands on its route.
    const leadsLink = nav.getByRole("link", { name: "Leads" });
    await expect(leadsLink).toBeVisible();
    await leadsLink.click();
    await expect(page).toHaveURL(/\/crm\/leads/);
  });

  test("the active sub-page branch is highlighted and auto-expanded", async ({
    page,
  }) => {
    // Landing directly on a deep route should auto-reveal its branch.
    await page.goto("/crm/contacts");

    const nav = page.getByRole("navigation", { name: "Navegação por setor" });
    const contactsLink = nav.getByRole("link", { name: "Contatos" });
    await expect(contactsLink).toBeVisible();
    await expect(contactsLink).toHaveAttribute("aria-current", "page");
  });

  test("module screens no longer render an in-screen tab strip", async ({
    page,
  }) => {
    await page.goto("/crm");

    // The module title stays; the old horizontal sub-page tab strip is gone.
    await expect(page.getByRole("heading", { name: "CRM" })).toBeVisible();

    // The sidebar tree owns sub-page navigation now — there must be exactly
    // one "Pipeline" navigation control (the sidebar link), not also a tab.
    const main = page.getByRole("main");
    await expect(main.getByRole("link", { name: "Pipeline" })).toHaveCount(0);
  });
});
