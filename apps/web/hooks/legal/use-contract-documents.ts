"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

/** A document file attached to a contract. */
export interface ContractDocument {
  id: string;
  contract_id: string;
  sector_id: string;
  file_path: string;
  file_name: string;
  file_size: number;
  mime_type: string | null;
  doc_label: string | null;
  uploaded_by: string;
  created_at: string;
}

/** Lists the documents attached to a contract, newest first. */
export function useContractDocuments(contractId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["legal-contract-documents", contractId],
    queryFn: async () => {
      if (!contractId) return [];

      const { data, error } = await supabase
        .from("legal_contract_documents")
        .select("*")
        .eq("contract_id", contractId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data as ContractDocument[]) ?? [];
    },
    enabled: !!contractId,
  });
}
