"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export async function uploadDocument(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const employeeId = formData.get("employeeId") as string;
  const sectorId = formData.get("sectorId") as string;
  const category = formData.get("category") as string;
  const expiryDate = formData.get("expiryDate") as string | null;
  const file = formData.get("file") as File;

  if (!employeeId || !sectorId || !file || !category) {
    return { error: "Dados incompletos" };
  }

  const idsParsed = z
    .object({ employeeId: z.string().uuid(), sectorId: z.string().uuid() })
    .safeParse({ employeeId, sectorId });
  if (!idsParsed.success) return { error: "ID invalido" };

  const validCategory = z
    .enum(["contract", "id", "certificate", "other"])
    .safeParse(category);
  if (!validCategory.success) return { error: "Categoria invalida" };

  let expiry: string | null = null;
  if (expiryDate) {
    const expiryParsed = z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Data invalida")
      .safeParse(expiryDate);
    if (!expiryParsed.success) return { error: "Data de validade invalida" };
    expiry = expiryParsed.data;
  }

  // Document management is deliberately gated on `employee:update`: anyone
  // who may edit an employee's record may also manage that employee's
  // documents. This is the intended permission bar (no separate
  // `employee_document` resource), and it is a real server-side check, not
  // RLS-only.
  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, sectorId, "employee", "update")) {
    return { error: "Sem permissao" };
  }

  // Confirm the employee belongs to the claimed sector before writing.
  const { data: employee } = await supabase
    .from("hr_employees")
    .select("sector_id")
    .eq("id", employeeId)
    .single();
  if (!employee || employee.sector_id !== sectorId) {
    return { error: "Colaborador nao encontrado" };
  }

  const filePath = `${sectorId}/${employeeId}/${Date.now()}_${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from("hr-documents")
    .upload(filePath, file);

  if (uploadError) return { error: uploadError.message };

  const {
    data: { publicUrl },
  } = supabase.storage.from("hr-documents").getPublicUrl(filePath);

  const { data: doc, error: insertError } = await supabase
    .from("hr_employee_documents")
    .insert({
      employee_id: employeeId,
      name: file.name,
      file_url: publicUrl,
      file_size: file.size,
      category: validCategory.data,
      expiry_date: expiry,
      uploaded_by: user.id,
      sector_id: sectorId,
    })
    .select()
    .single();

  if (insertError) return { error: insertError.message };

  revalidatePath("/hr");
  return { data: doc };
}

export async function deleteDocument(documentId: string) {
  const parsed = z.string().uuid().safeParse(documentId);
  if (!parsed.success) return { error: "ID invalido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { data: doc } = await supabase
    .from("hr_employee_documents")
    .select("id, file_url, sector_id")
    .eq("id", documentId)
    .single();

  if (!doc) return { error: "Documento nao encontrado" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, doc.sector_id, "employee", "update")) {
    return { error: "Sem permissao" };
  }

  const url = doc.file_url;
  const bucketPrefix = "/storage/v1/object/public/hr-documents/";
  const pathIndex = url.indexOf(bucketPrefix);
  if (pathIndex !== -1) {
    const storagePath = url.substring(pathIndex + bucketPrefix.length);
    await supabase.storage.from("hr-documents").remove([storagePath]);
  }

  const { error } = await supabase
    .from("hr_employee_documents")
    .delete()
    .eq("id", documentId);

  if (error) return { error: error.message };

  revalidatePath("/hr");
  return { success: true };
}
