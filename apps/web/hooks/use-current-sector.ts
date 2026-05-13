"use client";

import { useState, useEffect, useCallback } from "react";

interface Sector {
  id: string;
  slug: string;
  name: string;
}

const STORAGE_KEY = "onemonday-current-sector";

export function useCurrentSector() {
  const [currentSector, setCurrentSector] = useState<Sector | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setCurrentSector(JSON.parse(stored));
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  const setSector = useCallback((sector: Sector) => {
    setCurrentSector(sector);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sector));
  }, []);

  const clearSector = useCallback(() => {
    setCurrentSector(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { currentSector, setSector, clearSector };
}
