import { z } from "zod";
import { SUPPORTED_CURRENCIES } from "@/lib/finance/money";

/** Expense / budget categories — must mirror the CHECK constraints in 00070. */
export const EXPENSE_CATEGORIES = [
  "payroll",
  "software",
  "travel",
  "office",
  "marketing",
  "services",
  "taxes",
  "other",
] as const;

export const INVOICE_STATUSES = [
  "draft",
  "sent",
  "paid",
  "overdue",
  "void",
] as const;

/**
 * Expense statuses — must mirror the CHECK constraint in 00140.
 * `submitted` / `approved` / `rejected` are the approval-workflow states added
 * by migration 00140; `pending` / `paid` / `void` are the original set.
 */
export const EXPENSE_STATUSES = [
  "pending",
  "submitted",
  "approved",
  "rejected",
  "paid",
  "void",
] as const;

/** Workflow transitions a user can apply to an expense (see expense-approval.ts). */
export const EXPENSE_TRANSITIONS = [
  "submit",
  "approve",
  "reject",
  "pay",
  "void",
  "reopen",
] as const;

const currencySchema = z.enum(SUPPORTED_CURRENCIES).default("BRL");

/**
 * Monetary amount in integer cents. The UI parses user input to cents via
 * `lib/finance/money.parseCents` before it ever reaches a schema, so here we
 * only enforce: integer, non-negative, and a sane upper bound (~999 million
 * in major units) to reject typos / overflow.
 */
const amountCentsSchema = z
  .number()
  .int("Valor deve ser um numero inteiro de centavos")
  .min(1, "Valor deve ser maior que zero")
  .max(99_999_999_999, "Valor muito alto");

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data invalida");

// =============================================
// Invoice line items
// =============================================
/**
 * One invoice line. `quantityMilli` is the quantity in integer milli-units
 * (1000 = 1.000); `unitPriceCents` is integer cents. The line total is
 * derived server-side — never trusted from the client.
 */
export const invoiceLineItemSchema = z.object({
  description: z.string().min(1, "Descricao obrigatoria").max(500),
  quantityMilli: z
    .number()
    .int("Quantidade invalida")
    .min(1, "Quantidade deve ser maior que zero")
    .max(1_000_000_000),
  unitPriceCents: z
    .number()
    .int("Preco unitario invalido")
    .min(0, "Preco unitario nao pode ser negativo")
    .max(99_999_999_999, "Preco unitario muito alto"),
});

/** At most 100 lines per invoice — a generous, abuse-resistant cap. */
const invoiceLineItemsSchema = z.array(invoiceLineItemSchema).max(100);

// =============================================
// Invoices
// =============================================
export const createInvoiceSchema = z
  .object({
    sectorId: z.string().uuid(),
    number: z.string().min(1, "Numero e obrigatorio").max(50),
    customerName: z.string().min(1, "Cliente e obrigatorio").max(200),
    description: z.string().max(1000).optional(),
    amountCents: amountCentsSchema,
    currency: currencySchema,
    status: z.enum(INVOICE_STATUSES).default("draft"),
    issueDate: isoDateSchema,
    dueDate: isoDateSchema,
    // Optional itemization. When present the server derives amountCents from
    // the sum of the lines and persists them (audit item I2).
    lineItems: invoiceLineItemsSchema.optional(),
  })
  .refine((v) => v.dueDate >= v.issueDate, {
    message: "Vencimento nao pode ser anterior a emissao",
    path: ["dueDate"],
  });

export const updateInvoiceSchema = z
  .object({
    id: z.string().uuid(),
    number: z.string().min(1, "Numero e obrigatorio").max(50),
    customerName: z.string().min(1, "Cliente e obrigatorio").max(200),
    description: z.string().max(1000).optional(),
    amountCents: amountCentsSchema,
    currency: currencySchema,
    status: z.enum(INVOICE_STATUSES),
    issueDate: isoDateSchema,
    dueDate: isoDateSchema,
    lineItems: invoiceLineItemsSchema.optional(),
  })
  .refine((v) => v.dueDate >= v.issueDate, {
    message: "Vencimento nao pode ser anterior a emissao",
    path: ["dueDate"],
  });

