/**
 * Navigation model for the Monday.com-style sidebar tree.
 *
 * The sidebar is a three-level tree: **Sector → Module → Sub-page**.
 *
 * - A *sector* is an organisational unit the user belongs to (from
 *   {@link SectorRole}s) — or every sector for a global admin.
 * - Each sector exposes the same catalogue of *modules* (Boards, CRM, RH, ...).
 * - Each module expands to its *sub-pages* (routed screens).
 *
 * Most module sub-pages are **global URLs** (`/crm/leads`, `/hr/employees`)
 * shared across every sector. Boards and Projects are **sector-scoped**:
 * their URL embeds the sector slug (`/{sector}/boards`). The `sectorScoped`
 * flag on a module records which kind it is so the tree builder can render
 * the correct `href`.
 */

import type { LucideIcon } from "lucide-react";
import {
  Kanban,
  Users,
  UserCog,
  Headphones,
  DollarSign,
  Scale,
  Megaphone,
  BarChart3,
  Terminal,
} from "lucide-react";

/** A sector the sidebar can show as a top-level tree group. */
export interface NavSector {
  id: string;
  slug: string;
  name: string;
}

/** A sub-page node — the leaf of the tree, a navigable screen. */
export interface NavSubPage {
  /** Stable id, unique within its module definition. */
  id: string;
  label: string;
  /**
   * For a global module this is the absolute path. For a sector-scoped
   * module (Boards/Projects) this is the path *suffix* after the sector
   * slug, e.g. `/boards`; {@link buildSectorTree} prepends `/{slug}`.
   */
  path: string;
}

/** A module definition — the static catalogue entry, sector-agnostic. */
export interface NavModuleDef {
  id: string;
  label: string;
  icon: LucideIcon;
  /**
   * When true the module's sub-page paths are relative and get the active
   * sector slug prepended (`/{slug}/boards`). When false they are absolute
   * global URLs (`/crm/leads`).
   */
  sectorScoped: boolean;
  subPages: NavSubPage[];
}

/** A module node materialised for one sector — sub-pages carry real hrefs. */
export interface NavModule {
  id: string;
  label: string;
  icon: LucideIcon;
  subPages: { id: string; label: string; href: string }[];
}

/** A sector node materialised for the tree, with its modules. */
export interface NavSectorNode {
  sector: NavSector;
  modules: NavModule[];
}

/**
 * The static module catalogue. Every sector branch renders this same list;
 * only the Boards/Projects hrefs differ per sector (see `sectorScoped`).
 */
