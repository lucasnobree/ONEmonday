import type { ExpenseCategory } from "@/hooks/finance/use-expenses";
import type { InvoiceStatus } from "@/hooks/finance/use-invoices";
import type { ExpenseStatus } from "@/hooks/finance/use-expenses";
import type { FiscalDocStatus } from "@/hooks/finance/use-fiscal-documents";
import type { ChargeStatus } from "@/hooks/finance/use-payment-charges";

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
  submitted: "Em aprovacao",
  approved: "Aprovada",
  rejected: "Rejeitada",
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
  submitted: "secondary",
  approved: "default",
  rejected: "destructive",
  paid: "default",
  void: "outline",
};

/** Portuguese display labels for fiscal-document statuses (Focus NFe). */
export const FISCAL_DOC_STATUS_LABELS: Record<FiscalDocStatus, string> = {
  draft: "Rascunho",
  processing: "Em processamento",
  authorized: "Autorizada",
  rejected: "Rejeitada",
  cancelled: "Cancelada",
  error: "Erro",
};

/** Portuguese display labels for payment-charge statuses (Asaas). */
export const CHARGE_STATUS_LABELS: Record<ChargeStatus, string> = {
  draft: "Rascunho",
  pending: "Pendente",
  received: "Recebida",
  overdue: "Vencida",
  cancelled: "Cancelada",
  error: "Erro",
};

/** Portuguese labels for the workflow transitions surfaced as row actions. */
export const EXPENSE_TRANSITION_LABELS: Record<string, string> = {
  submit: "Enviar para aprovacao",
  approve: "Aprovar",
  reject: "Rejeitar",
  pay: "Marcar como paga",
  void: "Cancelar",
  reopen: "Reabrir",
};
