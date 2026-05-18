"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  createOffboardingTemplate,
  updateOffboardingTemplate,
  deleteOffboardingTemplate,
  startOffboarding,
  toggleOffboardingItem,
  cancelOffboarding,
} from "@/lib/actions/hr/offboarding";

export interface OffboardingItem {
  id: string;
  offboarding_id: string;
  title: string;
  description: string | null;
  responsible_role: string | null;
  due_date: string | null;
  is_completed: boolean;
  completed_at: string | null;
  position: number;
}

export interface OffboardingInstance {
  id: string;
  employee_id: string;
  template_id: string;
  sector_id: string;
  termination_date: string;
  reason: string | null;
  status: string;
  completed_at: string | null;
  created_at: string;
  employee: {
    full_name: string;
    position: string;
    department: string | null;
  };
  template: {
    name: string;
  };
  items: OffboardingItem[];
}

export interface OffboardingTemplateItem {
  title: string;
  description?: string | null;
  responsible_role?: string | null;
  due_days_offset?: number;
}

export interface OffboardingTemplate {
  id: string;
  sector_id: string;
  name: string;
  description: string | null;
  items: OffboardingTemplateItem[];
  is_active: boolean;
  created_at: string;
}

const INSTANCE_SELECT = `
  id, employee_id, template_id, sector_id, termination_date, reason, status,
  completed_at, created_at,
  hr_employees (full_name, position, department),
  hr_offboarding_templates (name),
  hr_offboarding_items (id, offboarding_id, title, description, responsible_role, due_date, is_completed, completed_at, position)
`;

interface RawOffboardingInstance {
  hr_employees: OffboardingInstance["employee"];
  hr_offboarding_templates: OffboardingInstance["template"];
  hr_offboarding_items: OffboardingItem[] | null;
  [key: string]: unknown;
}

function flattenInstance(row: RawOffboardingInstance): OffboardingInstance {
  const {
    hr_employees,
    hr_offboarding_templates,
    hr_offboarding_items,
    ...rest
  } = row;
  return {
    ...rest,
    employee: hr_employees,
    template: hr_offboarding_templates,
    items: [...(hr_offboarding_items ?? [])].sort(
      (a, b) => a.position - b.position
    ),
  } as OffboardingInstance;
}

function parseTemplateItems(raw: unknown): OffboardingTemplateItem[] {
  try {
    if (typeof raw === "string") {
      return JSON.parse(raw) as OffboardingTemplateItem[];
    }
    return (raw as OffboardingTemplateItem[] | null) ?? [];
  } catch {
    return [];
  }
}

export function useOffboardingInstances(sectorId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["hr-offboarding", sectorId],
    queryFn: async () => {
      if (!sectorId) return [];

      const { data, error } = await supabase
        .from("hr_offboarding_instances")
        .select(INSTANCE_SELECT)
        .eq("sector_id", sectorId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return ((data ?? []) as unknown as RawOffboardingInstance[]).map(
        flattenInstance
      );
    },
    enabled: !!sectorId,
  });
}

export function useOffboardingTemplates(sectorId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["hr-offboarding-templates", sectorId],
    queryFn: async () => {
      if (!sectorId) return [];

      const { data, error } = await supabase
        .from("hr_offboarding_templates")
        .select("*")
        .eq("sector_id", sectorId)
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error) throw error;

      return ((data ?? []) as Record<string, unknown>[]).map(
        (t) =>
          ({
            ...t,
            items: parseTemplateItems(t.items),
          }) as OffboardingTemplate
      );
    },
    enabled: !!sectorId,
  });
}

export function useCreateOffboardingTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: unknown) => createOffboardingTemplate(input),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["hr-offboarding-templates"],
      });
    },
  });
}

export function useUpdateOffboardingTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) =>
      updateOffboardingTemplate(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["hr-offboarding-templates"],
      });
    },
  });
}

export function useDeleteOffboardingTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteOffboardingTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["hr-offboarding-templates"],
      });
    },
  });
}

export function useStartOffboarding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: unknown) => startOffboarding(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr-offboarding"] });
    },
  });
}

export function useToggleOffboardingItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      itemId,
      completed,
    }: {
      itemId: string;
      completed: boolean;
    }) => toggleOffboardingItem(itemId, completed),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr-offboarding"] });
    },
  });
}

export function useCancelOffboarding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (instanceId: string) => cancelOffboarding(instanceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr-offboarding"] });
    },
  });
}
