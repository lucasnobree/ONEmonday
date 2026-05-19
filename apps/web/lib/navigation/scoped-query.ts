/**
 * Helpers for applying a {@link SectorScope} to a Supabase query inside a
 * data hook (nav phase 2b).
 *
 * Module data hooks historically took `sectorId: string | undefined`, where
 * `undefined` meant "not ready" (return early, query disabled). The on-screen
 * sector filter adds a third case — the {@link ALL_SECTORS} sentinel — meaning
 * "every sector, no `sector_id` filter". These helpers let a hook handle all
 * three cases without duplicating the branching logic.
 */

import { ALL_SECTORS, type SectorScope } from "@/lib/navigation/sector-scope";

/** Minimal shape of the Supabase filter-builder methods we chain. */
interface SectorEqFilterable<T> {
  eq(column: string, value: string): T;
}

/**
 * True when a scope value is "ready" — either a concrete sector id or the
 * {@link ALL_SECTORS} sentinel. `undefined` (scope not resolved yet) is not.
 * Use for a query's `enabled` flag and early-return guard.
 */
export function isScopeReady(
  scope: SectorScope | undefined
): scope is SectorScope {
  return scope !== undefined;
}

/**
 * Applies the `sector_id` filter implied by a scope to a query builder:
 *  - a concrete sector id → adds `.eq("sector_id", id)`;
 *  - {@link ALL_SECTORS}   → returns the query unchanged (cross-sector).
 *
 * Pass the scope only when it is ready (see {@link isScopeReady}).
 */
export function applySectorScope<T extends SectorEqFilterable<T>>(
  query: T,
  scope: SectorScope,
  column = "sector_id"
): T {
  return scope === ALL_SECTORS ? query : query.eq(column, scope);
}
