"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tag as TagIcon, Check } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { setCardTags } from "@/lib/actions/cards";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface SectorTag {
  id: string;
  name: string;
  color: string;
}

interface CardTagsEditorProps {
  cardId: string;
  sectorId: string;
  /** Tags currently attached to the card. */
  selectedTagIds: string[];
  onChanged: () => void;
}

/**
 * Lets a user attach/detach sector tags on a card. Tags were previously
 * display-only; this wires up the existing `card_tags` join.
 */
export function CardTagsEditor({
  cardId,
  sectorId,
  selectedTagIds,
  onChanged,
}: CardTagsEditorProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: tags } = useQuery<SectorTag[]>({
    queryKey: ["sector-tags", sectorId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("tags")
        .select("id, name, color")
        .eq("is_active", true)
        .or(`sector_id.eq.${sectorId},sector_id.is.null`)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const selected = useMemo(
    () => new Set(selectedTagIds),
    [selectedTagIds]
  );

  async function toggleTag(tagId: string) {
    const next = new Set(selected);
    if (next.has(tagId)) {
      next.delete(tagId);
    } else {
      next.add(tagId);
    }

    setSaving(true);
    const result = await setCardTags({
      cardId,
      tagIds: Array.from(next),
    });
    setSaving(false);

    if (result.error) {
      toast.error("Erro ao atualizar tags", {
        description:
          typeof result.error === "string" ? result.error : undefined,
      });
      return;
    }
    onChanged();
  }

  const selectedTags = (tags ?? []).filter((t) => selected.has(t.id));

  return (
    <div className="flex flex-wrap items-center gap-1">
      {selectedTags.map((tag) => (
        <Badge
          key={tag.id}
          variant="secondary"
          style={{ backgroundColor: tag.color + "20", color: tag.color }}
        >
          {tag.name}
        </Badge>
      ))}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button variant="outline" size="sm" disabled={saving}>
              <TagIcon className="h-3.5 w-3.5 mr-1" />
              Tags
            </Button>
          }
        />
        <PopoverContent className="w-56 p-1" align="start">
          {(tags ?? []).length === 0 ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">
              Nenhuma tag neste setor.
            </p>
          ) : (
            <div className="max-h-64 overflow-auto">
              {(tags ?? []).map((tag) => {
                const isSelected = selected.has(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    disabled={saving}
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="flex-1 text-left">{tag.name}</span>
                    {isSelected && <Check className="h-3.5 w-3.5" />}
                  </button>
                );
              })}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
