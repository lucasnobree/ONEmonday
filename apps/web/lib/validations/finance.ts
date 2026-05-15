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

export const EXPENSE_STATUSES = ["pending", "paid", "void"] as const;

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

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
