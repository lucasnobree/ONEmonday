/**
 * Sector-scope model for the on-screen sector filter (nav phase 2b).
 *
 * Module screens can be scoped to a single sector or, for global admins, to
 * *every* sector at once. The "every sector" choice is represented by the
 * {@link ALL_SECTORS} sentinel rather than `null`/`undefined` so callers can
 * always tell "show everything" apart from "scope not resolved yet".
 *
 * Resolution rules (see {@link resolveSectorScope}):
 *  - **Global admin** — may pick any sector or "all"; their stored choice is
 *    honoured, defaulting to "all".
 *  - **Non-admin** (sector manager / individual contributor) — the scope is
 *    *forced* to the single sector they belong to. With more than one sector
 *    role, their primary sector is used (first by sector name, matching the
 *    landing-resolution tie-break). They can never widen scope to "all".
 *
 * The resolved scope is what screens pass to their data hooks: a real sector
 * id filters the query by `sector_id`; {@link ALL_SECTORS} skips that filter
 * (admins have cross-sector visibility via RLS / `is_global_admin`).
 *
 * Relationship with `useCurrentSector`: the sidebar tree still sets a
 * "current sector" used for routing/landing and as the *default* scope. The
 * on-screen filter is a screen-level override layered on top — see
 * {@link resolveSectorScope}'s `storedScope`/`currentSectorId` handling.
 *
 * This module is pure so the resolution is unit-testable.
 */

import type { SectorRole } from "@/lib/permissions/types";

/** Sentinel scope meaning "all sectors" (no `sector_id` filter). */
export const ALL_SECTORS = "all" as const;

/**
 * The chosen sector scope: a concrete sector id, or the {@link ALL_SECTORS}
 * sentinel. Never `undefined` once resolved.
 */
export type SectorScope = string | typeof ALL_SECTORS;

/** True when a scope is the "all sectors" sentinel. */
export function isAllSectors(scope: SectorScope): scope is typeof ALL_SECTORS {
  return scope === ALL_SECTORS;
}

/**
 * The sector-id a data hook should filter by for a given scope:
 * `undefined` for {@link ALL_SECTORS} (no `.eq("sector_id", …)` clause),
 * otherwise the concrete sector id.
 */
export function scopeToSectorId(scope: SectorScope): string | undefined {
  return isAllSectors(scope) ? undefined : scope;
}

/**
 * The single sector a non-admin user is locked to: their only sector, or —
 * with multiple sector roles — the primary one (first by sector name, the
 * same tie-break `resolveLanding` uses). `null` when the user has no role.
 */
export function primarySectorId(
  sectorRoles: readonly SectorRole[]
): string | null {
  if (sectorRoles.length === 0) return null;
  const sorted = [...sectorRoles].sort((a, b) =>
    a.sectorName.localeCompare(b.sectorName, "pt-BR")
  );
  return sorted[0].sectorId;
}

/** Inputs to {@link resolveSectorScope}. */
export interface ResolveSectorScopeInput {
  /** Whether the user is a global admin. */
  isGlobalAdmin: boolean;
  /** The user's per-sector roles (used to lock non-admins to their sector). */
  sectorRoles: readonly SectorRole[];
  /**
   * The admin's persisted on-screen filter choice (from localStorage), or
   * `null` when they have not chosen one yet. Ignored for non-admins.
   */
  storedScope: SectorScope | null;
  /**
   * The sidebar's current sector id, if any — used as the default scope for
   * an admin who has not made an explicit on-screen choice yet, so the screen
   * opens coherent with the sidebar selection.
   */
  currentSectorId: string | null;
}

/**
 * Resolves the effective sector scope for a screen.
 *
 * For non-admins the result is always their {@link primarySectorId} (or
 * {@link ALL_SECTORS} only as a harmless fallback when they have no role —
 * RLS still restricts what they can read). For admins the stored choice wins;
 * absent a stored choice the sidebar's current sector seeds the default, and
 * absent that too the scope defaults to {@link ALL_SECTORS}.
 */
export function resolveSectorScope({
  isGlobalAdmin,
  sectorRoles,
  storedScope,
  currentSectorId,
}: ResolveSectorScopeInput): SectorScope {
  if (!isGlobalAdmin) {
    return primarySectorId(sectorRoles) ?? ALL_SECTORS;
  }
  if (storedScope !== null) return storedScope;
  return currentSectorId ?? ALL_SECTORS;
}
