"use client";

import { useState } from "react";
import { Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { useCurrentSector } from "@/hooks/use-current-sector";
import { useSectorScope } from "@/hooks/use-sector-scope";
import { SectorScopeFilter } from "@/components/shared/sector-scope-filter";
import { sectorFilterValue } from "@/lib/navigation/scoped-query";
import {
  useSegments,
  useDeleteSegment,
  type AudienceSegment,
} from "@/hooks/marketing/use-segments";
import { SegmentFormDialog } from "@/components/marketing/segment-form-dialog";
import { MarketingError } from "@/components/marketing/marketing-error";
import { CHANNEL_LABELS } from "@/lib/marketing/labels";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

export default function MarketingAudiencesPage() {
  const { scope } = useSectorScope();
  const { currentSector } = useCurrentSector();
  const {
    data: segments,
    isLoading,
    isError,
    refetch,
  } = useSegments(scope);
  const deleteSegment = useDeleteSegment();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AudienceSegment>();

  // Creating a segment needs a concrete target sector; under the all-sectors
  // scope fall back to the sidebar's current sector. An edited segment keeps
  // its own sector.
  const createSectorId = sectorFilterValue(scope) ?? currentSector?.id ?? null;
  const dialogSectorId = editing?.sector_id ?? createSectorId;

  const handleDelete = async (id: string) => {
    const result = await deleteSegment.mutateAsync(id);
    if (result.error) {
      toast.error(
        typeof result.error === "string" ? result.error : "Erro ao excluir"
      );
      return;
    }
    toast.success("Audiência excluída");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Audiências</h2>
        <div className="flex items-center gap-2">
          <SectorScopeFilter />
          <Button
            size="sm"
            disabled={!createSectorId}
            onClick={() => {
              setEditing(undefined);
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-1 h-4 w-4" />
            Nova Audiência
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : isError ? (
        <MarketingError subject="as audiências" onRetry={() => refetch()} />
      ) : segments && segments.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {segments.map((s) => (
            <Card key={s.id}>
              <CardContent className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{s.name}</p>
                  <Badge variant="secondary">{CHANNEL_LABELS[s.channel]}</Badge>
                </div>
                {s.description && (
                  <p className="text-sm text-muted-foreground">
                    {s.description}
                  </p>
                )}
                <p className="text-sm">
                  <span className="font-semibold">
                    {s.estimated_size.toLocaleString("pt-BR")}
                  </span>{" "}
                  <span className="text-muted-foreground">contatos estimados</span>
                </p>
                <div className="flex gap-1 pt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditing(s);
                      setDialogOpen(true);
                    }}
                  >
                    Editar
                  </Button>
                  <ConfirmDialog
                    title="Excluir audiência"
                    description={`Excluir a audiência "${s.name}"? Esta ação não pode ser desfeita.`}
                    onConfirm={() => handleDelete(s.id)}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500"
                      disabled={deleteSegment.isPending}
                    >
                      Excluir
                    </Button>
                  </ConfirmDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center">
          <Users className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Nenhuma audiência cadastrada. Crie segmentos para planejar o
            alcance das campanhas.
          </p>
        </div>
      )}

      {dialogSectorId && (
        <SegmentFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          sectorId={dialogSectorId}
          segment={editing}
        />
      )}
    </div>
  );
}
