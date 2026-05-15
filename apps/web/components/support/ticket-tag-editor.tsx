"use client";

import { useState } from "react";
import {
  useSectorTags,
  useTicketTags,
  useCreateTicketTag,
  useAddTagToTicket,
  useRemoveTagFromTicket,
  TAG_COLOR_CLASSES,
} from "@/hooks/support/use-ticket-tags";
import { Badge } from "@/components/ui/badge";
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
import { Tag, Plus, X, Check } from "lucide-react";

interface TicketTagEditorProps {
  ticketId: string;
  sectorId: string;
}

export function TicketTagEditor({ ticketId, sectorId }: TicketTagEditorProps) {
  const { data: sectorTags } = useSectorTags(sectorId);
  const { data: ticketTags } = useTicketTags(ticketId);
  const createTag = useCreateTicketTag();
  const addTag = useAddTagToTicket();
  const removeTag = useRemoveTagFromTicket();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const assignedIds = new Set((ticketTags ?? []).map((t) => t.id));
  const available = (sectorTags ?? []).filter((t) => !assignedIds.has(t.id));
  const query = search.trim().toLowerCase();
  const exactMatch = (sectorTags ?? []).some((t) => t.name === query);
  const busy = createTag.isPending || addTag.isPending || removeTag.isPending;

  async function handleAdd(tagId: string) {
    const result = await addTag.mutateAsync({ ticketId, tagId });
    if (result.error) {
      toast.error(
        typeof result.error === "string"
          ? result.error
          : "Erro ao adicionar tag"
      );
      return;
    }
    setSearch("");
  }

  async function handleRemove(tagId: string) {
    const result = await removeTag.mutateAsync({ ticketId, tagId });
    if (result.error) {
      toast.error(
        typeof result.error === "string"
          ? result.error
          : "Erro ao remover tag"
      );
    }
  }

  async function handleCreateAndAdd() {
    if (!query) return;
    const result = await createTag.mutateAsync({ sectorId, name: query });
    if (result.error || !("data" in result) || !result.data) {
      toast.error(
        typeof result.error === "string"
          ? result.error
          : "Erro ao criar tag"
      );
      return;
    }
    await handleAdd(result.data.id);
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {(ticketTags ?? []).map((tag) => (
        <Badge
          key={tag.id}
          variant="secondary"
          className={`gap-1 ${TAG_COLOR_CLASSES[tag.color]}`}
        >
          {tag.name}
          <button
            type="button"
            onClick={() => handleRemove(tag.id)}
            disabled={busy}
            className="hover:opacity-70"
            title="Remover tag"
          >
            <X className="size-3" />
          </button>
        </Badge>
      ))}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button variant="outline" size="sm" className="h-6 px-2 text-xs" />
          }
        >
          <Tag className="size-3 mr-1" />
          Tag
        </PopoverTrigger>
        <PopoverContent className="w-56 p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Buscar ou criar tag..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>
                {query && !exactMatch ? (
                  <button
                    type="button"
                    onClick={handleCreateAndAdd}
                    disabled={busy}
                    className="flex w-full items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent"
                  >
                    <Plus className="size-3.5" />
                    Criar &quot;{query}&quot;
                  </button>
                ) : (
                  "Nenhuma tag encontrada."
                )}
              </CommandEmpty>
              {available.length > 0 && (
                <CommandGroup>
                  {available.map((tag) => (
                    <CommandItem
                      key={tag.id}
                      value={tag.name}
                      onSelect={() => handleAdd(tag.id)}
                    >
                      <span
                        className={`mr-2 size-2.5 rounded-full ${
                          TAG_COLOR_CLASSES[tag.color]
                        }`}
                      />
                      {tag.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {query && !exactMatch && available.length > 0 && (
                <CommandGroup>
                  <CommandItem value={`__create_${query}`} onSelect={handleCreateAndAdd}>
                    <Plus className="size-3.5 mr-2" />
                    Criar &quot;{query}&quot;
                  </CommandItem>
                </CommandGroup>
              )}
              {query && exactMatch && !available.length && (
                <CommandGroup>
                  <CommandItem value="__exists" disabled>
                    <Check className="size-3.5 mr-2" />
                    Ja adicionada
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
