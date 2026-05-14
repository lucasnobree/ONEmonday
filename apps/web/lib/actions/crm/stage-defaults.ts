"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const stageDefaultSchema = z.object({
  stage_name: z.string().min(1),
  default_probability: z.number().int().min(0).max(100),
  position: z.number().int().min(0),
});

export async function updateStageDefaults(
  sectorId: string,
  stages: { stage_name: string; default_probability: number; position: number }[]
) {
  const sectorParsed = z.string().uuid().safeParse(sectorId);
  if (!sectorParsed.success) return { error: "Sector ID invalido" };

  const stagesParsed = z.array(stageDefaultSchema).safeParse(stages);
  if (!stagesParsed.success) return { error: "Dados de estagios invalidos" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, sectorId, "deal", "update")) {
    return { error: "Sem permissao" };
  }

  // Delete existing defaults for sector
  await supabase
    .from("crm_pipeline_stage_defaults")
    .delete()
    .eq("sector_id", sectorId);

  // Insert new defaults
  if (stagesParsed.data.length > 0) {
    const { error } = await supabase
      .from("crm_pipeline_stage_defaults")
      .insert(
        stagesParsed.data.map((s) => ({
          sector_id: sectorId,
          stage_name: s.stage_name,
          default_probability: s.default_probability,
          position: s.position,
        }))
      );

    if (error) return { error: error.message };
  }

  revalidatePath("/crm/pipeline");
  return { success: true };
}

export async function toggleProbabilityLock(dealId: string, locked: boolean) {
  const idParsed = z.string().uuid().safeParse(dealId);
  if (!idParsed.success) return { error: "ID invalido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { data: deal } = await supabase
    .from("crm_deals")
    .select("sector_id")
    .eq("id", dealId)
    .single();

  if (!deal) return { error: "Deal nao encontrado" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, deal.sector_id, "deal", "update")) {
    return { error: "Sem permissao" };
  }

  const { error } = await supabase
    .from("crm_deals")
    .update({ probability_locked: locked })
    .eq("id", dealId);

  if (error) return { error: error.message };

  revalidatePath("/crm/pipeline");
  return { success: true };
}