export const MODULE_CATALOG: NavModuleDef[] = [
  {
    id: "boards",
    label: "Boards",
    icon: Kanban,
    sectorScoped: true,
    subPages: [
      { id: "boards-quadros", label: "Quadros", path: "/boards" },
      { id: "boards-projetos", label: "Projetos", path: "/projects" },
    ],
  },
  {
    id: "crm",
    label: "CRM",
    icon: Users,
    sectorScoped: false,
    subPages: [
      { id: "crm-overview", label: "Visão geral", path: "/crm" },
      { id: "crm-leads", label: "Leads", path: "/crm/leads" },
      { id: "crm-forms", label: "Formulários", path: "/crm/forms" },
      { id: "crm-pipeline", label: "Pipeline", path: "/crm/pipeline" },
      { id: "crm-proposals", label: "Propostas", path: "/crm/proposals" },
      { id: "crm-contacts", label: "Contatos", path: "/crm/contacts" },
      { id: "crm-companies", label: "Empresas", path: "/crm/companies" },
      { id: "crm-activities", label: "Atividades", path: "/crm/activities" },
    ],
  },
  {
    id: "hr",
    label: "RH",
    icon: UserCog,
    sectorScoped: false,
    subPages: [
      { id: "hr-dashboard", label: "Dashboard", path: "/hr" },
      { id: "hr-employees", label: "Colaboradores", path: "/hr/employees" },
      { id: "hr-time-off", label: "Férias e Ausências", path: "/hr/time-off" },
      { id: "hr-recruitment", label: "Recrutamento", path: "/hr/recruitment" },
      { id: "hr-performance", label: "Desempenho", path: "/hr/performance" },
      { id: "hr-surveys", label: "Pesquisas", path: "/hr/surveys" },
      { id: "hr-onboarding", label: "Onboarding", path: "/hr/onboarding" },
      { id: "hr-offboarding", label: "Offboarding", path: "/hr/offboarding" },
      { id: "hr-org-chart", label: "Organograma", path: "/hr/org-chart" },
    ],
  },
  {
    id: "support",
    label: "Suporte",
    icon: Headphones,
    sectorScoped: false,
    subPages: [
      { id: "support-dashboard", label: "Dashboard", path: "/support" },
      { id: "support-tickets", label: "Tickets", path: "/support/tickets" },
      {
        id: "support-kb",
        label: "Base de Conhecimento",
        path: "/support/knowledge-base",
      },
      {
        id: "support-canned",
        label: "Respostas Prontas",
        path: "/support/canned-responses",
      },
      { id: "support-sla", label: "Regras SLA", path: "/support/sla-rules" },
    ],
  },
  {
    id: "finance",
    label: "Financeiro",
    icon: DollarSign,
    sectorScoped: false,
    subPages: [
      { id: "finance-overview", label: "Visão Geral", path: "/finance" },
      { id: "finance-invoices", label: "Faturas", path: "/finance/invoices" },
      { id: "finance-expenses", label: "Despesas", path: "/finance/expenses" },
      { id: "finance-budgets", label: "Orçamentos", path: "/finance/budgets" },
      { id: "finance-reports", label: "Relatórios", path: "/finance/reports" },
      {
        id: "finance-reconciliation",
        label: "Conciliação",
        path: "/finance/reconciliation",
      },
    ],
  },
  {
    id: "legal",
    label: "Jurídico",
    icon: Scale,
    sectorScoped: false,
    subPages: [
      { id: "legal-dashboard", label: "Dashboard", path: "/legal" },
      { id: "legal-contracts", label: "Contratos", path: "/legal/contracts" },
      { id: "legal-matters", label: "Demandas", path: "/legal/matters" },
      { id: "legal-clauses", label: "Cláusulas", path: "/legal/clauses" },
    ],
  },
  {
    id: "marketing",
    label: "Marketing",
    icon: Megaphone,
    sectorScoped: false,
    subPages: [
      { id: "marketing-overview", label: "Visão Geral", path: "/marketing" },
      {
        id: "marketing-campaigns",
        label: "Campanhas",
        path: "/marketing/campaigns",
      },
      {
        id: "marketing-calendar",
        label: "Calendário",
        path: "/marketing/calendar",
      },
      {
        id: "marketing-audiences",
        label: "Audiências",
        path: "/marketing/audiences",
      },
      { id: "marketing-email", label: "E-mails", path: "/marketing/email" },
      {
        id: "marketing-automations",
        label: "Automações",
        path: "/marketing/automations",
      },
    ],
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: BarChart3,
    sectorScoped: false,
    subPages: [
      { id: "analytics-overview", label: "Analytics", path: "/analytics" },
    ],
  },
  {
    id: "dev-tools",
    label: "Dev Tools",
    icon: Terminal,
    sectorScoped: false,
    subPages: [
      { id: "dev-tools-overview", label: "Dev Tools", path: "/dev-tools" },
    ],
  },
];

/**
 * Resolves which sectors the sidebar should show.
 *
 * - A **global admin** sees every sector.
 * - A **non-admin** sees only the sectors granted by their `sectorRoles`.
 *
 * Results are de-duplicated by sector id and sorted by name for a stable,
 * predictable tree order.
 */
