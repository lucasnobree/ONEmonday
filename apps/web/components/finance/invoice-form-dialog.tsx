"use client";

import { useState } from "react";
import {
  useCreateInvoice,
  useUpdateInvoice,
} from "@/hooks/finance/use-invoices";
import type { Invoice, InvoiceStatus } from "@/hooks/finance/use-invoices";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { MoneyInput } from "./money-input";
import { INVOICE_STATUS_LABELS } from "./labels";
import { INVOICE_STATUSES } from "@/lib/validations/finance";
import { todayDateOnly } from "@/lib/finance/dates";

const today = () => todayDateOnly();

interface InvoiceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectorId: string;
  invoice?: Invoice;
}

export function InvoiceFormDialog({
  open,
  onOpenChange,
  sectorId,
  invoice,
}: InvoiceFormDialogProps) {
  const createInvoice = useCreateInvoice();
  const updateInvoice = useUpdateInvoice();
  const isEdit = !!invoice;

  const [number, setNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [description, setDescription] = useState("");
  const [amountCents, setAmountCents] = useState<number | null>(null);
  const [status, setStatus] = useState<InvoiceStatus>("draft");
  const [issueDate, setIssueDate] = useState(today());
  const [dueDate, setDueDate] = useState(today());

  // Re-seed the form when the dialog (re)opens — state adjusted during render.
  const formKey = `${open}:${invoice?.id ?? "new"}`;
  const [seededKey, setSeededKey] = useState<string | null>(null);
  if (open && seededKey !== formKey) {
    setSeededKey(formKey);
    setNumber(invoice?.number ?? "");
    setCustomerName(invoice?.customer_name ?? "");
    setDescription(invoice?.description ?? "");
    setAmountCents(invoice?.amount_cents ?? null);
    setStatus(invoice?.status ?? "draft");
    setIssueDate(invoice?.issue_date ?? today());
    setDueDate(invoice?.due_date ?? today());
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (amountCents == null || amountCents <= 0) {
      toast.error("Informe um valor válido");
      return;
    }

    const payload = isEdit
      ? {
          id: invoice.id,
          number,
          customerName,
          description: description || undefined,
          amountCents,
          currency: invoice.currency,
          status,
          issueDate,
          dueDate,
        }
      : {
          sectorId,
          number,
          customerName,
          description: description || undefined,
          amountCents,
          currency: "BRL" as const,
          status,
          issueDate,
          dueDate,
        };

    const result = isEdit
      ? await updateInvoice.mutateAsync(payload)
      : await createInvoice.mutateAsync(payload);

    if (result.error) {
      toast.error(
        typeof result.error === "string"
          ? result.error
          : `Erro ao ${isEdit ? "atualizar" : "criar"} fatura`
      );
      return;
    }

    toast.success(isEdit ? "Fatura atualizada" : "Fatura criada");
    onOpenChange(false);
  };

  const isPending = createInvoice.isPending || updateInvoice.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEdit ? "Editar Fatura" : "Nova Fatura"}
            </DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Atualize os dados da fatura"
                : "Registre uma nova conta a receber"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="invoice-number">Número</Label>
                <Input
                  id="invoice-number"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  placeholder="INV-001"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="invoice-amount">Valor (R$)</Label>
                <MoneyInput
                  key={formKey}
                  id="invoice-amount"
                  valueCents={amountCents}
                  onChangeCents={setAmountCents}
                  required
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="invoice-customer">Cliente</Label>
              <Input
                id="invoice-customer"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Nome do cliente"
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="invoice-issue">Emissão</Label>
                <Input
                  id="invoice-issue"
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="invoice-due">Vencimento</Label>
                <Input
                  id="invoice-due"
                  type="date"
                  value={dueDate}
                  min={issueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select
                  value={status}
                  onValueChange={(v) => setStatus(v as InvoiceStatus)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INVOICE_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {INVOICE_STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="invoice-description">Descrição</Label>
              <Textarea
                id="invoice-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalhes da fatura"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isPending || !number || !customerName}
            >
              {isPending
                ? "Salvando..."
                : isEdit
                  ? "Salvar"
                  : "Criar Fatura"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
