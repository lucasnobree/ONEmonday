"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  createCompany,
  updateCompany,
  deleteCompany,
} from "@/lib/actions/crm/companies";

export interface Company {
  id: string;
  sector_id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  size: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  contacts_count: number;
}

export function useCompanies(sectorId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["crm-companies", sectorId],
    queryFn: async () => {
      if (!sectorId) return [];

      const { data, error } = await supabase
        .from("crm_companies")
        .select(
          `
          id, sector_id, name, domain, industry, size,
          phone, email, address, city, state, notes,
          is_active, created_at,
          crm_contacts (id)
        `
        )
        .eq("sector_id", sectorId)
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error) throw error;

      return ((data ?? []) as Record<string, unknown>[]).map((c) => ({
        ...c,
        contacts_count: Array.isArray(c.crm_contacts)
          ? c.crm_contacts.length
          : 0,
        crm_contacts: undefined,
      })) as unknown as Company[];
    },
    enabled: !!sectorId,
  });
}

export function useCreateCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: unknown) => createCompany(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-companies"] });
    },
  });
}

export function useUpdateCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: unknown) => updateCompany(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-companies"] });
      queryClient.invalidateQueries({ queryKey: ["crm-company-detail"] });
    },
  });
}

export function useDeleteCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (companyId: string) => deleteCompany(companyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-companies"] });
    },
  });
}
