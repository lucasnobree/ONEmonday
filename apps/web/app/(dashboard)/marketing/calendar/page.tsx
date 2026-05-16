"use client";

import { useState } from "react";
import { useCurrentSector } from "@/hooks/use-current-sector";
import { useContentItems, type ContentItem } from "@/hooks/marketing/use-content-items";
import { useCampaigns } from "@/hooks/marketing/use-campaigns";
import { ContentCalendar } from "@/components/marketing/content-calendar";
import { ContentFormDialog } from "@/components/marketing/content-form-dialog";
import { MarketingError } from "@/components/marketing/marketing-error";
import { currentMonth } from "@/lib/marketing/calendar";
import { Skeleton } from "@/components/ui/skeleton";

export default function MarketingCalendarPage() {
  const { currentSector } = useCurrentSector();
  const {
    data: items,
    isLoading,
    isError,
    refetch,
  } = useContentItems(currentSector?.id);
  const { data: campaigns } = useCampaigns(currentSector?.id);

  const [month, setMonth] = useState(currentMonth());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ContentItem>();
  const [defaultDate, setDefaultDate] = useState<string>();

  if (!currentSector) {
    return (
      <p className="text-sm text-muted-foreground">
        Selecione um setor no menu lateral para ver o calendário.
      </p>
    );
  }

  const openForDate = (date: string) => {
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
      <h2 className="text-lg font-semibold">Calendário Editorial</h2>

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

      <ContentFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        sectorId={currentSector.id}
        campaigns={campaigns ?? []}
        item={editing}
        defaultDate={defaultDate}
      />
    </div>
  );
}
