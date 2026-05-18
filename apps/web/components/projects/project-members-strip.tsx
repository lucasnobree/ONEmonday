"use client";

import { useMemo, useState } from "react";
import { UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import {
  useAddProjectMember,
  useRemoveProjectMember,
  type ProjectMember,
} from "@/hooks/use-project-detail";
import { useProjectMemberCandidates } from "@/hooks/use-project-member-candidates";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface ProjectMembersStripProps {
  projectId: string;
  sectorIds: string[];
  members: ProjectMember[];
  /** Whether the current user can add/remove members. */
  canManage: boolean;
}

/** Two-letter initials for an avatar fallback. */
function initials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * The project members roster — avatars with names, plus an add/remove
 * affordance for users who can manage the project. Membership is purely
 * informational (it grants no access).
 */
export function ProjectMembersStrip({
  projectId,
  sectorIds,
  members,
  canManage,
}: ProjectMembersStripProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const addMember = useAddProjectMember(projectId);
  const removeMember = useRemoveProjectMember(projectId);
  const { data: candidates } = useProjectMemberCandidates(
    canManage && pickerOpen ? sectorIds : undefined
  );

  const memberIds = useMemo(
    () => new Set(members.map((m) => m.user_id)),
    [members]
  );
  const available = (candidates ?? []).filter((c) => !memberIds.has(c.id));

  async function handleAdd(userId: string) {
    const result = await addMember.mutateAsync({ userId, role: "member" });
    if (result.error) {
      toast.error("Erro ao adicionar membro", {
        description: String(result.error),
      });
      return;
    }
    toast.success("Membro adicionado");
    setPickerOpen(false);
  }

  async function handleRemove(userId: string) {
    const result = await removeMember.mutateAsync(userId);
    if (result.error) {
      toast.error("Erro ao remover membro", {
        description: String(result.error),
      });
      return;
    }
    toast.success("Membro removido");
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {members.length === 0 && (
        <span className="text-sm text-muted-foreground">
          Nenhum membro neste projeto.
        </span>
      )}
      {members.map((member) => (
        <div
          key={member.user_id}
          className="flex items-center gap-1.5 rounded-full border bg-muted/40 py-0.5 pl-0.5 pr-2"
        >
          <Avatar size="sm">
            <AvatarFallback>{initials(member.full_name)}</AvatarFallback>
          </Avatar>
          <span className="text-xs font-medium">{member.full_name}</span>
          {member.role === "lead" && (
            <span className="text-[10px] uppercase text-muted-foreground">
              Líder
            </span>
          )}
          {canManage && (
            <button
              type="button"
              aria-label={`Remover ${member.full_name}`}
              className="text-muted-foreground hover:text-destructive"
              onClick={() => handleRemove(member.user_id)}
              disabled={removeMember.isPending}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ))}

      {canManage && (
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger
            render={
              <Button variant="outline" size="sm">
                <UserPlus className="mr-1 h-3.5 w-3.5" />
                Adicionar membro
              </Button>
            }
          />
          <PopoverContent className="w-64 p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar pessoa..." />
              <CommandList>
                <CommandEmpty>Nenhuma pessoa disponível.</CommandEmpty>
                <CommandGroup>
                  {available.map((candidate) => (
                    <CommandItem
                      key={candidate.id}
                      value={candidate.full_name}
                      onSelect={() => handleAdd(candidate.id)}
                    >
                      <Avatar size="sm" className="mr-2">
                        <AvatarFallback>
                          {initials(candidate.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      {candidate.full_name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
