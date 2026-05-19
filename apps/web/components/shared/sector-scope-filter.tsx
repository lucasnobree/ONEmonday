"use client";

import { FilterSelect } from "@/components/shared/filter-select";
import { useAllSectors } from "@/hooks/use-all-sectors";
import { useSectorScope } from "@/hooks/use-sector-scope";
import { ALL_SECTORS } from "@/lib/navigation/sector-scope";

/**
 * On-screen sector filter (`Setor: [Todos ▾]`) for module screens.
 *
 * Renders the selector **only for global admins** — they can scope a screen
 * to any sector or to "Todos" (all sectors). For sector managers and
 * individual contributors the screen is locked to their own sector, so this
 * component renders nothing: the lock is enforced in {@link useSectorScope},
 * not by hiding a control.
 *
 * The chosen scope is shared via `localStorage`, so picking a sector here
 * also updates every other module screen.
 */
export function SectorScopeFilter() {
  const { scope, setScope, canChangeScope } = useSectorScope();
  // Only fetch the full sector list when the selector will actually render.
  const { sectors } = useAllSectors(canChangeScope);

  if (!canChangeScope) return null;

  const options = [
    { value: ALL_SECTORS, label: "Todos os setores" },
    ...sectors.map((s) => ({ value: s.id, label: s.name })),
  ];

  return (
    <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <span className="shrink-0">Setor:</span>
      <FilterSelect
        value={scope}
        onValueChange={setScope}
        options={options}
        className="w-48"
        aria-label="Filtrar por setor"
      />
    </label>
  );
}
