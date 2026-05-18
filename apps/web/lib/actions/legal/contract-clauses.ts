"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import { linkClauseSchema } from "@/lib/validations/legal";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/**
 * Links a library clause to a contract. Both records must belong to the same
 * sector, and the caller needs `contract:update` — attaching a clause is a
 * change to the contract's composition.
 */
export async function linkClauseToContract(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const parsed = linkClauseSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { data: contract } = await supabase
    .from("legal_contracts")
    .select("sector_id")
    .eq("id", parsed.data.contractId)
    .single();
  if (!contract) return { error: "Contrato não encontrado" };

  const { data: clause } = await supabase
    .from("legal_clauses")
    .select("sector_id")
    .eq("id", parsed.data.clauseId)
    .single();
  if (!clause) return { error: "Cláusula não encontrada" };

  if (clause.sector_id !== contract.sector_id) {
    return { error: "Cláusula e contrato pertencem a setores diferentes" };
  }

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, contract.sector_id, "contract", "update")) {
    return { error: "Sem permissão" };
  }

  const { error } = await supabase.from("legal_contract_clauses").insert({
    contract_id: parsed.data.contractId,
    clause_id: parsed.data.clauseId,
    sector_id: contract.sector_id,
    added_by: user.id,
  });

  if (error) {
    // Unique violation — the clause is already linked.
    if (error.code === "23505") {
      return { error: "Cláusula já vinculada a este contrato" };
    }
    return { error: error.message };
  }

  revalidatePath("/legal/contracts");
  return { success: true };
}

/** Removes a clause link from a contract. */
export async function unlinkClauseFromContract(linkId: string) {
  const idParsed = z.string().uuid().safeParse(linkId);
  if (!idParsed.success) return { error: "ID inválido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const { data: link } = await supabase
    .from("legal_contract_clauses")
    .select("sector_id")
    .eq("id", idParsed.data)
    .single();
  if (!link) return { error: "Vínculo não encontrado" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, link.sector_id, "contract", "update")) {
    return { error: "Sem permissão" };
  }

  const { error } = await supabase
    .from("legal_contract_clauses")
    .delete()
    .eq("id", idParsed.data);
  if (error) return { error: error.message };

  revalidatePath("/legal/contracts");
  return { success: true };
}
