"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { emitFiscalDocument } from "@/lib/actions/finance/fiscal";

export type FiscalDocStatus =
  | "draft"
  | "processing"
  | "authorized"
  | "rejected"
  | "cancelled"
  | "error";

export interface FiscalDocument {
  id: string;
  sector_id: string;
  invoice_id: string;
  doc_type: "nfe" | "nfse";
  provider: string;
  status: FiscalDocStatus;
  provider_ref: string | null;
  protocol: string | null;
  access_key: string | null;
  pdf_url: string | null;
  xml_url: string | null;
  status_reason: string | null;
  created_at: string;
}

/** All fiscal documents for a sector, newest first. */
export function useFiscalDocuments(sectorId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["finance-fiscal-documents", sectorId],
    queryFn: async () => {
      if (!sectorId) return [];
      const { data, error } = await supabase
        .from("finance_fiscal_documents")
        .select(
          `id, sector_id, invoice_id, doc_type, provider, status, provider_ref,
           protocol, access_key, pdf_url, xml_url, status_reason, created_at`
        )
        .eq("sector_id", sectorId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as FiscalDocument[];
    },
    enabled: !!sectorId,
  });
}

export function useEmitFiscalDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => emitFiscalDocument(input),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["finance-fiscal-documents"],
      });
    },
  });
}
