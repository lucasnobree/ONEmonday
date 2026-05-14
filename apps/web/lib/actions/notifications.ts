"use server";

import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

export async function markNotificationRead(notificationId: string) {
  try {
    z.string().uuid().parse(notificationId);
  } catch {
    return { error: "Dados invalidos" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  return { success: true };
}

export async function markAllNotificationsRead() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", user.id)
    .eq("is_read", false);

  if (error) return { error: error.message };
  return { success: true };
}

export async function getUnreadCount() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado", count: 0 };

  const { count, error } = await supabase
    .from("notifications")
    .select("id, title, content, type, resource_type, resource_id, is_read, created_at", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_read", false);

  if (error) return { error: error.message, count: 0 };
  return { count: count ?? 0 };
}
