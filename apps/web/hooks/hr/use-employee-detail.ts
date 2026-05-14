"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface EmployeeDetail {
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
  manager: { full_name: string; position: string } | null;
}

export interface EmployeeTimeOff {
  id: string;
  start_date: string;
  end_date: string;
  days_count: number;
  reason: string | null;
  status: string;
  rejection_reason: string | null;
  created_at: string;
  policy: { name: string } | null;
}

export function useEmployeeDetail(employeeId: string | null) {
  const supabase = createClient();

  const employeeQuery = useQuery({
    queryKey: ["hr-employee-detail", employeeId],
    queryFn: async () => {
      if (!employeeId) return null;

      const { data, error } = await supabase
        .from("hr_employees")
        .select("*, manager:hr_employees!manager_id(full_name, position)")
        .eq("id", employeeId)
        .single();

      if (error) throw error;
      return data as EmployeeDetail;
    },
    enabled: !!employeeId,
  });

  const timeOffQuery = useQuery({
    queryKey: ["hr-employee-time-off", employeeId],
    queryFn: async () => {
      if (!employeeId) return [];

      const { data, error } = await supabase
        .from("hr_time_off_requests")
        .select("id, start_date, end_date, days_count, reason, status, rejection_reason, created_at, policy:hr_time_off_policies(name)")
        .eq("employee_id", employeeId)
        .order("start_date", { ascending: false });

      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        ...r,
        policy: Array.isArray(r.policy) ? r.policy[0] ?? null : r.policy,
      })) as EmployeeTimeOff[];
    },
    enabled: !!employeeId,
  });

  const directReportsQuery = useQuery({
    queryKey: ["hr-employee-direct-reports", employeeId],
    queryFn: async () => {
      if (!employeeId) return 0;

      const { count, error } = await supabase
        .from("hr_employees")
        .select("id", { count: "exact", head: true })
        .eq("manager_id", employeeId)
        .eq("is_active", true);

      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!employeeId,
  });

  return {
    employee: employeeQuery.data ?? null,
    isLoadingEmployee: employeeQuery.isLoading,
    timeOff: timeOffQuery.data ?? [],
    isLoadingTimeOff: timeOffQuery.isLoading,
    directReportsCount: directReportsQuery.data ?? 0,
  };
}
