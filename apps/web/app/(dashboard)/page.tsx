"use client";

import { useMemo } from "react";
import { usePermissions } from "@/hooks/use-permissions";
import { resolveLanding } from "@/lib/navigation/landing";
import { SectorDashboard } from "@/components/dashboard/sector-dashboard";
import { GlobalOverviewView } from "@/components/overview/global-overview-view";
import { MyWorkView } from "@/components/my-work/my-work-view";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Role-based landing for `/`.
 *
 * The screen rendered depends on the signed-in user's role:
 *  - **admin**   → the cross-sector Global Overview
 *  - **manager** → their sector Dashboard
 *  - **ic**      → "Meu Trabalho"
 *
 * The branch is decided from `usePermissions()` and resolved synchronously by
 * {@link resolveLanding}; rendering the right screen in place (instead of a
 * client redirect) keeps the landing flicker-free. All three screens stay
 * reachable for everyone via the sidebar — role only sets the default.
 */
function HomeSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Skeleton className="h-52 rounded-lg" />
        <Skeleton className="h-52 rounded-lg" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { isGlobalAdmin, sectorRoles, isLoading } = usePermissions();

  const decision = useMemo(
    () => resolveLanding(isGlobalAdmin, sectorRoles),
    [isGlobalAdmin, sectorRoles]
  );

  // Wait for permissions so the landing branch is decided once, not flipped.
  if (isLoading) return <HomeSkeleton />;

  if (decision.target === "overview") {
    return <GlobalOverviewView />;
  }

  if (decision.target === "sector-dashboard" && decision.sector) {
    return (
      <SectorDashboard
        sectorId={decision.sector.id}
        sectorName={decision.sector.name}
      />
    );
  }

  return <MyWorkView />;
}
