"use client";

import { useMemo, useState } from "react";
import {
  useUpdateLead,
  useDiscardLead,
  useReopenLead,
  useQualifyLead,
  type Lead,
} from "@/hooks/crm/use-leads";
import { useBoards } from "@/hooks/use-boards";
import { useBoardData } from "@/hooks/use-board-data";
import { useCrmMembers } from "@/hooks/crm/use-crm-members";
import { scoreLead, scoreBandLabel } from "@/lib/crm/lead-scoring";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mail, Phone, Building2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { leadBandClass } from "@/lib/crm/lead-ui";

interface LeadDetailSheetProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const dateFormat = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

export function LeadDetailSheet({
  lead,
  open,
  onOpenChange,
}: LeadDetailSheetProps) {
  const updateLead = useUpdateLead();
  const discardLead = useDiscardLead();
  const reopenLead = useReopenLead();
  const qualifyLead = useQualifyLead();

  const { data: boards } = useBoards(lead?.sector_id);
  const { data: members } = useCrmMembers(lead?.sector_id);

  const [mode, setMode] = useState<"view" | "discard" | "qualify">("view");
  const [discardReason, setDiscardReason] = useState("");
  const [boardId, setBoardId] = useState("");
  const [columnId, setColumnId] = useState("");
  const [dealValue, setDealValue] = useState("");
  const [ownerId, setOwnerId] = useState("");

  const { data: board } = useBoardData(boardId || undefined);

  // The CRM pipeline board is matched by name (the existing convention).
  const crmBoard = useMemo(
    () =>
      (boards ?? []).find((b) => {
        const n = (b.name ?? "").toLowerCase();
        return (
          n.includes("crm") || n.includes("pipeline") || n.includes("vendas")
        );
      }),
    [boards]
  );

  // Re-seed the sheet when it (re)opens or the lead changes, by adjusting
  // state during render with a sentinel key — the React-recommended
  // alternative to a syncing effect (matches contact-form-dialog.tsx).
  const seedKey = `${open}:${lead?.id ?? "none"}:${crmBoard?.id ?? ""}`;
  const [seededKey, setSeededKey] = useState<string | null>(null);
  if (open && lead && seededKey !== seedKey) {
    setSeededKey(seedKey);
    setMode("view");
    setDiscardReason("");
    setDealValue("");
    setOwnerId("");
    setBoardId(crmBoard?.id ?? "");
    setColumnId("");
  }

  if (!lead) return null;

  const columns = board?.columns ?? [];

  // Re-derive the score breakdown so the sheet can explain WHY a lead scored.
  const breakdown = scoreLead({
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    company: lead.company,
    source: lead.source,
    payload: lead.payload,
  });

  const isTerminal =
    lead.status === "qualified" || lead.status === "discarded";

  const handleStatus = async (status: "new" | "working") => {
    const result = await updateLead.mutateAsync({ id: lead.id, status });
    if (result.error) {
      toast.error(
        typeof result.error === "string" ? result.error : "Erro ao atualizar"
      );
      return;
    }
    toast.success("Lead atualizado");
  };

  const handleDiscard = async () => {
    const result = await discardLead.mutateAsync({
      id: lead.id,
      reason: discardReason,
    });
    if (result.error) {
      toast.error(
        typeof result.error === "string" ? result.error : "Erro ao descartar"
      );
      return;
    }
    toast.success("Lead descartado");
    onOpenChange(false);
  };

  const handleReopen = async () => {
    const result = await reopenLead.mutateAsync(lead.id);
    if (result.error) {
      toast.error(
        typeof result.error === "string" ? result.error : "Erro ao reabrir"
      );
      return;
    }
    toast.success("Lead reaberto");
  };

  const handleQualify = async () => {
    const targetColumn = columnId || columns[0]?.id;
    if (!boardId || !targetColumn) {
      toast.error("Selecione o board e a coluna do pipeline");
      return;
    }
    const result = await qualifyLead.mutateAsync({
      id: lead.id,
      boardId,
      columnId: targetColumn,
      value: dealValue ? parseFloat(dealValue) : undefined,
      ownerId: ownerId || undefined,
    });
    if (result.error) {
      toast.error(
        typeof result.error === "string" ? result.error : "Erro ao qualificar"
      );
      return;
    }
    toast.success("Lead qualificado — deal criado no pipeline");
    onOpenChange(false);
  };

  const payloadEntries = Object.entries(lead.payload ?? {});

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {lead.name}
            <Badge className={leadBandClass(lead.score)}>
              {lead.score} · {scoreBandLabel(breakdown.band)}
            </Badge>
          </SheetTitle>
          <SheetDescription>
            Lead via {lead.source} ·{" "}
            {dateFormat.format(new Date(lead.created_at))}
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-4 space-y-4">
          {/* Contact info */}
          <div className="space-y-2 text-sm">
            {lead.email && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="size-4" />
                <span>{lead.email}</span>
              </div>
            )}
            {lead.phone && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="size-4" />
                <span>{lead.phone}</span>
              </div>
            )}
            {lead.company && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Building2 className="size-4" />
                <span>{lead.company}</span>
              </div>
            )}
          </div>

          {payloadEntries.length > 0 && (
            <>
              <Separator />
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase">
                  Campos enviados
                </p>
                {payloadEntries.map(([key, value]) => (
                  <div key={key} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{key}</span>
                    <span className="font-medium">{String(value)}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <Separator />

          {/* Score breakdown */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase">
              Pontuação ({lead.score})
            </p>
            {breakdown.rules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center justify-between text-sm"
              >
                <span
                  className={
                    rule.matched
                      ? "text-foreground"
                      : "text-muted-foreground line-through"
                  }
                >
                  {rule.label}
                </span>
                <span
                  className={
                    rule.matched
                      ? "font-medium text-emerald-600"
                      : "text-muted-foreground"
                  }
                >
                  {rule.matched ? `+${rule.points}` : "0"}
                </span>
              </div>
            ))}
          </div>

          {lead.status === "discarded" && lead.discard_reason && (
            <>
              <Separator />
              <div className="rounded-lg bg-muted p-3 text-sm">
                <p className="font-medium">Motivo do descarte</p>
                <p className="text-muted-foreground">{lead.discard_reason}</p>
              </div>
            </>
          )}

          <Separator />

          {/* Triage actions */}
          {mode === "view" && (
            <div className="space-y-2">
              {lead.status === "new" && (
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => handleStatus("working")}
                  disabled={updateLead.isPending}
                >
                  Iniciar trabalho do lead
                </Button>
              )}
              {!isTerminal && (
                <>
                  <Button
                    className="w-full"
                    onClick={() => setMode("qualify")}
                  >
                    <CheckCircle2 className="size-4 mr-1" />
                    Qualificar (criar deal)
                  </Button>
                  <Button
                    className="w-full"
                    variant="ghost"
                    onClick={() => setMode("discard")}
                  >
                    <XCircle className="size-4 mr-1" />
                    Descartar
                  </Button>
                </>
              )}
              {lead.status === "discarded" && (
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={handleReopen}
                  disabled={reopenLead.isPending}
                >
                  Reabrir lead
                </Button>
              )}
              {lead.status === "qualified" && (
                <p className="text-sm text-muted-foreground text-center">
                  Lead qualificado e convertido em deal.
                </p>
              )}
            </div>
          )}

          {/* Discard form */}
          {mode === "discard" && (
            <div className="space-y-3">
              <div className="grid gap-2">
                <Label htmlFor="discard-reason">Motivo do descarte</Label>
                <Textarea
                  id="discard-reason"
                  value={discardReason}
                  onChange={(e) => setDiscardReason(e.target.value)}
                  placeholder="Ex.: fora do perfil, sem orçamento..."
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setMode("view")}
                >
                  Voltar
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleDiscard}
                  disabled={discardLead.isPending || !discardReason.trim()}
                >
                  Confirmar descarte
                </Button>
              </div>
            </div>
          )}

          {/* Qualify form */}
          {mode === "qualify" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Qualificar cria um contato e um deal no pipeline a partir
                deste lead.
              </p>
              <div className="grid gap-2">
                <Label>Board do pipeline</Label>
                <Select
                  value={boardId}
                  onValueChange={(v) => {
                    setBoardId(v ?? "");
                    setColumnId("");
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione o board" />
                  </SelectTrigger>
                  <SelectContent>
                    {(boards ?? []).map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Estágio inicial</Label>
                <Select
                  value={columnId}
                  onValueChange={(v) => setColumnId(v ?? "")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Primeira coluna" />
                  </SelectTrigger>
                  <SelectContent>
                    {columns.map((col) => (
                      <SelectItem key={col.id} value={col.id}>
                        {col.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="qualify-value">Valor do deal (R$)</Label>
                <Input
                  id="qualify-value"
                  type="number"
                  min="0"
                  step="0.01"
                  value={dealValue}
                  onChange={(e) => setDealValue(e.target.value)}
                  placeholder="Opcional"
                />
              </div>
              <div className="grid gap-2">
                <Label>Responsável</Label>
                <Select
                  value={ownerId}
                  onValueChange={(v) => setOwnerId(v ?? "")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Eu (padrão)" />
                  </SelectTrigger>
                  <SelectContent>
                    {(members ?? []).map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setMode("view")}
                >
                  Voltar
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleQualify}
                  disabled={qualifyLead.isPending}
                >
                  Qualificar lead
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
