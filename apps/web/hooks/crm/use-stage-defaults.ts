"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { RottingConfig } from "@/lib/crm/deal-rotting";

export interface StageDefault {
  id: string;
  sector_id: string;
  stage_name: string;
  default_probability: number;
  position: number;
  rotting_days: number;
}

/**
 * Fetch per-stage pipeline defaults (win probability + rotting threshold)
 * for a sector.
 */
export function useStageDefaults(sectorId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["crm-stage-defaults", sectorId],
    queryFn: async () => {
      if (!sectorId) return [];

      const { data, error } = await supabase
        .from("crm_pipeline_stage_defaults")
        .select(
          "id, sector_id, stage_name, default_probability, position, rotting_days"
        )
        .eq("sector_id", sectorId)
        .order("position", { ascending: true });

      if (error) throw error;
      return (data ?? []) as StageDefault[];
    },
    enabled: !!sectorId,
    staleTime: 60 * 1000,
  });
}

/** Build a stage-name -> rotting_days map from fetched stage defaults. */
export function toRottingConfig(
  stageDefaults: StageDefault[] | undefined
): RottingConfig {
  const config: RottingConfig = {};
  for (const sd of stageDefaults ?? []) {
    config[sd.stage_name] = sd.rotting_days;
  }
  return config;
}
