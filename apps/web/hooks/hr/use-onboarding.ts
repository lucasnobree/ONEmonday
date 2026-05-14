"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

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
          id, employee_id, template_id, sector_id, start_date, status, created_at,
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

export function useCompleteOnboardingItem() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (itemId: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Nao autenticado");

      const { error } = await supabase
        .from("hr_onboarding_items")
        .update({
          is_completed: true,
          completed_at: new Date().toISOString(),
          completed_by: user.id,
        })
        .eq("id", itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr-onboarding"] });
    },
  });
}
