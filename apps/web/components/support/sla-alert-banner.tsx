"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useSlaStatus } from "@/hooks/support/use-sla-status";
import { AlertTriangle, ShieldAlert } from "lucide-react";

export function SlaAlertBanner() {
  const { data: slaEntries } = useSlaStatus();

  const { atRisk, breached } = useMemo(() => {
    if (!slaEntries) return { atRisk: 0, breached: 0 };
    let atRisk = 0;
    let breached = 0;
    for (const entry of slaEntries) {
      if (entry.remaining_pct <= 0) {
        breached++;
      } else if (entry.remaining_pct < 25) {
        atRisk++;
      }
    }
    return { atRisk, breached };
  }, [slaEntries]);

  if (atRisk === 0 && breached === 0) return null;

  return (
    <div className="space-y-2">
      {breached > 0 && (
        <Link
          href="/support/tickets?status=open"
          className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900/50 px-4 py-3 text-sm text-red-800 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors"
        >
          <ShieldAlert className="size-5 shrink-0" />
          <span>
            <strong>{breached}</strong>{" "}
            {breached === 1 ? "ticket com SLA violado" : "tickets com SLA violado"}
          </span>
        </Link>
      )}
      {atRisk > 0 && (
        <Link
          href="/support/tickets?status=open"
          className="flex items-center gap-3 rounded-lg border border-yellow-200 bg-yellow-50 dark:bg-yellow-950/30 dark:border-yellow-900/50 px-4 py-3 text-sm text-yellow-800 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-950/50 transition-colors"
        >
          <AlertTriangle className="size-5 shrink-0" />
          <span>
            <strong>{atRisk}</strong>{" "}
            {atRisk === 1
              ? "ticket em risco de violar SLA"
              : "tickets em risco de violar SLA"}
          </span>
        </Link>
      )}
    </div>
  );
}
