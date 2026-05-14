"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import { createActivitySchema } from "@/lib/validations/crm";
import { revalidatePath } from "next/cache";

export async function createActivity(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = createActivitySchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, parsed.data.sectorId, "crm_activity", "create")) {
    return { error: "Sem permissao" };
  }

  const { data: activity, error } = await supabase
    .from("crm_activities")
    .insert({
      sector_id: parsed.data.sectorId,
      deal_id: parsed.data.dealId || null,
      contact_id: parsed.data.contactId || null,
      company_id: parsed.data.companyId || null,
      type: parsed.data.type,
      subject: parsed.data.subject,
      description: parsed.data.description || null,
      scheduled_at: parsed.data.scheduledAt || null,
      duration_min: parsed.data.durationMin || null,
      performed_by: user.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/");
  return { data: activity };
}
