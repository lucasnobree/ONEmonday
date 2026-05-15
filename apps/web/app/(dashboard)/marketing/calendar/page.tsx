"use client";

import { useState } from "react";
import { useCurrentSector } from "@/hooks/use-current-sector";
import { useContentItems, type ContentItem } from "@/hooks/marketing/use-content-items";
import { useCampaigns } from "@/hooks/marketing/use-campaigns";
import { ContentCalendar } from "@/components/marketing/content-calendar";
import { ContentFormDialog } from "@/components/marketing/content-form-dialog";
import { currentMonth } from "@/lib/marketing/calendar";

export default function MarketingCalendarPage() {
  const { currentSector } = useCurrentSector();
  const { data: items } = useContentItems(currentSector?.id);
  const { data: campaigns } = useCampaigns(currentSector?.id);

  const [month, setMonth] = useState(currentMonth());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ContentItem>();
  const [defaultDate, setDefaultDate] = useState<string>();

  if (!currentSector) {
    return (
      <p className="text-sm text-muted-foreground">
        Selecione um setor no menu lateral para ver o calendario.
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
      <h2 className="text-lg font-semibold">Calendario Editorial</h2>

      <ContentCalendar
        month={month}
        onMonthChange={setMonth}
        items={items ?? []}
        onSelectItem={openForItem}
        onAddOnDate={openForDate}
      />

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
