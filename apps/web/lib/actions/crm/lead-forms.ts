"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import { leadFormSchema } from "@/lib/validations/crm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/**
 * Lead-capture form server actions.
 *
 * A capture form is a sector-defined field list (migration 00128). Each form
 * carries an unguessable `public_token` that addresses its single public,
 * unauthenticated submission URL — public submission itself lives in
 * `app/api/forms/[id]/route.ts`, not here.
 *
 * Standard write path: createClient → auth.getUser → Zod safeParse →
 * permission check → DB write → revalidatePath.
 */

export async function createLeadForm(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = leadFormSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, parsed.data.sectorId, "lead_form", "create")) {
    return { error: "Sem permissao" };
  }

  const { data: form, error } = await supabase
    .from("crm_lead_forms")
    .insert({
      sector_id: parsed.data.sectorId,
      name: parsed.data.name,
      description: parsed.data.description || null,
      source: parsed.data.source,
      success_message: parsed.data.successMessage,
      is_published: parsed.data.isPublished,
      fields: parsed.data.fields,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/crm/forms");
  return { data: form };
}

export async function updateLeadForm(formData: unknown) {
  const schema = leadFormSchema.extend({ id: z.string().uuid() });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = schema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { data: existing } = await supabase
    .from("crm_lead_forms")
    .select("sector_id")
    .eq("id", parsed.data.id)
    .single();

  if (!existing) return { error: "Formulario nao encontrado" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, existing.sector_id, "lead_form", "update")) {
    return { error: "Sem permissao" };
  }

  const { error } = await supabase
    .from("crm_lead_forms")
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
      source: parsed.data.source,
      success_message: parsed.data.successMessage,
      is_published: parsed.data.isPublished,
      fields: parsed.data.fields,
    })
    .eq("id", parsed.data.id);

  if (error) return { error: error.message };

  revalidatePath("/crm/forms");
  return { success: true };
}

/**
 * Toggle a form's published state. A form only accepts public submissions
 * while `is_published` is true (enforced by both this action and the anon
 * RLS policy in migration 00128).
 */
export async function setLeadFormPublished(input: unknown) {
  const parsed = z
    .object({ id: z.string().uuid(), published: z.boolean() })
    .safeParse(input);
  if (!parsed.success) return { error: "Dados invalidos" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { data: existing } = await supabase
    .from("crm_lead_forms")
    .select("sector_id")
    .eq("id", parsed.data.id)
    .single();

  if (!existing) return { error: "Formulario nao encontrado" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, existing.sector_id, "lead_form", "update")) {
    return { error: "Sem permissao" };
  }

  const { error } = await supabase
    .from("crm_lead_forms")
    .update({ is_published: parsed.data.published })
    .eq("id", parsed.data.id);

  if (error) return { error: error.message };

  revalidatePath("/crm/forms");
  return { success: true };
}

export async function deleteLeadForm(formId: string) {
  const parsed = z.string().uuid().safeParse(formId);
  if (!parsed.success) return { error: "ID invalido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { data: form } = await supabase
    .from("crm_lead_forms")
    .select("sector_id")
    .eq("id", formId)
    .single();

  if (!form) return { error: "Formulario nao encontrado" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, form.sector_id, "lead_form", "delete")) {
    return { error: "Sem permissao" };
  }

  // Soft delete + unpublish so the public URL stops accepting submissions.
  const { error } = await supabase
    .from("crm_lead_forms")
    .update({ is_active: false, is_published: false })
    .eq("id", formId);

  if (error) return { error: error.message };

  revalidatePath("/crm/forms");
  return { success: true };
}
