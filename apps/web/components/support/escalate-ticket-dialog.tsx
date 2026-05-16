"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { escalateTicket } from "@/lib/actions/support/escalate";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface EscalateTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketId: string;
  currentSectorId: string;
}

interface EscalationSectorOption {
  id: string;
  name: string;
}

// Row shape returned by the user_sector_roles -> sectors join.
interface UserSectorRoleRow {
  sector_id: string;
  sectors: { id: string; name: string } | null;
}

// Inner form: remounted via `key={open}` so fields reset on each open
// without a setState-in-effect.
function EscalateTicketForm({
  onOpenChange,
  ticketId,
  currentSectorId,
}: {
  onOpenChange: (open: boolean) => void;
  ticketId: string;
  currentSectorId: string;
}) {
  const queryClient = useQueryClient();
  const [toSectorId, setToSectorId] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: sectors } = useQuery<EscalationSectorOption[]>({
    queryKey: ["user-sectors-for-escalation", currentSectorId],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("user_sector_roles")
        .select("sector_id, sectors(id, name)")
        .neq("sector_id", currentSectorId);

      if (!data) return [];
      const rows = data as unknown as UserSectorRoleRow[];
      const seen = new Set<string>();
      return rows
        .filter((r) => {
          if (!r.sectors || seen.has(r.sector_id)) return false;
          seen.add(r.sector_id);
          return true;
        })
        .map((r) => ({
          id: r.sectors!.id,
          name: r.sectors!.name,
        }));
    },
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!toSectorId || !reason.trim()) return;

    setSubmitting(true);
    const result = await escalateTicket({
      ticketId,
      toSectorId,
      reason: reason.trim(),
    });
    setSubmitting(false);

    if (result.error) {
      toast.error(
        typeof result.error === "string"
          ? result.error
          : "Erro ao escalar ticket"
      );
      return;
    }

    toast.success("Ticket escalado");
    queryClient.invalidateQueries({ queryKey: ["ticket-detail"] });
    queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
    queryClient.invalidateQueries({ queryKey: ["escalation-log", ticketId] });
    onOpenChange(false);
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>Escalar Ticket</DialogTitle>
        <DialogDescription>
          Transfira este ticket para outro setor
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label>Setor de destino</Label>
          <Select
            value={toSectorId}
            onValueChange={(v) => setToSectorId(v ?? "")}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione o setor" />
            </SelectTrigger>
            <SelectContent>
              {sectors?.map((sector) => (
                <SelectItem key={sector.id} value={sector.id}>
                  {sector.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {sectors?.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Você não tem acesso a outros setores para escalar.
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="escalate-reason">Motivo</Label>
          <Textarea
            id="escalate-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Descreva o motivo da escalacao..."
            rows={3}
            required
          />
        </div>
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={submitting || !toSectorId || !reason.trim()}
        >
          {submitting ? "Escalando..." : "Escalar"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function EscalateTicketDialog({
  open,
  onOpenChange,
  ticketId,
  currentSectorId,
}: EscalateTicketDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open && (
          <EscalateTicketForm
            onOpenChange={onOpenChange}
            ticketId={ticketId}
            currentSectorId={currentSectorId}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
