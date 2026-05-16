"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import {
  createCampaignSchema,
  updateCampaignSchema,
} from "@/lib/validations/marketing";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export async function createCampaign(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const parsed = createCampaignSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, parsed.data.sectorId, "campaign", "create")) {
    return { error: "Sem permissao" };
  }

  const { data, error } = await supabase
    .from("marketing_campaigns")
    .insert({
      sector_id: parsed.data.sectorId,
      name: parsed.data.name,
      description: parsed.data.description || null,
      channel: parsed.data.channel,
      status: parsed.data.status,
      budget_cents: parsed.data.budgetCents,
      spend_cents: parsed.data.spendCents,
      impressions: parsed.data.impressions,
      leads: parsed.data.leads,
      conversions: parsed.data.conversions,
      start_date: parsed.data.startDate,
      end_date: parsed.data.endDate || null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/marketing");
  return { data };
}

export async function updateCampaign(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const parsed = updateCampaignSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { data: existing } = await supabase
    .from("marketing_campaigns")
    .select("sector_id")
    .eq("id", parsed.data.id)
    .single();
  if (!existing) return { error: "Campanha não encontrada" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, existing.sector_id, "campaign", "update")) {
    return { error: "Sem permissao" };
  }

  const { error } = await supabase
    .from("marketing_campaigns")
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
      channel: parsed.data.channel,
      status: parsed.data.status,
      budget_cents: parsed.data.budgetCents,
      spend_cents: parsed.data.spendCents,
      impressions: parsed.data.impressions,
      leads: parsed.data.leads,
      conversions: parsed.data.conversions,
      start_date: parsed.data.startDate,
      end_date: parsed.data.endDate || null,
    })
    .eq("id", parsed.data.id);

  if (error) return { error: error.message };

  revalidatePath("/marketing");
  return { success: true };
}

export async function deleteCampaign(campaignId: string) {
  const parsed = z.string().uuid().safeParse(campaignId);
  if (!parsed.success) return { error: "ID inválido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const { data: campaign } = await supabase
    .from("marketing_campaigns")
    .select("sector_id")
    .eq("id", campaignId)
    .single();
  if (!campaign) return { error: "Campanha não encontrada" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, campaign.sector_id, "campaign", "delete")) {
    return { error: "Sem permissao" };
  }

  const { error } = await supabase
    .from("marketing_campaigns")
    .update({ is_active: false })
    .eq("id", campaignId);

  if (error) return { error: error.message };

  revalidatePath("/marketing");
  return { success: true };
}