// =============================================
// Expenses
// =============================================
export const createExpenseSchema = z.object({
  sectorId: z.string().uuid(),
  vendorName: z.string().min(1, "Fornecedor e obrigatorio").max(200),
  description: z.string().max(1000).optional(),
  category: z.enum(EXPENSE_CATEGORIES).default("other"),
  amountCents: amountCentsSchema,
  currency: currencySchema,
  status: z.enum(EXPENSE_STATUSES).default("pending"),
  expenseDate: isoDateSchema,
  // Optional payable due date — drives AP scheduling / aging (audit E7).
  dueDate: isoDateSchema.optional(),
});

export const updateExpenseSchema = z.object({
  id: z.string().uuid(),
  vendorName: z.string().min(1, "Fornecedor e obrigatorio").max(200),
  description: z.string().max(1000).optional(),
  category: z.enum(EXPENSE_CATEGORIES),
  amountCents: amountCentsSchema,
  currency: currencySchema,
  status: z.enum(EXPENSE_STATUSES),
  expenseDate: isoDateSchema,
  dueDate: isoDateSchema.optional(),
});

// =============================================
// Budgets
// =============================================
export const createBudgetSchema = z.object({
  sectorId: z.string().uuid(),
  category: z.enum(EXPENSE_CATEGORIES),
  // First day of the budgeted month, e.g. "2026-05-01".
  periodMonth: isoDateSchema,
  amountCents: amountCentsSchema,
  currency: currencySchema,
});

export const updateBudgetSchema = z.object({
  id: z.string().uuid(),
  amountCents: amountCentsSchema,
});

// =============================================
// Expense approval workflow
// =============================================
/** Apply a workflow transition to an expense (see lib/finance/expense-approval). */
export const expenseTransitionSchema = z.object({
  id: z.string().uuid(),
  transition: z.enum(EXPENSE_TRANSITIONS),
  // Required by the UI when transition === "reject" (an audit-friendly reason).
  reason: z.string().max(500).optional(),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
export type InvoiceLineItemInput = z.infer<typeof invoiceLineItemSchema>;
export type ExpenseTransitionInput = z.infer<typeof expenseTransitionSchema>;

// =============================================
// Phase 4 — fiscal / banking / payment gateways
// =============================================

/** Request NF-e / NFS-e emission for an invoice through the fiscal gateway. */
export const emitFiscalDocumentSchema = z.object({
  invoiceId: z.string().uuid(),
  docType: z.enum(["nfe", "nfse"]).default("nfse"),
});

/** Request a boleto / PIX charge for an invoice through the PSP. */
export const createPaymentChargeSchema = z.object({
  invoiceId: z.string().uuid(),
  billingType: z.enum(["pix", "boleto", "undefined"]).default("pix"),
});

/** Import an OFX statement's transactions for a sector. */
export const importOfxSchema = z.object({
  sectorId: z.string().uuid(),
  /** Raw OFX file contents — parsed server-side. */
  ofxContent: z.string().min(1, "Arquivo OFX vazio").max(5_000_000),
});

/** Reconcile a bank transaction to an invoice or an expense. */
export const reconcileTransactionSchema = z
  .object({
    transactionId: z.string().uuid(),
    invoiceId: z.string().uuid().optional(),
    expenseId: z.string().uuid().optional(),
  })
  .refine((v) => (v.invoiceId == null) !== (v.expenseId == null), {
    message: "Informe exatamente uma fatura OU uma despesa",
    path: ["invoiceId"],
  });

export type EmitFiscalDocumentInput = z.infer<typeof emitFiscalDocumentSchema>;
export type CreatePaymentChargeInput = z.infer<
  typeof createPaymentChargeSchema
>;
export type ImportOfxInput = z.infer<typeof importOfxSchema>;
export type ReconcileTransactionInput = z.infer<
  typeof reconcileTransactionSchema
>;
