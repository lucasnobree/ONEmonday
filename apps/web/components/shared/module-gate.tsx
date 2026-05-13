"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

interface ModuleGateProps {
  sectorId: string;
  moduleSlug: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  comingSoonFallback?: React.ReactNode;
}

export function ModuleGate({
  sectorId,
  moduleSlug,
  children,
  fallback = null,
  comingSoonFallback,
}: ModuleGateProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["module-access", sectorId, moduleSlug],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("sector_modules")
        .select(
          `
          is_enabled,
          modules!inner(slug, status)
        `
        )
        .eq("sector_id", sectorId)
        .eq("modules.slug", moduleSlug)
        .single();
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return null;

  if (!data || !data.is_enabled) return fallback;

  const module = data.modules as any;
  if (module?.status === "coming_soon") {
    return comingSoonFallback ?? fallback;
  }

  if (module?.status === "disabled") return fallback;

  return children;
}
