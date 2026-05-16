"use client";

import { useState } from "react";
import {
  useSectorMembers,
  useAssignTicket,
  useUnassignTicket,
} from "@/hooks/support/use-ticket-assignment";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { toast } from "sonner";
import { UserPlus, X, Check } from "lucide-react";

interface CurrentAssignee {
  user_id: string;
  name: string;
}

interface TicketAssigneePickerProps {
  ticketId: string;
  ticketCardId: string;
  sectorId: string;
  assignees: CurrentAssignee[];
}

export function TicketAssigneePicker({
  ticketId,
  ticketCardId,
  sectorId,
  assignees,
}: TicketAssigneePickerProps) {
  const { data: members } = useSectorMembers(sectorId);
  const assign = useAssignTicket(ticketCardId);
  const unassign = useUnassignTicket(ticketCardId);
  const [open, setOpen] = useState(false);

  const assignedIds = new Set(assignees.map((a) => a.user_id));
  const busy = assign.isPending || unassign.isPending;

  async function handleAssign(userId: string) {
    const result = await assign.mutateAsync({ ticketId, userId });
    if (result.error) {
      toast.error(
        typeof result.error === "string"
          ? result.error
          : "Erro ao atribuir ticket"
      );
      return;
    }
    toast.success("Responsável atribuído");
    setOpen(false);
  }

  async function handleUnassign(userId: string) {
    const result = await unassign.mutateAsync({ ticketId, userId });
    if (result.error) {
      toast.error(
        typeof result.error === "string"
          ? result.error
          : "Erro ao remover responsável"
      );
      return;
    }
    toast.success("Responsável removido");
  }

  return (
    <div className="space-y-2">
      {assignees.length > 0 ? (
        <div className="space-y-1">
          {assignees.map((a) => (
            <div key={a.user_id} className="flex items-center gap-2 text-sm">
              <div className="size-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                {(a.name || "?").charAt(0).toUpperCase()}
              </div>
              <span className="flex-1 truncate">{a.name}</span>
              <button
                type="button"
                onClick={() => handleUnassign(a.user_id)}
                disabled={busy}
                className="text-muted-foreground hover:text-foreground"
                title="Remover responsável"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Ninguém atribuído.</p>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={<Button variant="outline" size="sm" className="h-7 text-xs" />}
        >
          <UserPlus className="size-3.5 mr-1" />
          Atribuir responsavel
        </PopoverTrigger>
        <PopoverContent className="w-60 p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar membro do setor..." />
            <CommandList>
              <CommandEmpty>Nenhum membro encontrado.</CommandEmpty>
              <CommandGroup>
                {(members ?? []).map((member) => {
                  const isAssigned = assignedIds.has(member.id);
                  return (
                    <CommandItem
                      key={member.id}
                      value={`${member.full_name} ${member.email}`}
                      onSelect={() =>
                        isAssigned
                          ? handleUnassign(member.id)
                          : handleAssign(member.id)
                      }
                    >
                      <span className="flex-1 truncate">
                        {member.full_name}
                      </span>
                      {isAssigned && (
                        <Check className="size-3.5 text-green-600" />
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export type { CurrentAssignee };
