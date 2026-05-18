"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { deleteTicketAttachment } from "@/lib/actions/support/attachments";

export interface TicketAttachment {
  id: string;
  ticket_id: string;
  file_path: string;
  file_name: string;
  file_size: number;
  mime_type: string | null;
  uploaded_by: string;
  created_at: string;
  users: { full_name: string } | null;
}

// Attachments linked to a single ticket.
export function useTicketAttachments(ticketId: string | null | undefined) {
  return useQuery<TicketAttachment[]>({
    queryKey: ["ticket-attachments", ticketId],
    queryFn: async () => {
      if (!ticketId) return [];
      const supabase = createClient();
      const { data } = await supabase
        .from("support_ticket_attachments")
        .select(
          "id, ticket_id, file_path, file_name, file_size, mime_type, uploaded_by, created_at, users(full_name)"
        )
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: false });
      return (data || []) as unknown as TicketAttachment[];
    },
    enabled: !!ticketId,
  });
}

export function useDeleteTicketAttachment(
  ticketId: string | null | undefined
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTicketAttachment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["ticket-attachments", ticketId],
      });
    },
  });
}
