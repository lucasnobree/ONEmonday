"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import {
  createOffboardingTemplateSchema,
  startOffboardingSchema,
} from "@/lib/validations/hr";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/** Serialised shape of one offboarding template step (stored as jsonb). */
interface OffboardingTemplateItem {
  title: string;
  description?: string | null;
  responsible_role?: string | null;
  due_days_offset?: number;
}

function serializeItems(
  items: {
    title: string;
    description?: string;
    responsibleRole?: string;
    dueDaysOffset?: number;
  }[]
): OffboardingTemplateItem[] {
  return items.map((item) => ({
    title: item.title,
    description: item.description || null,
    responsible_role: item.responsibleRole || null,
    due_days_offset: item.dueDaysOffset ?? 0,
  }));
}

export async function createOffboardingTemplate(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = createOffboardingTemplateSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, parsed.data.sectorId, "employee", "create")) {
    return { error: "Sem permissao" };
  }

  const { data: template, error } = await supabase
    .from("hr_offboarding_templates")
    .insert({
      sector_id: parsed.data.sectorId,
      name: parsed.data.name,
      description: parsed.data.description || null,
      items: JSON.stringify(serializeItems(parsed.data.items)),
    })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/hr/offboarding");
  return { data: template };
}

export async function updateOffboardingTemplate(id: string, formData: unknown) {
  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) return { error: "ID invalido" };

  const parsed = createOffboardingTemplateSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, parsed.data.sectorId, "employee", "update")) {
    return { error: "Sem permissao" };
  }

  const { error } = await supabase
    .from("hr_offboarding_templates")
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
      items: JSON.stringify(serializeItems(parsed.data.items)),
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/hr/offboarding");
  return { success: true };
}

export async function deleteOffboardingTemplate(id: string) {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { error: "ID invalido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { data: template } = await supabase
    .from("hr_offboarding_templates")
    .select("sector_id")
    .eq("id", id)
    .single();

  if (!template) return { error: "Template nao encontrado" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, template.sector_id, "employee", "update")) {
    return { error: "Sem permissao" };
  }

  const { error } = await supabase
    .from("hr_offboarding_templates")
    .update({ is_active: false })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/hr/offboarding");
  return { success: true };
}

export async function startOffboarding(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = startOffboardingSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { data: template } = await supabase
    .from("hr_offboarding_templates")
    .select("id, items")
    .eq("id", parsed.data.templateId)
    .single();

  if (!template) return { error: "Template nao encontrado" };

  const { data: employee } = await supabase
    .from("hr_employees")
    .select("id, sector_id")
    .eq("id", parsed.data.employeeId)
    .single();

  if (!employee) return { error: "Colaborador nao encontrado" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, employee.sector_id, "employee", "update")) {
    return { error: "Sem permissao" };
  }

  const { data: instance, error: instanceError } = await supabase
    .from("hr_offboarding_instances")
    .insert({
      employee_id: parsed.data.employeeId,
      template_id: parsed.data.templateId,
      sector_id: employee.sector_id,
      termination_date: parsed.data.terminationDate,
      reason: parsed.data.reason || null,
      status: "in_progress",
      created_by: user.id,
    })
    .select()
    .single();

  if (instanceError) return { error: instanceError.message };

  const templateItems: OffboardingTemplateItem[] = Array.isArray(template.items)
    ? (template.items as OffboardingTemplateItem[])
    : typeof template.items === "string"
    ? (JSON.parse(template.items) as OffboardingTemplateItem[])
    : [];

  if (templateItems.length > 0) {
    const termination = new Date(parsed.data.terminationDate);
    const items = templateItems.map((item, index) => {
      const dueDate = new Date(termination);
      dueDate.setDate(dueDate.getDate() + (item.due_days_offset ?? 0));
      return {
        offboarding_id: instance.id,
        title: item.title,
        description: item.description || null,
        responsible_role: item.responsible_role || null,
        due_date: dueDate.toISOString().split("T")[0],
        is_completed: false,
        position: index,
      };
    });

    const { error: itemsError } = await supabase
      .from("hr_offboarding_items")
      .insert(items);

    if (itemsError) return { error: itemsError.message };
  }

  revalidatePath("/hr/offboarding");
  return { data: instance };
}

export async function toggleOffboardingItem(
  itemId: string,
  completed: boolean
) {
  const idParsed = z.string().uuid().safeParse(itemId);
  if (!idParsed.success) return { error: "ID invalido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { data: item } = await supabase
    .from("hr_offboarding_items")
    .select("offboarding_id, hr_offboarding_instances(sector_id)")
    .eq("id", itemId)
    .single();

  if (!item) return { error: "Etapa nao encontrada" };

  const rawInstance = item.hr_offboarding_instances as
    | { sector_id: string }
    | { sector_id: string }[]
    | null;
  const instance = Array.isArray(rawInstance) ? rawInstance[0] : rawInstance;
  if (!instance) return { error: "Offboarding nao encontrado" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, instance.sector_id, "employee", "update")) {
    return { error: "Sem permissao" };
  }

  const { error } = await supabase
    .from("hr_offboarding_items")
    .update({
      is_completed: completed,
      completed_at: completed ? new Date().toISOString() : null,
      completed_by: completed ? user.id : null,
    })
    .eq("id", itemId);

  if (error) return { error: error.message };

  // Keep the instance status in sync with whether every item is done.
  const { data: allItems } = await supabase
    .from("hr_offboarding_items")
    .select("is_completed")
    .eq("offboarding_id", item.offboarding_id);

  const allCompleted =
    (allItems ?? []).length > 0 && (allItems ?? []).every((i) => i.is_completed);

  await supabase
    .from("hr_offboarding_instances")
    .update(
      allCompleted
        ? { status: "completed", completed_at: new Date().toISOString() }
        : { status: "in_progress", completed_at: null }
    )
    .eq("id", item.offboarding_id);

  revalidatePath("/hr/offboarding");
  return { success: true };
}

export async function cancelOffboarding(instanceId: string) {
  const idParsed = z.string().uuid().safeParse(instanceId);
  if (!idParsed.success) return { error: "ID invalido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { data: instance } = await supabase
    .from("hr_offboarding_instances")
    .select("sector_id")
    .eq("id", instanceId)
    .single();

  if (!instance) return { error: "Offboarding nao encontrado" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, instance.sector_id, "employee", "update")) {
    return { error: "Sem permissao" };
  }

  const { error } = await supabase
    .from("hr_offboarding_instances")
    .update({ status: "cancelled" })
    .eq("id", instanceId);

  if (error) return { error: error.message };

  revalidatePath("/hr/offboarding");
  return { success: true };
}
