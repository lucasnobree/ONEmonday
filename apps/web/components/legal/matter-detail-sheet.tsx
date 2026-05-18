"use client";

import { useState } from "react";
import type { Matter } from "@/hooks/legal/use-matters";
import { useContracts } from "@/hooks/legal/use-contracts";
import { useSectorMembers } from "@/hooks/legal/use-sector-members";
import { MatterFormDialog } from "./matter-form-dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  MATTER_STATUS_LABELS,
  MATTER_TYPE_LABELS,
  MATTER_PRIORITY_LABELS,
} from "@/lib/legal/labels";
import { Gavel, Pencil } from "lucide-react";

const dateFormat = new Intl.DateTimeFormat("pt-BR");

interface MatterDetailSheetProps {
  matter: Matter | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}

/** Read-only legal-matter record view. "Editar" is a deliberate action. */
export function MatterDetailSheet({
  matter,
  open,
  onOpenChange,
}: MatterDetailSheetProps) {
  const [showEdit, setShowEdit] = useState(false);
  const { data: members } = useSectorMembers(matter?.sector_id);
  const { data: contracts } = useContracts(matter?.sector_id);

  if (!matter) return null;

  const statusInfo = MATTER_STATUS_LABELS[matter.status] ?? {
    label: matter.status,
    variant: "secondary" as const,
  };
  const priorityInfo = MATTER_PRIORITY_LABELS[matter.priority] ?? {
    label: matter.priority,
    variant: "secondary" as const,
  };
  const assignee = matter.assigned_to
    ? ((members ?? []).find((m) => m.id === matter.assigned_to)?.full_name ??
      "-")
    : "Não atribuída";
  const requester =
    (members ?? []).find((m) => m.id === matter.requested_by)?.full_name ??
    "-";
  const relatedContract = matter.contract_id
    ? (contracts ?? []).find((c) => c.id === matter.contract_id)
    : undefined;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Gavel className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <SheetTitle>{matter.title}</SheetTitle>
                <SheetDescription>
                  {MATTER_TYPE_LABELS[matter.matter_type] ??
                    matter.matter_type}
                </SheetDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
              <Badge variant={priorityInfo.variant}>
                {priorityInfo.label}
              </Badge>
            </div>
            <div className="pt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowEdit(true)}
              >
                <Pencil className="h-4 w-4 mr-1" />
                Editar
              </Button>
            </div>
          </SheetHeader>

          <div className="px-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Responsável" value={assignee} />
              <Field label="Solicitante" value={requester} />
              <Field
                label="Prazo"
                value={
                  matter.due_date
                    ? dateFormat.format(new Date(matter.due_date))
                    : "-"
                }
              />
              <Field
                label="Criada em"
                value={dateFormat.format(new Date(matter.created_at))}
              />
              <Field
                label="Contrato relacionado"
                value={relatedContract ? relatedContract.title : "-"}
              />
              <Field
                label="Resolvida em"
                value={
                  matter.resolved_at
                    ? dateFormat.format(new Date(matter.resolved_at))
                    : "-"
                }
              />
            </div>

            {matter.description && (
              <>
                <Separator />
                <div className="space-y-1">
                  <h4 className="text-sm font-medium">Descrição</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {matter.description}
                  </p>
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <MatterFormDialog
        key={matter.id}
        matter={matter}
        open={showEdit}
        onOpenChange={setShowEdit}
        hideTrigger
      />
    </>
  );
}
