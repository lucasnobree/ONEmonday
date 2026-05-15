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

  // A `!inner` join can be typed as either an object or a single-element
  // array depending on Supabase's inference — normalise both shapes.
  type ModuleJoin = { slug: string; status: string };
  const joined = data.modules as unknown as
    | ModuleJoin
    | ModuleJoin[]
    | null;
  const moduleInfo = Array.isArray(joined) ? joined[0] : joined;

  if (moduleInfo?.status === "coming_soon") {
    return comingSoonFallback ?? fallback;
  }

  if (moduleInfo?.status === "disabled") return fallback;

  return children;
}
