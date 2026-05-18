/**
 * UX-audit Wave 4 screenshot capture.
 * Logs in as the admin and each sector manager, walks every dashboard route
 * (including everything added by the migration phases and module backlogs),
 * and writes full-page PNGs to ../../screenshots/audit-wave4/<user>/.
 *
 * Run from apps/web:  node scripts/capture-audit-screenshots-wave4.mjs
 * Requires the app running on E2E_BASE_URL (default http://localhost:3000)
 * and the local Supabase stack with seeded data.
 */
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";
import path from "node:path";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const OUT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../screenshots/audit-wave4"
);

const DEV_SECTOR = {
  id: "3826e880-b077-4930-a676-7c5b96d10f63",
  slug: "dev",
  name: "Desenvolvimento",
};

const BOARD_ID = "b0000001-0000-0000-0000-000000000001";
const PROJECT_ID = "a0000001-0000-0000-0000-000000000001";

// Every dashboard route, dynamic segments resolved. Numbering is grouped by
// module so the audit reports map cleanly onto it.
const ADMIN_ROUTES = [
  ["/", "00-dashboard"],
  // Core
  ["/dev/boards", "01-boards-sector"],
  [`/dev/boards/${BOARD_ID}`, "02-board-detail"],
  ["/dev/projects", "03-projects-sector"],
  [`/dev/projects/${PROJECT_ID}`, "04-project-detail"],
  ["/boards", "05-boards-index"],
  ["/projects", "06-projects-index"],
  ["/analytics", "07-analytics"],
  // CRM
  ["/crm", "08-crm-dashboard"],
  ["/crm/companies", "09-crm-companies"],
  ["/crm/contacts", "10-crm-contacts"],
  ["/crm/pipeline", "11-crm-pipeline"],
  ["/crm/proposals", "12-crm-proposals"],
  ["/crm/activities", "13-crm-activities"],
  ["/crm/leads", "14-crm-leads"],
  ["/crm/forms", "15-crm-forms"],
  // HR
  ["/hr", "16-hr-dashboard"],
  ["/hr/employees", "17-hr-employees"],
  ["/hr/recruitment", "18-hr-recruitment"],
  ["/hr/onboarding", "19-hr-onboarding"],
  ["/hr/offboarding", "20-hr-offboarding"],
  ["/hr/org-chart", "21-hr-org-chart"],
  ["/hr/time-off", "22-hr-time-off"],
  ["/hr/performance", "23-hr-performance"],
  ["/hr/surveys", "24-hr-surveys"],
  // Support
  ["/support", "25-support-dashboard"],
  ["/support/tickets", "26-support-tickets"],
  ["/support/sla-rules", "27-support-sla-rules"],
  ["/support/knowledge-base", "28-support-knowledge-base"],
  ["/support/canned-responses", "29-support-canned-responses"],
  // Finance
  ["/finance", "30-finance-dashboard"],
  ["/finance/invoices", "31-finance-invoices"],
  ["/finance/expenses", "32-finance-expenses"],
  ["/finance/budgets", "33-finance-budgets"],
  ["/finance/reports", "34-finance-reports"],
  ["/finance/reconciliation", "35-finance-reconciliation"],
  // Legal
  ["/legal", "36-legal-dashboard"],
  ["/legal/contracts", "37-legal-contracts"],
  ["/legal/matters", "38-legal-matters"],
  ["/legal/clauses", "39-legal-clauses"],
  // Dev-Tools
  ["/dev-tools", "40-dev-tools"],
  // Marketing
  ["/marketing", "41-marketing-dashboard"],
  ["/marketing/campaigns", "42-marketing-campaigns"],
  ["/marketing/calendar", "43-marketing-calendar"],
  ["/marketing/audiences", "44-marketing-audiences"],
  ["/marketing/email", "45-marketing-email"],
  ["/marketing/automations", "46-marketing-automations"],
  // Settings
  ["/settings", "47-settings"],
  ["/settings/admin", "48-settings-admin"],
  ["/settings/integrations", "49-settings-integrations"],
  ["/settings/profile", "50-settings-profile"],
];

const MANAGERS = [
  { slug: "dev", email: "gerente.dev@onemonday.local" },
  { slug: "suporte", email: "gerente.suporte@onemonday.local" },
  { slug: "comercial", email: "gerente.comercial@onemonday.local" },
  { slug: "rh", email: "gerente.rh@onemonday.local" },
];

async function login(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: "load" });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL((u) => !u.pathname.endsWith("/login"), {
    timeout: 20_000,
  });
}

async function shot(page, route, file, dir) {
  try {
    await page.goto(`${BASE}${route}`, { waitUntil: "load", timeout: 30_000 });
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: path.join(dir, `${file}.png`),
      fullPage: true,
    });
    console.log(`  ok  ${route}`);
  } catch (e) {
    console.log(`  FAIL ${route} -> ${e.message}`);
  }
}

async function run() {
  const browser = await chromium.launch();

  // --- Admin: every route ---
  const adminDir = path.join(OUT, "admin");
  mkdirSync(adminDir, { recursive: true });
  const adminCtx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const adminPage = await adminCtx.newPage();
  console.log("Login: admin");
  await login(adminPage, "admin@onemonday.local", "admin123");
  await adminPage.evaluate((s) => {
    localStorage.setItem("onemonday-current-sector", JSON.stringify(s));
  }, DEV_SECTOR);
  for (const [route, file] of ADMIN_ROUTES) {
    await shot(adminPage, route, file, adminDir);
  }
  await adminCtx.close();

  // --- Each sector manager: their scoped key screens ---
  for (const mgr of MANAGERS) {
    const dir = path.join(OUT, `gerente-${mgr.slug}`);
    mkdirSync(dir, { recursive: true });
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const page = await ctx.newPage();
    console.log(`Login: ${mgr.email}`);
    await login(page, mgr.email, "gerente123");
    for (const [route, file] of [
      ["/", "00-dashboard"],
      [`/${mgr.slug}/boards`, "01-boards"],
      [`/${mgr.slug}/projects`, "02-projects"],
      ["/settings", "03-settings"],
    ]) {
      await shot(page, route, file, dir);
    }
    await ctx.close();
  }

  await browser.close();
  console.log(`\nDone. Screenshots in ${OUT}`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
