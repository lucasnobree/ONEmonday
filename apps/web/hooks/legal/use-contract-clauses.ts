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

/**
 * Counts how many contracts each library clause is linked to, sector-wide.
 * Returns a `Map<clauseId, contractCount>` so the clause library can show a
 * "usada em N contratos" signal — `legal_contract_clauses` is one row per
 * (contract, clause) link, so a plain tally is correct.
 */
export function useClauseUsage(sectorId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["legal-clause-usage", sectorId],
    queryFn: async () => {
      const usage = new Map<string, number>();
      if (!sectorId) return usage;

      const { data, error } = await supabase
        .from("legal_contract_clauses")
        .select("clause_id")
        .eq("sector_id", sectorId);

      if (error) throw error;
      for (const row of (data as { clause_id: string }[]) ?? []) {
        usage.set(row.clause_id, (usage.get(row.clause_id) ?? 0) + 1);
      }
      return usage;
    },
    enabled: !!sectorId,
  });
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
