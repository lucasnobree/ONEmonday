"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** A single option in a {@link FilterSelect}. */
export interface FilterSelectOption {
  /** The raw value stored in state. */
  value: string;
  /** The localized label shown both in the list and on the trigger. */
  label: string;
}

interface FilterSelectProps {
  /** Current value (always a real selected value — never empty/placeholder). */
  value: string;
  /** Called with the newly selected value. */
  onValueChange: (value: string) => void;
  /** The selectable options, including the "all" sentinel option. */
  options: FilterSelectOption[];
  /** Optional class for the trigger. */
  className?: string;
  /** Accessible label for the trigger. */
  "aria-label"?: string;
}

/**
 * A thin wrapper over the base `Select` for filter bars.
 *
 * Base UI's `Select.Value` renders the raw selected value unless it is given a
 * formatter. Filter dropdowns always carry an `"all"` sentinel value, so the
 * trigger would otherwise paint the literal token `"all"` instead of a
 * translated label. This component resolves the value through its option list
 * so the trigger always shows the option's localized `label`.
 */
export function FilterSelect({
  value,
  onValueChange,
  options,
  className,
  "aria-label": ariaLabel,
}: FilterSelectProps) {
  return (
    <Select value={value} onValueChange={(v) => onValueChange(v ?? "all")}>
      <SelectTrigger
        className={cn("h-8 text-sm", className)}
        aria-label={ariaLabel}
      >
        <SelectValue>
          {(selected: string | null) =>
            options.find((o) => o.value === selected)?.label ?? selected
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
