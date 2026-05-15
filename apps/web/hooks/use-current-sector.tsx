"use client";

import {
  createContext,
  useContext,
  useCallback,
  useMemo,
  useSyncExternalStore,
} from "react";

interface Sector {
  id: string;
  slug: string;
  name: string;
}

interface SectorContextValue {
  currentSector: Sector | null;
  setSector: (sector: Sector) => void;
  clearSector: () => void;
}

const STORAGE_KEY = "onemonday-current-sector";

const SectorContext = createContext<SectorContextValue | null>(null);

function parseStoredSector(value: string | null): Sector | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as Sector;
  } catch {
    return null;
  }
}

/* ── localStorage-backed external store ──────────────────────────
 * The selected sector lives in localStorage so it survives reloads
 * and stays in sync across tabs. useSyncExternalStore is the React
 * primitive for subscribing to such external state — it reads the
 * value during render (no setState-in-effect) and re-renders only
 * when the store actually changes.
 */

function subscribe(onChange: () => void): () => void {
  function onStorage(e: StorageEvent) {
    if (e.key === STORAGE_KEY || e.key === null) onChange();
  }
  // Custom event lets same-tab writes notify subscribers immediately.
  window.addEventListener("storage", onStorage);
  window.addEventListener("onemonday-sector-change", onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("onemonday-sector-change", onChange);
  };
}

// Cache the parsed value so getSnapshot returns a stable reference
// while the underlying raw string is unchanged (required by React).
let cachedRaw: string | null = null;
let cachedSector: Sector | null = null;

function getSnapshot(): Sector | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedSector = parseStoredSector(raw);
  }
  return cachedSector;
}

function getServerSnapshot(): Sector | null {
  return null;
}

/**
 * Holds the currently selected sector for the whole dashboard. Mount once
 * (in the dashboard layout) so every screen shares the same selection — a
 * sector change re-renders all consumers and refetches sector-scoped queries.
 */
export function SectorProvider({ children }: { children: React.ReactNode }) {
  const currentSector = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  const setSector = useCallback((sector: Sector) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sector));
    window.dispatchEvent(new Event("onemonday-sector-change"));
  }, []);

  const clearSector = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event("onemonday-sector-change"));
  }, []);

  const value = useMemo(
    () => ({ currentSector, setSector, clearSector }),
    [currentSector, setSector, clearSector]
  );

  return (
    <SectorContext.Provider value={value}>{children}</SectorContext.Provider>
  );
}

export function useCurrentSector() {
  const ctx = useContext(SectorContext);
  if (!ctx) {
    throw new Error("useCurrentSector must be used within a SectorProvider");
  }
  return ctx;
}
