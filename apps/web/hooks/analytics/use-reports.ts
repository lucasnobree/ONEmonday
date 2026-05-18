"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  createReport,
  updateReport,
  deleteReport,
} from "@/lib/actions/analytics/reports";
import type { MetricKey } from "@/lib/analytics/metrics";
import type { ChartType, GroupBy } from "@/lib/validations/analytics";

/** A saved, sector-scoped analytics report. */
export interface AnalyticsReport {
  id: string;
  sector_id: string;
  name: string;
  description: string | null;
  metric: MetricKey;
  chart_type: ChartType;
  group_by: GroupBy;
  date_range_days: number;
  /** True for reports seeded by migration 00183 (vs. user-created). */
  is_default: boolean;
  created_at: string;
}

export function useReports(sectorId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["analytics-reports", sectorId],
    queryFn: async () => {
      if (!sectorId) return [];

      const { data, error } = await supabase
        .from("analytics_reports")
        .select(
          `id, sector_id, name, description, metric, chart_type,
           group_by, date_range_days, is_default, created_at`
        )
        .eq("sector_id", sectorId)
        .eq("is_active", true)
        // Default (seeded) reports first, then newest user reports.
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as AnalyticsReport[];
    },
    enabled: !!sectorId,
  });
}

export function useCreateReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => createReport(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analytics-reports"] });
    },
  });
}

export function useUpdateReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => updateReport(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analytics-reports"] });
    },
  });
}

export function useDeleteReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reportId: string) => deleteReport(reportId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analytics-reports"] });
    },
  });
}
