"use client";

import { useState } from "react";
import { useCurrentSector } from "@/hooks/use-current-sector";
import { useSectorScope } from "@/hooks/use-sector-scope";
import { SectorScopeFilter } from "@/components/shared/sector-scope-filter";
import { sectorFilterValue } from "@/lib/navigation/scoped-query";
import { useContentItems, type ContentItem } from "@/hooks/marketing/use-content-items";
import { useCampaigns } from "@/hooks/marketing/use-campaigns";
import { ContentCalendar } from "@/components/marketing/content-calendar";
import { ContentFormDialog } from "@/components/marketing/content-form-dialog";
import { MarketingError } from "@/components/marketing/marketing-error";
import { currentMonth } from "@/lib/marketing/calendar";
import { Skeleton } from "@/components/ui/skeleton";

export default function MarketingCalendarPage() {
  const { scope } = useSectorScope();
  const { currentSector } = useCurrentSector();
  const {
    data: items,
    isLoading,
    isError,
    refetch,
  } = useContentItems(scope);
  const { data: campaigns } = useCampaigns(scope);

  const [month, setMonth] = useState(currentMonth());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ContentItem>();
  const [defaultDate, setDefaultDate] = useState<string>();

  // Creating content needs a concrete target sector; under the all-sectors
  // scope fall back to the sidebar's current sector. An edited item keeps
  // its own sector.
  const createSectorId = sectorFilterValue(scope) ?? currentSector?.id ?? null;
  const dialogSectorId = editing?.sector_id ?? createSectorId;

  const openForDate = (date: string) => {
    if (!createSectorId) return;
    setEditing(undefined);
    setDefaultDate(date);
    setDialogOpen(true);
  };

  const openForItem = (item: ContentItem) => {
    setEditing(item);
    setDefaultDate(undefined);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Calendário Editorial</h2>
        <SectorScopeFilter />
      </div>

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : isError ? (
        <MarketingError
          subject="o calendário editorial"
          onRetry={() => refetch()}
        />
      ) : (
        <ContentCalendar
          month={month}
          onMonthChange={setMonth}
          items={items ?? []}
          onSelectItem={openForItem}
          onAddOnDate={openForDate}
        />
      )}

      {dialogSectorId && (
        <ContentFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          sectorId={dialogSectorId}
          campaigns={campaigns ?? []}
          item={editing}
          defaultDate={defaultDate}
        />
      )}
    </div>
  );
}
