"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useClauses } from "@/hooks/legal/use-clauses";
import { linkClauseToContract } from "@/lib/actions/legal/contract-clauses";
import { CLAUSE_CATEGORY_LABELS } from "@/lib/legal/labels";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { toast } from "sonner";

interface ClausePickerProps {
  contractId: string;
  sectorId: string;
  /** Clause ids already linked — excluded from the picker. */
  linkedClauseIds: string[];
}

/**
 * A searchable picker that links a pre-approved library clause to a contract.
 * Clauses already linked are filtered out so the same clause cannot be added
 * twice (the DB also enforces this with a unique constraint).
 */
export function ClausePicker({
  contractId,
  sectorId,
  linkedClauseIds,
}: ClausePickerProps) {
  const { data: clauses } = useClauses(sectorId);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const linked = new Set(linkedClauseIds);
  const available = (clauses ?? []).filter((c) => !linked.has(c.id));

  async function handleSelect(clauseId: string) {
    setPending(true);
    const result = await linkClauseToContract({ contractId, clauseId });
    setPending(false);

    if (result && "error" in result && result.error) {
      toast.error(
        typeof result.error === "string"
          ? result.error
          : "Erro ao vincular cláusula"
      );
      return;
    }
    toast.success("Cláusula vinculada");
    queryClient.invalidateQueries({
      queryKey: ["legal-contract-clauses", contractId],
    });
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<Button size="sm" variant="outline" disabled={pending} />}
      >
        <Plus className="h-4 w-4 mr-1" />
        Vincular cláusula
      </PopoverTrigger>
      <PopoverContent className="p-0 w-80" align="end">
        <Command>
          <CommandInput placeholder="Buscar cláusula..." />
          <CommandList>
            <CommandEmpty>
              {available.length === 0
                ? "Nenhuma cláusula disponível."
                : "Nenhuma cláusula encontrada."}
            </CommandEmpty>
            <CommandGroup>
              {available.map((clause) => (
                <CommandItem
                  key={clause.id}
                  value={`${clause.title} ${clause.body}`}
                  onSelect={() => handleSelect(clause.id)}
                >
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="font-medium truncate">
                      {clause.title}
                    </span>
                    <Badge variant="outline" className="w-fit text-xs">
                      {CLAUSE_CATEGORY_LABELS[clause.category] ??
                        clause.category}
                    </Badge>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
