"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { updateTicketStatus } from "@/lib/actions/support/tickets";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TICKET_STATUS_META,
  TICKET_STATUS_OPTIONS,
  normalizeTicketStatus,
} from "@/lib/support/status";

interface TicketStatusSelectProps {
  ticketId: string;
  status: string;
  className?: string;
}

/**
 * Inline status picker for a ticket. Persists via the server action and
 * refreshes the ticket queries so the SLA pause/resume is reflected.
 */
export function TicketStatusSelect({
  ticketId,
  status,
  className,
}: TicketStatusSelectProps) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const current = normalizeTicketStatus(status);

  async function handleChange(value: string | null) {
    if (!value || value === current) return;
    setSaving(true);
    const result = await updateTicketStatus({ ticketId, status: value });
    setSaving(false);
    if (result.error) {
      toast.error(
        typeof result.error === "string"
          ? result.error
          : "Erro ao alterar status"
      );
      return;
    }
    toast.success(`Status: ${TICKET_STATUS_META[normalizeTicketStatus(value)].label}`);
    queryClient.invalidateQueries({ queryKey: ["ticket-detail"] });
    queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
    queryClient.invalidateQueries({ queryKey: ["sla-status"] });
  }

  return (
    <Select value={current} onValueChange={handleChange} disabled={saving}>
      <SelectTrigger className={className}>
        <SelectValue>
          {(value) =>
            TICKET_STATUS_META[normalizeTicketStatus(value as string)].label
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {TICKET_STATUS_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
