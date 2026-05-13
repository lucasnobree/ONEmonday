"use client";

import { usePermissions } from "@/hooks/use-permissions";
import { useCurrentSector } from "@/hooks/use-current-sector";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function SectorSwitcher() {
  const { sectorRoles, isGlobalAdmin } = usePermissions();
  const { currentSector, setSector } = useCurrentSector();

  const sectors = sectorRoles.map((sr) => ({
    id: sr.sectorId,
    slug: sr.sectorSlug,
    name: sr.sectorName,
  }));

  if (sectors.length === 0 && !isGlobalAdmin) return null;

  return (
    <Select
      value={currentSector?.id ?? ""}
      onValueChange={(value) => {
        const sector = sectors.find((s) => s.id === value);
        if (sector) setSector(sector);
      }}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Selecione um setor" />
      </SelectTrigger>
      <SelectContent>
        {sectors.map((sector) => (
          <SelectItem key={sector.id} value={sector.id}>
            {sector.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
