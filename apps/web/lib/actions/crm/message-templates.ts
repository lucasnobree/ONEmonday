"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import { messageTemplateSchema } from "@/lib/validations/crm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/**
 * CRM message-template server actions — reusable WhatsApp / email snippets
 * (migration 00185) used by the deal Communication panel.
 *
 * Standard write path: createClient → auth.getUser → Zod safeParse →
 * permission check → DB write → revalidatePath.
 *
 * An email template carries a subject; a WhatsApp one must not — the action
 * normalises `subject` to NULL for WhatsApp so the DB CHECK is satisfied.
 */

export async function createMessageTemplate(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = messageTemplateSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const perms = await getUserPermissions(user.id);
  if (
    !hasPermission(perms, parsed.data.sectorId, "message_template", "create")
  ) {
    return { error: "Sem permissao" };
  }

  const { data, error } = await supabase
    .from("crm_message_templates")
    .insert({
      sector_id: parsed.data.sectorId,
      channel: parsed.data.channel,
      name: parsed.data.name,
      // A WhatsApp template never carries a subject.
      subject:
        parsed.data.channel === "email"
          ? parsed.data.subject || ""
          : null,
      body: parsed.data.body,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/crm");
  return { data };
}

export async function updateMessageTemplate(id: string, formData: unknown) {
  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) return { error: "ID invalido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = messageTemplateSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { data: existing } = await supabase
    .from("crm_message_templates")
    .select("sector_id")
    .eq("id", id)
    .single();

  if (!existing) return { error: "Template nao encontrado" };

  const perms = await getUserPermissions(user.id);
  if (
    !hasPermission(perms, existing.sector_id, "message_template", "update")
  ) {
    return { error: "Sem permissao" };
  }

  const { error } = await supabase
    .from("crm_message_templates")
    .update({
      channel: parsed.data.channel,
      name: parsed.data.name,
      subject:
        parsed.data.channel === "email"
          ? parsed.data.subject || ""
          : null,
      body: parsed.data.body,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/crm");
  return { success: true };
}

export async function deleteMessageTemplate(id: string) {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { error: "ID invalido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { data: existing } = await supabase
    .from("crm_message_templates")
    .select("sector_id")
    .eq("id", id)
    .single();

  if (!existing) return { error: "Template nao encontrado" };

  const perms = await getUserPermissions(user.id);
  if (
    !hasPermission(perms, existing.sector_id, "message_template", "delete")
  ) {
    return { error: "Sem permissao" };
  }

  // Soft delete so historical references stay intact.
  const { error } = await supabase
    .from("crm_message_templates")
    .update({ is_active: false })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/crm");
  return { success: true };
}
