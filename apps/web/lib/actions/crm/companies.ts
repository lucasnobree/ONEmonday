"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import { createCompanySchema } from "@/lib/validations/crm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export async function createCompany(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = createCompanySchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, parsed.data.sectorId, "company", "create")) {
    return { error: "Sem permissao" };
  }

  const { data: company, error } = await supabase
    .from("crm_companies")
    .insert({
      sector_id: parsed.data.sectorId,
      name: parsed.data.name,
      domain: parsed.data.domain || null,
      industry: parsed.data.industry || null,
      size: parsed.data.size || null,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      address: parsed.data.address || null,
      city: parsed.data.city || null,
      state: parsed.data.state || null,
      notes: parsed.data.notes || null,
      owner_id: parsed.data.ownerId || user.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/");
  return { data: company };
}

export async function updateCompany(formData: unknown) {
  const schema = createCompanySchema.extend({
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
    .from("crm_companies")
    .select("sector_id")
    .eq("id", parsed.data.id)
    .single();

  if (!existing) return { error: "Empresa nao encontrada" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, existing.sector_id, "company", "update")) {
    return { error: "Sem permissao" };
  }

  const { error } = await supabase
    .from("crm_companies")
    .update({
      name: parsed.data.name,
      domain: parsed.data.domain || null,
      industry: parsed.data.industry || null,
      size: parsed.data.size || null,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      address: parsed.data.address || null,
      city: parsed.data.city || null,
      state: parsed.data.state || null,
      notes: parsed.data.notes || null,
      owner_id: parsed.data.ownerId || null,
    })
    .eq("id", parsed.data.id);

  if (error) return { error: error.message };

  revalidatePath("/");
  return { success: true };
}

export async function deleteCompany(companyId: string) {
  const parsed = z.string().uuid().safeParse(companyId);
  if (!parsed.success) return { error: "ID invalido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { data: company } = await supabase
    .from("crm_companies")
    .select("sector_id")
    .eq("id", companyId)
    .single();

  if (!company) return { error: "Empresa nao encontrada" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, company.sector_id, "company", "delete")) {
    return { error: "Sem permissao" };
  }

  const { error } = await supabase
    .from("crm_companies")
    .update({ is_active: false })
    .eq("id", companyId);

  if (error) return { error: error.message };

  revalidatePath("/");
  return { success: true };
}
