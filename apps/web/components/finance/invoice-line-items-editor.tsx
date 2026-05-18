"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "./money-input";
import { Plus, Trash2 } from "lucide-react";
import { formatCents } from "@/lib/finance/money";
import {
  lineTotalCents,
  invoiceTotalCents,
  quantityToMilli,
  formatQuantity,
} from "@/lib/finance/line-items";

/** Editable line in the invoice form (UI state — cents + milli-units). */
export interface EditableLine {
  description: string;
  quantityMilli: number;
  unitPriceCents: number | null;
}

/** A fresh, empty line (quantity defaults to 1.000). */
export function emptyLine(): EditableLine {
  return { description: "", quantityMilli: 1000, unitPriceCents: null };
}

interface InvoiceLineItemsEditorProps {
  lines: EditableLine[];
  onChange: (lines: EditableLine[]) => void;
}

/**
 * Multi-row editor for invoice line items (audit item I2). The invoice amount
 * is the sum of `quantity × unitPrice` across the lines; the dialog reads the
 * total back via {@link invoiceTotalCents}.
 */
export function InvoiceLineItemsEditor({
  lines,
  onChange,
}: InvoiceLineItemsEditorProps) {
  const update = (index: number, patch: Partial<EditableLine>) => {
    onChange(lines.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  };

  const remove = (index: number) => {
    onChange(lines.filter((_, i) => i !== index));
  };

  const add = () => onChange([...lines, emptyLine()]);

  const total = invoiceTotalCents(
    lines.map((l) => ({
      description: l.description,
      quantityMilli: l.quantityMilli,
      unitPriceCents: l.unitPriceCents ?? 0,
    }))
  );

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <Label>Itens da fatura</Label>
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus className="size-4 mr-1" />
          Adicionar item
        </Button>
      </div>

      {lines.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nenhum item. Adicione itens para detalhar a fatura — o valor total
          sera calculado automaticamente.
        </p>
      ) : (
        <div className="space-y-2">
          {lines.map((line, index) => {
            const lineTotal = lineTotalCents(
              line.quantityMilli,
              line.unitPriceCents ?? 0
            );
            return (
              <div
                key={index}
                className="grid grid-cols-[1fr_4rem_6rem_auto] items-end gap-2"
              >
                <div className="grid gap-1">
                  {index === 0 && (
                    <span className="text-xs text-muted-foreground">
                      Descricao
                    </span>
                  )}
                  <Input
                    aria-label={`Descricao do item ${index + 1}`}
                    value={line.description}
                    onChange={(e) =>
                      update(index, { description: e.target.value })
                    }
                    placeholder="Descricao do item"
                  />
                </div>
                <div className="grid gap-1">
                  {index === 0 && (
                    <span className="text-xs text-muted-foreground">Qtd</span>
                  )}
                  <Input
                    aria-label={`Quantidade do item ${index + 1}`}
                    inputMode="decimal"
                    defaultValue={formatQuantity(line.quantityMilli)}
                    onChange={(e) => {
                      const milli = quantityToMilli(e.target.value);
                      if (milli != null) update(index, { quantityMilli: milli });
                    }}
                  />
                </div>
                <div className="grid gap-1">
                  {index === 0 && (
                    <span className="text-xs text-muted-foreground">
                      Preco un.
                    </span>
                  )}
                  <MoneyInput
                    valueCents={line.unitPriceCents}
                    onChangeCents={(cents) =>
                      update(index, { unitPriceCents: cents })
                    }
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Remover item ${index + 1}`}
                  onClick={() => remove(index)}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
                <span className="col-span-4 text-right text-xs text-muted-foreground">
                  Subtotal: {formatCents(lineTotal)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {lines.length > 0 && (
        <div className="flex justify-between border-t pt-2 text-sm font-medium">
          <span>Total da fatura</span>
          <span>{formatCents(total)}</span>
        </div>
      )}
    </div>
  );
}
