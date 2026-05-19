"use client";

import { useCallback, useState } from "react";
import {
  EXPANSION_STORAGE_KEY,
  ensureExpanded,
  parseExpandedState,
  serializeExpandedState,
  toggleExpanded,
} from "@/lib/navigation/expansion-state";

/**
 * Manages the sidebar tree's expand/collapse state, persisted to
 * `localStorage` so the tree shape survives reloads.
 *
 * `toggle` flips a single node; `expandBranch` opens a set of ancestor ids
 * without collapsing anything (used to auto-reveal the active route). The
 * persisted set is written on every change.
 */
export function useTreeExpansion() {
  // Lazy initialiser reads localStorage exactly once, on mount. SSR returns
  // an empty set (no `window`); the first client render then hydrates it.
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    return parseExpandedState(window.localStorage.getItem(EXPANSION_STORAGE_KEY));
  });

  const persist = useCallback((next: Set<string>) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        EXPANSION_STORAGE_KEY,
        serializeExpandedState(next)
      );
    }
  }, []);

  const toggle = useCallback(
    (id: string) => {
      setExpanded((prev) => {
        const next = toggleExpanded(prev, id);
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const expandBranch = useCallback(
    (ids: (string | null | undefined)[]) => {
      setExpanded((prev) => {
        const next = ensureExpanded(prev, ids);
        // `ensureExpanded` returns the same ref when nothing changed —
        // skipping the persist + re-render keeps this safe to call freely.
        if (next === prev) return prev;
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const isExpanded = useCallback(
    (id: string) => expanded.has(id),
    [expanded]
  );

  return { isExpanded, toggle, expandBranch };
}
