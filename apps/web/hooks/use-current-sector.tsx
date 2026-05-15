"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
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

/**
 * Holds the currently selected sector for the whole dashboard. Mount once
 * (in the dashboard layout) so every screen shares the same selection — a
 * sector change re-renders all consumers and refetches sector-scoped queries.
 */
export function SectorProvider({ children }: { children: React.ReactNode }) {
  const [currentSector, setCurrentSector] = useState<Sector | null>(null);

  useEffect(() => {
    setCurrentSector(parseStoredSector(localStorage.getItem(STORAGE_KEY)));
  }, []);

  // Keep other browser tabs in sync when the sector changes elsewhere.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) {
        setCurrentSector(parseStoredSector(e.newValue));
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setSector = useCallback((sector: Sector) => {
    setCurrentSector(sector);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sector));
  }, []);

  const clearSector = useCallback(() => {
    setCurrentSector(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <SectorContext.Provider value={{ currentSector, setSector, clearSector }}>
      {children}
    </SectorContext.Provider>
  );
}

export function useCurrentSector() {
  const ctx = useContext(SectorContext);
  if (!ctx) {
    throw new Error("useCurrentSector must be used within a SectorProvider");
  }
  return ctx;
}
