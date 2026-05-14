"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export async function updateNotificationPreferences(
  type: string,
  channel: string
) {
  const schema = z.object({
    type: z.enum(["card_assigned", "card_comment", "card_escalated", "card_due_soon", "card_overdue"]),
    channel: z.enum(["in_app", "email", "both", "none"]),
  });
  const parsed = schema.safeParse({ type, channel });
  if (!parsed.success) return { error: "Dados invalidos" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { error } = await supabase
    .from("notification_preferences")
    .upsert(
      {
        user_id: user.id,
        type: parsed.data.type,
        channel: parsed.data.channel,
      },
      { onConflict: "user_id,type" }
    );

  if (error) return { error: error.message };

  revalidatePath("/settings");
  return { success: true };
}

export async function inviteUser(
  emailAddress: string,
  sectorId: string,
  roleId: string
) {
  const schema = z.object({
    email: z.string().email(),
    sectorId: z.string().uuid(),
    roleId: z.string().uuid(),
  });
  const parsed = schema.safeParse({ email: emailAddress, sectorId, roleId });
  if (!parsed.success) return { error: "Dados invalidos" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, parsed.data.sectorId, "settings", "manage")) {
    return { error: "Sem permissao" };
  }

  const { data: existing } = await supabase
    .from("invites")
    .select("id")
    .eq("email", parsed.data.email)
    .eq("sector_id", parsed.data.sectorId)
    .eq("status", "pending")
    .maybeSingle();

  if (existing) {
    return { error: "Ja existe um convite pendente para este email neste setor" };
  }

  const { data: invite, error } = await supabase
    .from("invites")
    .insert({
      email: parsed.data.email,
      sector_id: parsed.data.sectorId,
      role_id: parsed.data.roleId,
      invited_by: user.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/settings/admin");
  return { data: invite };
}
