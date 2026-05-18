"use client";

import { useChangeMatterStatus } from "@/hooks/legal/use-status-history";
import { MATTER_STATUSES } from "@/lib/validations/legal";
import { MATTER_STATUS_LABELS } from "@/lib/legal/labels";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface MatterStatusControlProps {
  matterId: string;
  status: string;
}

/**
 * Inline matter status quick-change (Wave 4 audit M6). Advancing a matter no
 * longer requires opening the full edit dialog; every change is recorded in
 * the status-change history.
 */
export function MatterStatusControl({
  matterId,
  status,
}: MatterStatusControlProps) {
  const changeStatus = useChangeMatterStatus();

  const handleChange = async (next: string | null) => {
    if (!next || next === status) return;
    const result = await changeStatus.mutateAsync({
      matterId,
      status: next,
    });
    if (result.error) {
      toast.error(
        typeof result.error === "string"
          ? result.error
          : "Erro ao mudar o status"
      );
      return;
    }
    toast.success("Status atualizado");
  };

  return (
    <Select
      value={status}
      onValueChange={handleChange}
      disabled={changeStatus.isPending}
    >
      <SelectTrigger aria-label="Mudar status da demanda" className="w-56">
        <SelectValue>
          {(value: string) =>
            MATTER_STATUS_LABELS[value]?.label ?? value
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {MATTER_STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            {MATTER_STATUS_LABELS[s].label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
