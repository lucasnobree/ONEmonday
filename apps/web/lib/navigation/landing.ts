/**
 * Role-based landing resolution for `/` (nav phase 2).
 *
 * The home route renders a different default screen per role:
 *
 *  - **admin**   → the cross-sector Global Overview
 *  - **manager** → their sector Dashboard (a managerial-level role in ≥1 sector)
 *  - **ic**      → "Meu Trabalho" (only non-managerial roles, or no role)
 *
 * Manager vs IC is decided from the seeded role levels (migration 00001 /
 * `seed.sql`): admin=100, manager=80, analyst=50, intern=20. Any sector role
 * at or above {@link MANAGER_ROLE_LEVEL} (80) counts as managerial — this
 * keeps the threshold data-driven rather than hard-coding role slugs.
 *
 * This module is pure so the routing decision is unit-testable.
 */

import type { SectorRole } from "@/lib/permissions/types";

/** Minimum `roles.level` that counts as a managerial (sector-manager) role. */
export const MANAGER_ROLE_LEVEL = 80;

/** The screen `/` should render for a given user. */
export type LandingTarget = "overview" | "sector-dashboard" | "my-work";

export interface LandingDecision {
  target: LandingTarget;
  /**
   * For `sector-dashboard`, the sector whose dashboard to show — the first
   * managerial sector by name order. `null` for the other targets.
   */
  sector: { id: string; slug: string; name: string } | null;
}

/** True when a sector role sits at or above the managerial level threshold. */
export function isManagerialRole(role: SectorRole): boolean {
  return role.roleLevel >= MANAGER_ROLE_LEVEL;
}

/**
 * Resolves which screen `/` should land on.
 *
 * @param isGlobalAdmin whether the user is a global admin
 * @param sectorRoles   the user's per-sector roles
 */
export function resolveLanding(
  isGlobalAdmin: boolean,
  sectorRoles: readonly SectorRole[]
): LandingDecision {
  if (isGlobalAdmin) {
    return { target: "overview", sector: null };
  }

  // First managerial sector, by sector name, for a stable default.
  const managerial = sectorRoles
    .filter(isManagerialRole)
    .sort((a, b) => a.sectorName.localeCompare(b.sectorName, "pt-BR"));

  if (managerial.length > 0) {
    const role = managerial[0];
    return {
      target: "sector-dashboard",
      sector: {
        id: role.sectorId,
        slug: role.sectorSlug,
        name: role.sectorName,
      },
    };
  }

  return { target: "my-work", sector: null };
}
