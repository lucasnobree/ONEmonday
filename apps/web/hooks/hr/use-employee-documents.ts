"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  uploadDocument,
  deleteDocument,
} from "@/lib/actions/hr/documents";

export interface EmployeeDocument {
  id: string;
  employee_id: string;
  name: string;
  file_url: string;
  file_size: number | null;
  category: string;
  expiry_date: string | null;
  uploaded_by: string;
  sector_id: string;
  created_at: string;
}

export function useEmployeeDocuments(employeeId: string | null | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["hr-employee-documents", employeeId],
    queryFn: async () => {
      if (!employeeId) return [];

      const { data, error } = await supabase
        .from("hr_employee_documents")
        .select("*")
        .eq("employee_id", employeeId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data as EmployeeDocument[]) ?? [];
    },
    enabled: !!employeeId,
  });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      employeeId,
      sectorId,
      file,
      category,
      expiryDate,
    }: {
      employeeId: string;
      sectorId: string;
      file: File;
      category: string;
      expiryDate?: string;
    }) => {
      const formData = new FormData();
      formData.set("employeeId", employeeId);
      formData.set("sectorId", sectorId);
      formData.set("file", file);
      formData.set("category", category);
      if (expiryDate) formData.set("expiryDate", expiryDate);
      return uploadDocument(formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["hr-employee-documents"],
      });
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (documentId: string) => deleteDocument(documentId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["hr-employee-documents"],
      });
    },
  });
}
