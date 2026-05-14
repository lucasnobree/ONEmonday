"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface TimeOffBalance {
  policy_id: string;
  policy_name: string;
  total_days: number;
  used_days: number;
  pending_days: number;
  available_days: number;
}

export function useTimeOffBalance(
  employeeId: string | undefined | null,
  year: number
) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["hr-time-off-balance", employeeId, year],
    queryFn: async () => {
      if (!employeeId) return [];

      const { data, error } = await supabase.rpc(
        "get_employee_time_off_balance",
        {
          p_employee_id: employeeId,
          p_year: year,
        }
      );

      if (error) throw error;
      return (data as TimeOffBalance[]) ?? [];
    },
    enabled: !!employeeId,
  });
}
