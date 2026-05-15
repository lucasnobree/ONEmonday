"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  createTicketTag,
  deleteTicketTag,
  addTagToTicket,
  removeTagFromTicket,
} from "@/lib/actions/support/tags";

export type TagColor =
  | "gray"
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "blue"
  | "purple";

export interface TicketTag {
  id: string;
  sector_id: string;
  name: string;
  color: TagColor;
}

export const TAG_COLOR_CLASSES: Record<TagColor, string> = {
  gray: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  red: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  orange:
    "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  yellow:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  green: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  purple:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
};

// All tags available in a sector's vocabulary.
export function useSectorTags(sectorId: string | undefined) {
  return useQuery<TicketTag[]>({
    queryKey: ["ticket-tags", sectorId],
    queryFn: async () => {
      if (!sectorId) return [];
      const supabase = createClient();
      const { data } = await supabase
        .from("ticket_tags")
        .select("id, sector_id, name, color")
        .eq("sector_id", sectorId)
        .order("name", { ascending: true });
      return (data || []) as TicketTag[];
    },
    enabled: !!sectorId,
  });
}

interface TicketTagLinkRow {
  ticket_id: string;
  ticket_tags: TicketTag | null;
}

// Map of ticket_id -> tags for every ticket in a sector. Used by the
// ticket list to render tag chips without an N+1 query.
export function useSectorTicketTags(sectorId: string | undefined) {
  return useQuery<Map<string, TicketTag[]>>({
    queryKey: ["sector-ticket-tags", sectorId],
    queryFn: async () => {
      const map = new Map<string, TicketTag[]>();
      if (!sectorId) return map;
      const supabase = createClient();
      const { data } = await supabase
        .from("support_ticket_tags")
        .select(
          "ticket_id, ticket_tags(id, sector_id, name, color)"
        )
        .eq("ticket_tags.sector_id", sectorId);

      const rows = (data || []) as unknown as TicketTagLinkRow[];
      for (const row of rows) {
        if (!row.ticket_tags) continue;
        const list = map.get(row.ticket_id) ?? [];
        list.push(row.ticket_tags);
        map.set(row.ticket_id, list);
      }
      return map;
    },
    enabled: !!sectorId,
  });
}

// Tags linked to a single ticket.
export function useTicketTags(ticketId: string | null | undefined) {
  return useQuery<TicketTag[]>({
    queryKey: ["ticket-tags-for", ticketId],
    queryFn: async () => {
      if (!ticketId) return [];
      const supabase = createClient();
      const { data } = await supabase
        .from("support_ticket_tags")
        .select("ticket_tags(id, sector_id, name, color)")
        .eq("ticket_id", ticketId);

      const rows = (data || []) as unknown as {
        ticket_tags: TicketTag | null;
      }[];
      return rows
        .map((r) => r.ticket_tags)
        .filter((t): t is TicketTag => t !== null);
    },
    enabled: !!ticketId,
  });
}

function useTagInvalidation() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["ticket-tags"] });
    queryClient.invalidateQueries({ queryKey: ["ticket-tags-for"] });
    queryClient.invalidateQueries({ queryKey: ["sector-ticket-tags"] });
  };
}

export function useCreateTicketTag() {
  const invalidate = useTagInvalidation();
  return useMutation({
    mutationFn: (input: unknown) => createTicketTag(input),
    onSuccess: invalidate,
  });
}

export function useDeleteTicketTag() {
  const invalidate = useTagInvalidation();
  return useMutation({
    mutationFn: (id: string) => deleteTicketTag(id),
    onSuccess: invalidate,
  });
}

export function useAddTagToTicket() {
  const invalidate = useTagInvalidation();
  return useMutation({
    mutationFn: (input: { ticketId: string; tagId: string }) =>
      addTagToTicket(input),
    onSuccess: invalidate,
  });
}

export function useRemoveTagFromTicket() {
  const invalidate = useTagInvalidation();
  return useMutation({
    mutationFn: (input: { ticketId: string; tagId: string }) =>
      removeTagFromTicket(input),
    onSuccess: invalidate,
  });
}
