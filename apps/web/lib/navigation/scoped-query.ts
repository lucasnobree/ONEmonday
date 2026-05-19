/**
 * Helpers for applying a {@link SectorScope} to a Supabase query inside a
 * data hook (nav phase 2b).
 *
 * Module data hooks historically took `sectorId: string | undefined`, where
 * `undefined` meant "not ready" (return early, query disabled). The on-screen
 * sector filter adds a third case — the {@link ALL_SECTORS} sentinel — meaning
 * "every sector, no `sector_id` filter". These helpers let a hook handle all
 * three cases without duplicating the branching logic.
 *
 * Note: there is deliberately no generic "apply `.eq` to the builder" helper.
 * Supabase's filter-builder types are so deeply nested that threading them
 * through a generic trips TypeScript's "type instantiation is excessively
 * deep" guard. Hooks instead branch inline on {@link shouldFilterBySector} /
 * {@link sectorFilterValue}, keeping the builder's concrete inferred type.
 */

import { ALL_SECTORS, type SectorScope } from "@/lib/navigation/sector-scope";

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
 * Whether a (ready) scope should add a `.eq("sector_id", …)` clause.
 * `false` for the {@link ALL_SECTORS} sentinel (cross-sector query).
 */
export function shouldFilterBySector(scope: SectorScope): boolean {
  return scope !== ALL_SECTORS;
}

/**
 * The concrete sector id to filter by for a ready scope, or `undefined` for
 * {@link ALL_SECTORS}. Pair with `if (id)` to chain `.eq` conditionally.
 */
export function sectorFilterValue(scope: SectorScope): string | undefined {
  return scope === ALL_SECTORS ? undefined : scope;
}
