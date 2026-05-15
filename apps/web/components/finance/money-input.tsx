"use client";

import { Input } from "@/components/ui/input";
import { parseCents, fromCents } from "@/lib/finance/money";

interface MoneyInputProps {
  id?: string;
  /** Current value in integer cents. */
  valueCents: number | null;
  /** Receives the parsed integer-cent value (or null when unparseable). */
  onChangeCents: (cents: number | null) => void;
  placeholder?: string;
  required?: boolean;
}

/**
 * A currency text input that keeps its canonical value in integer cents.
 * The user types a decimal amount; we parse it to cents via `parseCents`
 * (pt-BR / en-US tolerant) so the form layer never handles floats.
 */
export function MoneyInput({
  id,
  valueCents,
  onChangeCents,
  placeholder = "0,00",
  required,
}: MoneyInputProps) {
  return (
    <Input
      id={id}
      inputMode="decimal"
      placeholder={placeholder}
      required={required}
      defaultValue={
        valueCents != null && valueCents > 0
          ? String(fromCents(valueCents))
          : ""
      }
      onChange={(e) => onChangeCents(parseCents(e.target.value))}
    />
  );
}
