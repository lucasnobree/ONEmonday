"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  isScopeReady,
  sectorFilterValue,
} from "@/lib/navigation/scoped-query";
import type { SectorScope } from "@/lib/navigation/sector-scope";
import {
  createContact,
  updateContact,
  deleteContact,
} from "@/lib/actions/crm/contacts";

export interface Contact {
  id: string;
  sector_id: string;
  company_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  is_primary: boolean;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  company: {
    id: string;
    name: string;
  } | null;
}

export function useContacts(scope: SectorScope | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["crm-contacts", scope],
    queryFn: async () => {
      if (!isScopeReady(scope)) return [];

      let query = supabase
        .from("crm_contacts")
        .select(
          `
          id, sector_id, company_id, full_name, email, phone,
          position, is_primary, notes, is_active, created_at,
          crm_companies (id, name)
        `
        )
        .eq("is_active", true);

      const filterSectorId = sectorFilterValue(scope);
      if (filterSectorId) query = query.eq("sector_id", filterSectorId);

      const { data, error } = await query.order("full_name", {
        ascending: true,
      });

      if (error) throw error;

      return ((data ?? []) as Record<string, unknown>[]).map((c) => ({
        ...c,
        company: c.crm_companies,
        crm_companies: undefined,
      })) as unknown as Contact[];
    },
    enabled: isScopeReady(scope),
  });
}

export function useCreateContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: unknown) => createContact(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-contacts"] });
    },
  });
}

export function useUpdateContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: unknown) => updateContact(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["crm-contact-detail"] });
    },
  });
}

export function useDeleteContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (contactId: string) => deleteContact(contactId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-contacts"] });
    },
  });
}
