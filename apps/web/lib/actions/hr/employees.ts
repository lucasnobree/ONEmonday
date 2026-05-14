"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import { createEmployeeSchema } from "@/lib/validations/hr";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export async function createEmployee(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = createEmployeeSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, parsed.data.sectorId, "employee", "create")) {
    return { error: "Sem permissao" };
  }

  const { data: employee, error } = await supabase
    .from("hr_employees")
    .insert({
      sector_id: parsed.data.sectorId,
      user_id: parsed.data.userId || null,
      full_name: parsed.data.fullName,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      position: parsed.data.position,
      department: parsed.data.department || null,
      hire_date: parsed.data.hireDate,
      birth_date: parsed.data.birthDate || null,
      manager_id: parsed.data.managerId || null,
      employment_type: parsed.data.employmentType,
      status: "active",
    })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/hr");
  return { data: employee };
}

export async function updateEmployee(formData: unknown) {
  const schema = createEmployeeSchema.extend({
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
    .from("hr_employees")
    .select("sector_id")
    .eq("id", parsed.data.id)
    .single();

  if (!existing) return { error: "Colaborador nao encontrado" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, existing.sector_id, "employee", "update")) {
    return { error: "Sem permissao" };
  }

  const { error } = await supabase
    .from("hr_employees")
    .update({
      full_name: parsed.data.fullName,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      position: parsed.data.position,
      department: parsed.data.department || null,
      hire_date: parsed.data.hireDate,
      birth_date: parsed.data.birthDate || null,
      manager_id: parsed.data.managerId || null,
      employment_type: parsed.data.employmentType,
    })
    .eq("id", parsed.data.id);

  if (error) return { error: error.message };

  revalidatePath("/hr");
  return { success: true };
}

export async function terminateEmployee(
  employeeId: string,
  terminationDate: string
) {
  const idParsed = z.string().uuid().safeParse(employeeId);
  if (!idParsed.success) return { error: "ID invalido" };

  const dateParsed = z.string().min(1).safeParse(terminationDate);
  if (!dateParsed.success) return { error: "Data invalida" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { data: employee } = await supabase
    .from("hr_employees")
    .select("sector_id")
    .eq("id", employeeId)
    .single();

  if (!employee) return { error: "Colaborador nao encontrado" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, employee.sector_id, "employee", "update")) {
    return { error: "Sem permissao" };
  }

  const { error } = await supabase
    .from("hr_employees")
    .update({
      status: "terminated",
      termination_date: terminationDate,
    })
    .eq("id", employeeId);

  if (error) return { error: error.message };

  revalidatePath("/hr");
  return { success: true };
}
