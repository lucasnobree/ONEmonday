"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import { revalidatePath } from "next/cache";

export async function updateNotificationPreferences(
  type: string,
  inApp: boolean,
  email: boolean
) {
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
        type,
        in_app: inApp,
        email,
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, sectorId, "settings", "manage")) {
    return { error: "Sem permissao" };
  }

  const { data: existing } = await supabase
    .from("invites")
    .select("id")
    .eq("email", emailAddress)
    .eq("sector_id", sectorId)
    .eq("status", "pending")
    .maybeSingle();

  if (existing) {
    return { error: "Ja existe um convite pendente para este email neste setor" };
  }

  const { data: invite, error } = await supabase
    .from("invites")
    .insert({
      email: emailAddress,
      sector_id: sectorId,
      role_id: roleId,
      invited_by: user.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/settings/admin");
  return { data: invite };
}
