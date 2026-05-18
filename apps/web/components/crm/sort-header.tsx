"use client";

import { ArrowUp, ArrowDown } from "lucide-react";
import type { SortDirection } from "@/lib/crm/list-sort";

/**
 * A sortable `<th>` for the CRM list-view tables (Companies, Contacts).
 * Declared at module scope so it is a stable component — an inline render
 * function would reset state and trips `react-hooks/static-components`.
 */
export function SortHeader<K extends string>({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
  className,
}: {
  label: string;
  sortKey: K;
  activeKey: K;
  direction: SortDirection;
  onSort: (key: K) => void;
  className?: string;
}) {
  const isActive = activeKey === sortKey;
  return (
    <th className={`pb-2 font-medium ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 hover:text-foreground"
      >
        {label}
        {isActive &&
          (direction === "asc" ? (
            <ArrowUp className="size-3" />
          ) : (
            <ArrowDown className="size-3" />
          ))}
      </button>
    </th>
  );
}