export function visibleSectors(
  isGlobalAdmin: boolean,
  sectorRoles: { sectorId: string; sectorSlug: string; sectorName: string }[],
  allSectors: NavSector[]
): NavSector[] {
  const source: NavSector[] = isGlobalAdmin
    ? allSectors
    : sectorRoles.map((r) => ({
        id: r.sectorId,
        slug: r.sectorSlug,
        name: r.sectorName,
      }));

  const seen = new Set<string>();
  const unique: NavSector[] = [];
  for (const s of source) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    unique.push(s);
  }
  return unique.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

/** Joins a sector slug with a sector-scoped path suffix into an absolute URL. */
function sectorScopedHref(slug: string, suffix: string): string {
  return `/${slug}${suffix}`;
}

/**
 * Builds the full sidebar tree: one {@link NavSectorNode} per visible sector,
 * each carrying the module catalogue with concrete sub-page hrefs.
 */
export function buildSectorTree(sectors: NavSector[]): NavSectorNode[] {
  return sectors.map((sector) => ({
    sector,
    modules: MODULE_CATALOG.map((mod) => ({
      id: mod.id,
      label: mod.label,
      icon: mod.icon,
      subPages: mod.subPages.map((sp) => ({
        id: sp.id,
        label: sp.label,
        href: mod.sectorScoped
          ? sectorScopedHref(sector.slug, sp.path)
          : sp.path,
      })),
    })),
  }));
}

/**
 * Tests whether `pathname` falls within the route subtree rooted at `href`
 * — an exact match, or any nested route below it.
 *
 * This is a plain prefix matcher: `/crm` *does* match `/crm/leads` here.
 * Sidebar leaf highlighting must NOT use this directly (it would light up
 * both `/crm` and `/crm/leads`); use {@link findActiveBranch}, which applies
 * longest-match so only the most specific node wins.
 */
export function isSubPageActive(href: string, pathname: string): boolean {
  if (pathname === href) return true;
  return pathname.startsWith(href + "/");
}

/**
 * The result of locating the current pathname inside the tree: the ids of
 * the sector / module / sub-page on the active branch. Any field is `null`
 * when the pathname does not resolve to a tree node.
 */
export interface ActiveBranch {
  sectorId: string | null;
  moduleId: string | null;
  subPageId: string | null;
}

/**
 * Finds the branch of the tree that matches `pathname`.
 *
 * When several sub-pages match (e.g. `/crm` overview vs `/crm/leads`), the
 * **longest** matching href wins, so the most specific node is selected.
 *
 * Global module URLs (`/crm/leads`) appear identically under every sector
 * branch. `preferredSectorId` — the user's current sector context — breaks
 * that tie so the highlight lands on the branch the user is actually in;
 * without it the first sector branch is chosen. Sector-scoped routes
 * (`/{slug}/boards`) are unambiguous and ignore the preference.
 *
 * Used to drive sidebar highlighting and to auto-expand the active branch.
 */
export function findActiveBranch(
  tree: NavSectorNode[],
  pathname: string,
  preferredSectorId?: string | null
): ActiveBranch {
  let best: ActiveBranch = {
    sectorId: null,
    moduleId: null,
    subPageId: null,
  };
  let bestLen = -1;
  let bestPreferred = false;

  for (const sectorNode of tree) {
    const isPreferred = sectorNode.sector.id === preferredSectorId;
    for (const mod of sectorNode.modules) {
      for (const sp of mod.subPages) {
        if (!isSubPageActive(sp.href, pathname)) continue;
        // A longer href is strictly more specific. At equal length, a
        // preferred-sector branch beats a non-preferred one.
        const better =
          sp.href.length > bestLen ||
          (sp.href.length === bestLen && isPreferred && !bestPreferred);
        if (better) {
          bestLen = sp.href.length;
          bestPreferred = isPreferred;
          best = {
            sectorId: sectorNode.sector.id,
            moduleId: mod.id,
            subPageId: sp.id,
          };
        }
      }
    }
  }
  return best;
}
