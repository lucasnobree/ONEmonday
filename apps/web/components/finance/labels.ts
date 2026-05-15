import type { ExpenseCategory } from "@/hooks/finance/use-expenses";
import type { InvoiceStatus } from "@/hooks/finance/use-invoices";
import type { ExpenseStatus } from "@/hooks/finance/use-expenses";

/** Portuguese display labels for expense / budget categories. */
export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  payroll: "Folha de Pagamento",
  software: "Software",
  travel: "Viagens",
  office: "Escritorio",
  marketing: "Marketing",
  services: "Servicos",
  taxes: "Impostos",
  other: "Outros",
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Rascunho",
  sent: "Enviada",
  paid: "Paga",
  overdue: "Vencida",
  void: "Cancelada",
};

export const EXPENSE_STATUS_LABELS: Record<ExpenseStatus, string> = {
  pending: "Pendente",
  paid: "Paga",
  void: "Cancelada",
};

type BadgeVariant = "default" | "secondary" | "outline" | "destructive";

export const INVOICE_STATUS_VARIANTS: Record<InvoiceStatus, BadgeVariant> = {
  draft: "outline",
  sent: "secondary",
  paid: "default",
  overdue: "destructive",
  void: "outline",
};

export const EXPENSE_STATUS_VARIANTS: Record<ExpenseStatus, BadgeVariant> = {
  pending: "secondary",
  paid: "default",
  void: "outline",
};
