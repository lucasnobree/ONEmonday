"use client";

import { useCallback, useSyncExternalStore } from "react";
import { usePermissions } from "@/hooks/use-permissions";
import { useCurrentSector } from "@/hooks/use-current-sector";
import {
  ALL_SECTORS,
  resolveSectorScope,
  scopeToSectorId,
  type SectorScope,
} from "@/lib/navigation/sector-scope";

/**
 * On-screen sector-filter state for module screens (nav phase 2b).
 *
 * The hook exposes the effective {@link SectorScope} a screen should apply,
 * plus a setter the {@link import("@/components/shared/sector-scope-filter")
 * .SectorScopeFilter} uses. Resolution is delegated to the pure
 * {@link resolveSectorScope}:
 *
 *  - **Global admin** — the choice is persisted in `localStorage` (so it
 *    survives navigation and reloads) and may be any sector id or "all".
 *  - **Non-admin** — the scope is forced to their own sector; `setScope` is a
 *    no-op and `canChangeScope` is `false`, so no selector is ever rendered.
 *
 * The sidebar's `useCurrentSector` still seeds the default for an admin who
 * has not made an explicit on-screen choice; once they pick a scope here it
 * overrides the sidebar at screen level.
 */

const STORAGE_KEY = "onemonday-sector-scope";
const CHANGE_EVENT = "onemonday-sector-scope-change";

/* localStorage-backed external store — same pattern as use-current-sector:
 * read synchronously during render via useSyncExternalStore, no
 * setState-in-effect, and stay in sync across tabs. */

function subscribe(onChange: () => void): () => void {
  function onStorage(e: StorageEvent) {
    if (e.key === STORAGE_KEY || e.key === null) onChange();
  }
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function getStoredScope(): SectorScope | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw && raw.length > 0 ? (raw as SectorScope) : null;
}

function getServerStoredScope(): SectorScope | null {
  return null;
}

function writeStoredScope(scope: SectorScope): void {
  localStorage.setItem(STORAGE_KEY, scope);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export interface UseSectorScopeResult {
  /**
   * The effective scope to pass to data hooks: a concrete sector id or the
   * {@link ALL_SECTORS} sentinel.
   */
  scope: SectorScope;
  /**
   * Convenience: the `sector_id` to filter by — `undefined` when the scope is
   * {@link ALL_SECTORS}, matching the existing `sectorId?: string` hook APIs.
   */
  sectorId: string | undefined;
  /** Updates the scope. No-op for non-admins (their scope is locked). */
  setScope: (scope: SectorScope) => void;
  /** Whether the user may change the scope (i.e. is a global admin). */
  canChangeScope: boolean;
  /** Whether permission data is still loading (scope not yet trustworthy). */
  isLoading: boolean;
}

/**
 * Returns the on-screen sector scope for the current user. Mount per screen;
 * the admin's choice is shared through `localStorage`, so every screen reads
 * the same value.
 */
export function useSectorScope(): UseSectorScopeResult {
  const { isGlobalAdmin, sectorRoles, isLoading } = usePermissions();
  const { currentSector } = useCurrentSector();

  const storedScope = useSyncExternalStore(
    subscribe,
    getStoredScope,
    getServerStoredScope
  );

  const scope = resolveSectorScope({
    isGlobalAdmin,
    sectorRoles,
    storedScope,
    currentSectorId: currentSector?.id ?? null,
  });

  const setScope = useCallback(
    (next: SectorScope) => {
      // Only admins may change scope; for everyone else this is a no-op so
      // the selector is never wired up to a writable store.
      if (!isGlobalAdmin) return;
      writeStoredScope(next);
    },
    [isGlobalAdmin]
  );

  return {
    scope,
    sectorId: scopeToSectorId(scope),
    setScope,
    canChangeScope: isGlobalAdmin,
    isLoading,
  };
}

export { ALL_SECTORS };
export type { SectorScope };
