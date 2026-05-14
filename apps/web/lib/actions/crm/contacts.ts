"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import { createContactSchema } from "@/lib/validations/crm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export async function createContact(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = createContactSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, parsed.data.sectorId, "contact", "create")) {
    return { error: "Sem permissao" };
  }

  const { data: contact, error } = await supabase
    .from("crm_contacts")
    .insert({
      sector_id: parsed.data.sectorId,
      company_id: parsed.data.companyId || null,
      full_name: parsed.data.fullName,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      position: parsed.data.position || null,
      is_primary: parsed.data.isPrimary,
      owner_id: parsed.data.ownerId || user.id,
      notes: parsed.data.notes || null,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/");
  return { data: contact };
}

export async function updateContact(formData: unknown) {
  const schema = createContactSchema.extend({
    id: z.string().uuid(),
  });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = schema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { data: existing } = await supabase
    .from("crm_contacts")
    .select("sector_id")
    .eq("id", parsed.data.id)
    .single();

  if (!existing) return { error: "Contato nao encontrado" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, existing.sector_id, "contact", "update")) {
    return { error: "Sem permissao" };
  }

  const { error } = await supabase
    .from("crm_contacts")
    .update({
      company_id: parsed.data.companyId || null,
      full_name: parsed.data.fullName,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      position: parsed.data.position || null,
      is_primary: parsed.data.isPrimary,
      owner_id: parsed.data.ownerId || null,
      notes: parsed.data.notes || null,
    })
    .eq("id", parsed.data.id);

  if (error) return { error: error.message };

  revalidatePath("/");
  return { success: true };
}

export async function deleteContact(contactId: string) {
  const parsed = z.string().uuid().safeParse(contactId);
  if (!parsed.success) return { error: "ID invalido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { data: contact } = await supabase
    .from("crm_contacts")
    .select("sector_id")
    .eq("id", contactId)
    .single();

  if (!contact) return { error: "Contato nao encontrado" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, contact.sector_id, "contact", "delete")) {
    return { error: "Sem permissao" };
  }

  const { error } = await supabase
    .from("crm_contacts")
    .update({ is_active: false })
    .eq("id", contactId);

  if (error) return { error: error.message };

  revalidatePath("/");
  return { success: true };
}
