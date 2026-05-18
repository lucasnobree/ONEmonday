"use client";

import type { LucideIcon } from "lucide-react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  computeDelta,
  formatDeltaPercent,
  isFavorableDelta,
} from "@/lib/analytics/kpi";

interface KpiCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  iconColor?: string;
  /** When both are provided, a period-over-period delta badge is shown. */
  current?: number;
  previous?: number;
  /** Drives delta colour — defaults to "up is good". */
  higherIsBetter?: boolean;
}

export function KpiCard({
  label,
  value,
  icon: Icon,
  iconColor = "text-sky-500",
  current,
  previous,
  higherIsBetter = true,
}: KpiCardProps) {
  const showDelta = current !== undefined && previous !== undefined;
  const delta = showDelta ? computeDelta(current, previous) : null;
  const favorable = delta ? isFavorableDelta(delta, higherIsBetter) : false;
  // A delta from a zero baseline ("novo") has no percentage magnitude — the
  // "novo" label already conveys direction, so we drop the arrow to avoid the
  // misleading "↑ — vs. anterior" badge.
  const hasMagnitude = delta?.percent !== null;
  const DeltaIcon = !hasMagnitude
    ? null
    : delta?.direction === "up"
      ? ArrowUp
      : delta?.direction === "down"
        ? ArrowDown
        : Minus;

  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className={cn("shrink-0", iconColor)}>
          <Icon className="h-8 w-8" />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
          {delta && (
            <span
              className={cn(
                "mt-0.5 inline-flex items-center gap-0.5 text-xs font-medium",
                delta.direction === "flat"
                  ? "text-muted-foreground"
                  : favorable
                    ? "text-emerald-500"
                    : "text-red-500"
              )}
            >
              {DeltaIcon && <DeltaIcon className="h-3 w-3" />}
              {formatDeltaPercent(delta)}
              <span className="text-muted-foreground"> vs. anterior</span>
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
