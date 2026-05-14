"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export async function updateProfile(formData: FormData) {
  const schema = z.object({
    full_name: z.string().min(1, "Nome obrigatorio"),
    avatar_url: z.string().url("URL invalida").or(z.literal("")),
  });

  const parsed = schema.safeParse({
    full_name: formData.get("full_name"),
    avatar_url: formData.get("avatar_url"),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { error } = await supabase
    .from("users")
    .update({
      full_name: parsed.data.full_name,
      avatar_url: parsed.data.avatar_url || null,
    })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/settings/profile");
  return { success: true };
}

export async function changePassword(formData: FormData) {
  const schema = z.object({
    password: z.string().min(8, "A senha deve ter no minimo 8 caracteres"),
  });

  const parsed = schema.safeParse({
    password: formData.get("password"),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) return { error: error.message };

  revalidatePath("/settings/profile");
  return { success: true };
}
