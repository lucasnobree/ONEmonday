/**
 * One-off UX-audit screenshot capture.
 * Logs in as the admin and each sector manager, walks every dashboard route,
 * and writes full-page PNGs to ../../screenshots/audit/<user>/.
 *
 * Run from apps/web:  node scripts/capture-audit-screenshots.mjs
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
  "../../screenshots/audit"
);

const DEV_SECTOR = {
  id: "3826e880-b077-4930-a676-7c5b96d10f63",
  slug: "dev",
  name: "Desenvolvimento",
};

// Every dashboard route, dynamic segments resolved.
const ADMIN_ROUTES = [
  ["/", "00-dashboard"],
  ["/dev/boards", "01-boards-sector"],
  ["/dev/boards/b0000001-0000-0000-0000-000000000001", "02-board-detail"],
  ["/dev/projects", "03-projects-sector"],
  ["/boards", "04-boards-index"],
  ["/projects", "05-projects-index"],
  ["/analytics", "06-analytics"],
  ["/crm", "07-crm-dashboard"],
  ["/crm/companies", "08-crm-companies"],
  ["/crm/contacts", "09-crm-contacts"],
  ["/crm/pipeline", "10-crm-pipeline"],
  ["/crm/proposals", "11-crm-proposals"],
  ["/crm/activities", "12-crm-activities"],
  ["/hr", "13-hr-dashboard"],
  ["/hr/employees", "14-hr-employees"],
  ["/hr/recruitment", "15-hr-recruitment"],
  ["/hr/onboarding", "16-hr-onboarding"],
  ["/hr/org-chart", "17-hr-org-chart"],
  ["/hr/time-off", "18-hr-time-off"],
  ["/support", "19-support-dashboard"],
  ["/support/tickets", "20-support-tickets"],
  ["/support/sla-rules", "21-support-sla-rules"],
  ["/support/knowledge-base", "22-support-knowledge-base"],
  ["/support/canned-responses", "23-support-canned-responses"],
  ["/finance", "24-finance-dashboard"],
  ["/finance/invoices", "25-finance-invoices"],
  ["/finance/expenses", "26-finance-expenses"],
  ["/finance/budgets", "27-finance-budgets"],
  ["/legal", "28-legal-dashboard"],
  ["/legal/contracts", "29-legal-contracts"],
  ["/legal/matters", "30-legal-matters"],
  ["/legal/clauses", "31-legal-clauses"],
  ["/dev-tools", "32-dev-tools"],
  ["/marketing", "33-marketing-dashboard"],
  ["/marketing/campaigns", "34-marketing-campaigns"],
  ["/marketing/calendar", "35-marketing-calendar"],
  ["/marketing/audiences", "36-marketing-audiences"],
  ["/settings", "37-settings"],
  ["/settings/admin", "38-settings-admin"],
  ["/settings/profile", "39-settings-profile"],
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
    await page.screenshot({ path: path.join(dir, `${file}.png`), fullPage: true });
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
