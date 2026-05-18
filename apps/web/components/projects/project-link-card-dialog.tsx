"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  useLinkableCards,
  useLinkProjectCard,
} from "@/hooks/use-project-detail";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";

interface ProjectLinkCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  sectorIds: string[];
  /** Ids of cards already linked, hidden from the picker. */
  linkedCardIds: string[];
}

/**
 * Lets a user attach an existing board card to the project. Only cards in
 * the project's own sectors are listed (the server action re-checks this),
 * and already-linked cards are excluded.
 */
export function ProjectLinkCardDialog({
  open,
  onOpenChange,
  projectId,
  sectorIds,
  linkedCardIds,
}: ProjectLinkCardDialogProps) {
  const linkedSet = new Set(linkedCardIds);
  const { data: cards, isLoading } = useLinkableCards(
    sectorIds,
    linkedSet,
    open
  );
  const linkCard = useLinkProjectCard(projectId);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function handleLink(cardId: string) {
    setPendingId(cardId);
    const result = await linkCard.mutateAsync(cardId);
    setPendingId(null);
    if (result.error) {
      toast.error("Erro ao vincular card", {
        description: String(result.error),
      });
      return;
    }
    toast.success("Card vinculado ao projeto");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0">
        <DialogHeader className="px-4 pt-4">
          <DialogTitle>Vincular card</DialogTitle>
          <DialogDescription>
            Escolha um card dos boards deste projeto para acompanhá-lo aqui.
          </DialogDescription>
        </DialogHeader>
        <Command>
          <CommandInput placeholder="Buscar card por título..." />
          <CommandList>
            <CommandEmpty>
              {isLoading
                ? "Carregando cards..."
                : "Nenhum card disponível para vincular."}
            </CommandEmpty>
            {cards && cards.length > 0 && (
              <CommandGroup heading="Cards disponíveis">
                {cards.map((card) => (
                  <CommandItem
                    key={card.id}
                    value={`${card.title} ${card.board_name}`}
                    onSelect={() => handleLink(card.id)}
                    disabled={pendingId !== null}
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate">{card.title}</span>
                      {card.board_name && (
                        <span className="truncate text-xs text-muted-foreground">
                          {card.board_name}
                        </span>
                      )}
                    </div>
                    {pendingId === card.id && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        Vinculando...
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
