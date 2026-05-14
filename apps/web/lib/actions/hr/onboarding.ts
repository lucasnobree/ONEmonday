"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import { createOnboardingTemplateSchema } from "@/lib/validations/hr";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export async function createOnboardingTemplate(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = createOnboardingTemplateSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, parsed.data.sectorId, "onboarding", "create")) {
    return { error: "Sem permissao" };
  }

  const { data: template, error } = await supabase
    .from("hr_onboarding_templates")
    .insert({
      sector_id: parsed.data.sectorId,
      name: parsed.data.name,
      position: parsed.data.position || null,
      description: parsed.data.description || null,
      items: JSON.stringify(
        parsed.data.items.map((item) => ({
          title: item.title,
          description: item.description || null,
          responsible_role: item.responsibleRole || null,
          due_days_offset: item.dueDaysAfterHire ?? 0,
        }))
      ),
    })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/hr/onboarding");
  return { data: template };
}

export async function updateOnboardingTemplate(id: string, formData: unknown) {
  const parsed = createOnboardingTemplateSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) return { error: "ID invalido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, parsed.data.sectorId, "onboarding", "update")) {
    return { error: "Sem permissao" };
  }

  const { error } = await supabase
    .from("hr_onboarding_templates")
    .update({
      name: parsed.data.name,
      position: parsed.data.position || null,
      description: parsed.data.description || null,
      items: JSON.stringify(
        parsed.data.items.map((item) => ({
          title: item.title,
          description: item.description || null,
          responsible_role: item.responsibleRole || null,
          due_days_offset: item.dueDaysAfterHire ?? 0,
        }))
      ),
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/hr/onboarding");
  return { success: true };
}

export async function deleteOnboardingTemplate(id: string) {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { error: "ID invalido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { data: template } = await supabase
    .from("hr_onboarding_templates")
    .select("sector_id")
    .eq("id", id)
    .single();

  if (!template) return { error: "Template nao encontrado" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, template.sector_id, "onboarding", "update")) {
    return { error: "Sem permissao" };
  }

  const { error } = await supabase
    .from("hr_onboarding_templates")
    .update({ is_active: false })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/hr/onboarding");
  return { success: true };
}

export async function startOnboarding(employeeId: string, templateId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { data: template } = await supabase
    .from("hr_onboarding_templates")
    .select("*")
    .eq("id", templateId)
    .single();

  if (!template) return { error: "Template nao encontrado" };

  const { data: employee } = await supabase
    .from("hr_employees")
    .select("id, hire_date, sector_id")
    .eq("id", employeeId)
    .single();

  if (!employee) return { error: "Colaborador nao encontrado" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, employee.sector_id, "onboarding", "create")) {
    return { error: "Sem permissao" };
  }

  const { data: instance, error: instanceError } = await supabase
    .from("hr_onboarding_instances")
    .insert({
      employee_id: employeeId,
      template_id: templateId,
      sector_id: employee.sector_id,
      status: "in_progress",
      start_date: new Date().toISOString().split("T")[0],
    })
    .select()
    .single();

  if (instanceError) return { error: instanceError.message };

  const templateItems = Array.isArray(template.items)
    ? template.items
    : typeof template.items === "string"
    ? JSON.parse(template.items)
    : [];

  if (templateItems.length > 0) {
    const hireDate = new Date(employee.hire_date);
    const items = templateItems.map(
      (item: { title: string; description?: string; responsible_role?: string; due_days_offset?: number }, index: number) => {
        const dueDate = new Date(hireDate);
        dueDate.setDate(dueDate.getDate() + (item.due_days_offset ?? 0));
        return {
          onboarding_id: instance.id,
          title: item.title,
          description: item.description || null,
          due_date: dueDate.toISOString().split("T")[0],
          is_completed: false,
          position: index,
        };
      }
    );

    const { error: itemsError } = await supabase
      .from("hr_onboarding_items")
      .insert(items);

    if (itemsError) return { error: itemsError.message };
  }

  revalidatePath("/hr/onboarding");
  revalidatePath("/hr/employees");
  return { data: instance };
}

export async function toggleOnboardingItem(itemId: string, completed: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { error } = await supabase
    .from("hr_onboarding_items")
    .update({
      is_completed: completed,
      completed_at: completed ? new Date().toISOString() : null,
      completed_by: completed ? user.id : null,
    })
    .eq("id", itemId);

  if (error) return { error: error.message };

  const { data: item } = await supabase
    .from("hr_onboarding_items")
    .select("onboarding_id")
    .eq("id", itemId)
    .single();

  if (item) {
    const { data: allItems } = await supabase
      .from("hr_onboarding_items")
      .select("is_completed")
      .eq("onboarding_id", item.onboarding_id);

    const allCompleted = allItems?.every((i) => i.is_completed);
    if (allCompleted) {
      await supabase
        .from("hr_onboarding_instances")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", item.onboarding_id);
    } else {
      await supabase
        .from("hr_onboarding_instances")
        .update({
          status: "in_progress",
          completed_at: null,
        })
        .eq("id", item.onboarding_id);
    }
  }

  revalidatePath("/hr/onboarding");
  return { success: true };
}

export async function completeOnboarding(instanceId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { error } = await supabase
    .from("hr_onboarding_instances")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", instanceId);

  if (error) return { error: error.message };

  revalidatePath("/hr/onboarding");
  return { success: true };
}
