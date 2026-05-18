"use client";

import { useMemo } from "react";
import {
  agingByParty,
  agingTotals,
  agingGrandTotal,
  AGING_BUCKETS,
  AGING_BUCKET_LABELS,
  type AgingItem,
} from "@/lib/finance/aging";
import { formatCents } from "@/lib/finance/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * An AR / AP aging table — one row per customer / vendor, columns are the
 * 0-30 / 31-60 / 61-90 / 90+ buckets, with a totals footer. Pure presentation
 * over {@link AgingItem}s computed by `lib/finance/aging.ts`.
 */
export function AgingTable({
  title,
  items,
  emptyLabel,
}: {
  title: string;
  items: AgingItem[];
  emptyLabel: string;
}) {
  const rows = useMemo(() => agingByParty(items), [items]);
  const totals = useMemo(() => agingTotals(items), [items]);
  const grandTotal = useMemo(() => agingGrandTotal(totals), [totals]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            {emptyLabel}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="p-2 font-medium">Parte</th>
                  {AGING_BUCKETS.map((b) => (
                    <th key={b} className="p-2 font-medium text-right">
                      {AGING_BUCKET_LABELS[b]}
                    </th>
                  ))}
                  <th className="p-2 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.partyName} className="border-b last:border-0">
                    <td className="p-2 font-medium">{row.partyName}</td>
                    {AGING_BUCKETS.map((b) => (
                      <td
                        key={b}
                        className={`p-2 text-right ${
                          row.buckets[b] > 0 && b !== "current"
                            ? "text-amber-600"
                            : "text-muted-foreground"
                        }`}
                      >
                        {row.buckets[b] > 0
                          ? formatCents(row.buckets[b])
                          : "—"}
                      </td>
                    ))}
                    <td className="p-2 text-right font-semibold">
                      {formatCents(row.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t font-semibold">
                  <td className="p-2">Total</td>
                  {AGING_BUCKETS.map((b) => (
                    <td key={b} className="p-2 text-right">
                      {formatCents(totals[b])}
                    </td>
                  ))}
                  <td className="p-2 text-right">
                    {formatCents(grandTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
