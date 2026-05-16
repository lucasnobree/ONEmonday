"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import {
  createSegmentSchema,
  updateSegmentSchema,
} from "@/lib/validations/marketing";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export async function createSegment(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const parsed = createSegmentSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, parsed.data.sectorId, "audience_segment", "create")) {
    return { error: "Sem permissao" };
  }

  const { data, error } = await supabase
    .from("marketing_audience_segments")
    .insert({
      sector_id: parsed.data.sectorId,
      name: parsed.data.name,
      description: parsed.data.description || null,
      channel: parsed.data.channel,
      estimated_size: parsed.data.estimatedSize,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/marketing");
  return { data };
}

export async function updateSegment(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const parsed = updateSegmentSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { data: existing } = await supabase
    .from("marketing_audience_segments")
    .select("sector_id")
    .eq("id", parsed.data.id)
    .single();
  if (!existing) return { error: "Audiência não encontrada" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, existing.sector_id, "audience_segment", "update")) {
    return { error: "Sem permissao" };
  }

  const { error } = await supabase
    .from("marketing_audience_segments")
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
      channel: parsed.data.channel,
      estimated_size: parsed.data.estimatedSize,
    })
    .eq("id", parsed.data.id);

  if (error) return { error: error.message };

  revalidatePath("/marketing");
  return { success: true };
}

export async function deleteSegment(segmentId: string) {
  const parsed = z.string().uuid().safeParse(segmentId);
  if (!parsed.success) return { error: "ID inválido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const { data: segment } = await supabase
    .from("marketing_audience_segments")
    .select("sector_id")
    .eq("id", segmentId)
    .single();
  if (!segment) return { error: "Audiência não encontrada" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, segment.sector_id, "audience_segment", "delete")) {
    return { error: "Sem permissao" };
  }

  const { error } = await supabase
    .from("marketing_audience_segments")
    .update({ is_active: false })
    .eq("id", segmentId);

  if (error) return { error: error.message };

  revalidatePath("/marketing");
  return { success: true };
}
