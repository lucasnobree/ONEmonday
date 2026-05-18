"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import {
  upsertRouteSchema,
  deleteRouteSchema,
} from "@/lib/validations/integrations";
import { revalidatePath } from "next/cache";

/**
 * Event-to-channel routing server actions.
 *
 * `notification_channel_routes` maps a notification `event_type` to the
 * outbound channel(s) it should also dispatch to. The Settings UI edits these
 * rows; the dispatch layer reads them to fan an in-app notification out.
 */

/** Authorises the caller for a route write in `sectorId`. */
async function authorize(sectorId: string | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" as const };

  const perms = await getUserPermissions(user.id);
  if (sectorId === null) {
    if (!perms.isGlobalAdmin) return { error: "Sem permissao" as const };
  } else if (!hasPermission(perms, sectorId, "integration", "manage")) {
    return { error: "Sem permissao" as const };
  }
  return { supabase, userId: user.id };
}

/** Creates or toggles an event-to-channel routing rule. */
export async function upsertChannelRoute(formData: unknown) {
  const parsed = upsertRouteSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const auth = await authorize(parsed.data.sectorId);
  if ("error" in auth) return { error: auth.error };
  const { supabase, userId } = auth;

  const existingQuery = supabase
    .from("notification_channel_routes")
    .select("id")
    .eq("event_type", parsed.data.eventType)
    .eq("channel", parsed.data.channel);
  if (parsed.data.sectorId === null) {
    existingQuery.is("sector_id", null);
  } else {
    existingQuery.eq("sector_id", parsed.data.sectorId);
  }
  const { data: existing } = await existingQuery.maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("notification_channel_routes")
      .update({ is_enabled: parsed.data.isEnabled })
      .eq("id", existing.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("notification_channel_routes")
      .insert({
        sector_id: parsed.data.sectorId,
        event_type: parsed.data.eventType,
        channel: parsed.data.channel,
        is_enabled: parsed.data.isEnabled,
        created_by: userId,
      });
    if (error) return { error: error.message };
  }

  revalidatePath("/settings/integrations");
  return { success: true };
}

/** Deletes an event-to-channel routing rule. */
export async function deleteChannelRoute(formData: unknown) {
  const parsed = deleteRouteSchema.safeParse(formData);
  if (!parsed.success) return { error: "ID invalido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { data: row } = await supabase
    .from("notification_channel_routes")
    .select("sector_id")
    .eq("id", parsed.data.id)
    .single();
  if (!row) return { error: "Regra nao encontrada" };

  const perms = await getUserPermissions(user.id);
  if (row.sector_id === null) {
    if (!perms.isGlobalAdmin) return { error: "Sem permissao" };
  } else if (!hasPermission(perms, row.sector_id, "integration", "manage")) {
    return { error: "Sem permissao" };
  }

  const { error } = await supabase
    .from("notification_channel_routes")
    .delete()
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };

  revalidatePath("/settings/integrations");
  return { success: true };
}
