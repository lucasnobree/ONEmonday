"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

/** A clause linked to a contract, joined with the library clause. */
export interface ContractClauseLink {
  id: string;
  contract_id: string;
  clause_id: string;
  sector_id: string;
  created_at: string;
  clause: {
    id: string;
    title: string;
    category: string;
    body: string;
    is_approved: boolean;
  } | null;
}

/** Lists the library clauses linked to a contract. */
export function useContractClauses(contractId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["legal-contract-clauses", contractId],
    queryFn: async () => {
      if (!contractId) return [];

      const { data, error } = await supabase
        .from("legal_contract_clauses")
        .select(
          "id, contract_id, clause_id, sector_id, created_at, " +
            "clause:legal_clauses(id, title, category, body, is_approved)"
        )
        .eq("contract_id", contractId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data as unknown as ContractClauseLink[]) ?? [];
    },
    enabled: !!contractId,
  });
}
