"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RANGE_OPTIONS, type RangePreset } from "@/lib/analytics/date-range";

interface DateRangeFilterProps {
  value: RangePreset;
  onChange: (value: RangePreset) => void;
}

/** Single dashboard-level control that re-scopes every Analytics query. */
export function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  return (
    <Select
      value={value}
      onValueChange={(v) => {
        if (v) onChange(v as RangePreset);
      }}
    >
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Periodo" />
      </SelectTrigger>
      <SelectContent>
        {RANGE_OPTIONS.map((option) => (
          <SelectItem key={option.preset} value={option.preset}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
