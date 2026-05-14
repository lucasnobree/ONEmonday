"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface Employee {
  id: string;
  sector_id: string;
  user_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  position: string;
  department: string | null;
  hire_date: string;
  birth_date: string | null;
  manager_id: string | null;
  employment_type: string;
  status: string;
  termination_date: string | null;
  created_at: string;
}

export function useEmployees(sectorId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["hr-employees", sectorId],
    queryFn: async () => {
      if (!sectorId) return [];

      const { data, error } = await supabase
        .from("hr_employees")
        .select("*")
        .eq("sector_id", sectorId)
        .order("full_name", { ascending: true });

      if (error) throw error;
      return (data as Employee[]) ?? [];
    },
    enabled: !!sectorId,
  });
}
