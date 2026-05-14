"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  createOnboardingTemplate,
  updateOnboardingTemplate,
  deleteOnboardingTemplate,
  startOnboarding,
  toggleOnboardingItem as toggleOnboardingItemAction,
  completeOnboarding,
} from "@/lib/actions/hr/onboarding";

export interface OnboardingItem {
  id: string;
  onboarding_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  is_completed: boolean;
  completed_at: string | null;
  position: number;
}

export interface OnboardingInstance {
  id: string;
  employee_id: string;
  template_id: string;
  sector_id: string;
  start_date: string;
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
  items: OnboardingItem[];
}

export interface OnboardingTemplateItem {
  title: string;
  description?: string | null;
  responsible_role?: string | null;
  due_days_offset?: number;
}

export interface OnboardingTemplate {
  id: string;
  sector_id: string;
  name: string;
  position: string | null;
  description: string | null;
  items: OnboardingTemplateItem[];
  is_active: boolean;
  created_at: string;
}

export function useOnboardingInstances(sectorId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["hr-onboarding", sectorId],
    queryFn: async () => {
      if (!sectorId) return [];

      const { data, error } = await supabase
        .from("hr_onboarding_instances")
        .select(
          `
          id, employee_id, template_id, sector_id, start_date, status, completed_at, created_at,
          hr_employees (full_name, position, department),
          hr_onboarding_templates (name),
          hr_onboarding_items (id, onboarding_id, title, description, due_date, is_completed, completed_at, position)
        `
        )
        .eq("sector_id", sectorId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []).map((d: any) => ({
        ...d,
        employee: d.hr_employees,
        template: d.hr_onboarding_templates,
        items: (d.hr_onboarding_items || []).sort(
          (a: any, b: any) => a.position - b.position
        ),
      })) as OnboardingInstance[];
    },
    enabled: !!sectorId,
  });
}

export function useOnboardingDetail(instanceId: string | null) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["hr-onboarding-detail", instanceId],
    queryFn: async () => {
      if (!instanceId) return null;

      const { data, error } = await supabase
        .from("hr_onboarding_instances")
        .select(
          `
          id, employee_id, template_id, sector_id, start_date, status, completed_at, created_at,
          hr_employees (full_name, position, department),
          hr_onboarding_templates (name),
          hr_onboarding_items (id, onboarding_id, title, description, due_date, is_completed, completed_at, position)
        `
        )
        .eq("id", instanceId)
        .single();

      if (error) throw error;

      return {
        ...data,
        employee: (data as any).hr_employees,
        template: (data as any).hr_onboarding_templates,
        items: ((data as any).hr_onboarding_items || []).sort(
          (a: any, b: any) => a.position - b.position
        ),
      } as OnboardingInstance;
    },
    enabled: !!instanceId,
  });
}

export function useOnboardingTemplates(sectorId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["hr-onboarding-templates", sectorId],
    queryFn: async () => {
      if (!sectorId) return [];

      const { data, error } = await supabase
        .from("hr_onboarding_templates")
        .select("*")
        .eq("sector_id", sectorId)
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error) throw error;

      return (data || []).map((t: any) => {
        let items: OnboardingTemplateItem[] = [];
        try {
          items =
            typeof t.items === "string" ? JSON.parse(t.items) : t.items || [];
        } catch {
          items = [];
        }
        return { ...t, items } as OnboardingTemplate;
      });
    },
    enabled: !!sectorId,
  });
}

export function useCompleteOnboardingItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      itemId,
      completed,
    }: {
      itemId: string;
      completed: boolean;
    }) => {
      const result = await toggleOnboardingItemAction(itemId, completed);
      if (result.error) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr-onboarding"] });
      queryClient.invalidateQueries({ queryKey: ["hr-onboarding-detail"] });
    },
  });
}

export function useCreateOnboardingTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: unknown) => createOnboardingTemplate(input),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["hr-onboarding-templates"],
      });
    },
  });
}

export function useUpdateOnboardingTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) =>
      updateOnboardingTemplate(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["hr-onboarding-templates"],
      });
    },
  });
}

export function useDeleteOnboardingTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteOnboardingTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["hr-onboarding-templates"],
      });
    },
  });
}

export function useStartOnboarding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      employeeId,
      templateId,
    }: {
      employeeId: string;
      templateId: string;
    }) => startOnboarding(employeeId, templateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr-onboarding"] });
      queryClient.invalidateQueries({ queryKey: ["hr-onboarding-detail"] });
    },
  });
}

export function useCompleteOnboarding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (instanceId: string) => completeOnboarding(instanceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr-onboarding"] });
      queryClient.invalidateQueries({ queryKey: ["hr-onboarding-detail"] });
    },
  });
}
