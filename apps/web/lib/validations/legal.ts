import { z } from "zod";

/** Allowed enum values, shared between schemas and the UI. */
export const CONTRACT_TYPES = [
  "service",
  "nda",
  "vendor",
  "employment",
  "lease",
  "license",
  "partnership",
  "other",
] as const;

export const CONTRACT_STATUSES = [
  "draft",
  "in_review",
  "approved",
  "active",
  "expired",
  "renewed",
  "terminated",
] as const;

export const RENEWAL_TYPES = ["none", "auto", "optional"] as const;

export const MATTER_TYPES = [
  "contract_review",
  "advice",
  "dispute",
  "compliance",
  "litigation",
  "other",
] as const;

export const MATTER_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export const MATTER_STATUSES = [
  "open",
  "in_progress",
  "blocked",
  "resolved",
  "closed",
] as const;

export const CLAUSE_CATEGORIES = [
  "general",
  "confidentiality",
  "liability",
  "payment",
  "termination",
  "ip",
  "compliance",
  "other",
] as const;

/**
 * Optional date field: an empty string from a `<input type="date">` is coerced
 * to `undefined`, otherwise it must be a YYYY-MM-DD string.
 */
const optionalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida")
  .optional()
  .or(z.literal(""));

/** Bare contract fields, before the cross-field date refinement. */
const contractBaseSchema = z.object({
  sectorId: z.string().uuid(),
  title: z.string().min(1, "Título é obrigatório").max(200),
  counterparty: z.string().min(1, "Contraparte é obrigatória").max(200),
  contractType: z.enum(CONTRACT_TYPES).default("service"),
  status: z.enum(CONTRACT_STATUSES).default("draft"),
  renewalType: z.enum(RENEWAL_TYPES).default("none"),
  noticePeriodDays: z.number().int().min(0).max(3650).default(30),
  valueAmount: z.number().min(0).optional(),
  currency: z.string().min(1).max(8).default("BRL"),
  effectiveDate: optionalDate,
  expiryDate: optionalDate,
  ownerId: z.string().uuid().optional(),
  description: z.string().max(5000).optional(),
});

/** Effective date must not be after the expiry date when both are present. */
const datesOrdered = (data: { effectiveDate?: string; expiryDate?: string }) =>
  !data.effectiveDate ||
  !data.expiryDate ||
  data.effectiveDate <= data.expiryDate;

const datesError = {
  message: "Data de término deve ser igual ou posterior à data de início",
  path: ["expiryDate"],
};

export const createContractSchema = contractBaseSchema.refine(
  datesOrdered,
  datesError
);

export const updateContractSchema = contractBaseSchema
  .extend({ id: z.string().uuid() })
  .refine(datesOrdered, datesError);

export const createMatterSchema = z.object({
  sectorId: z.string().uuid(),
  contractId: z.string().uuid().optional(),
  title: z.string().min(1, "Título é obrigatório").max(200),
  matterType: z.enum(MATTER_TYPES).default("contract_review"),
  priority: z.enum(MATTER_PRIORITIES).default("medium"),
  status: z.enum(MATTER_STATUSES).default("open"),
  description: z.string().max(5000).optional(),
  assignedTo: z.string().uuid().optional(),
  dueDate: optionalDate,
});

export const updateMatterSchema = createMatterSchema.extend({
  id: z.string().uuid(),
});

export const createClauseSchema = z.object({
  sectorId: z.string().uuid(),
  title: z.string().min(1, "Título é obrigatório").max(200),
  category: z.enum(CLAUSE_CATEGORIES).default("general"),
  body: z.string().min(1, "Conteúdo é obrigatório").max(10000),
  isApproved: z.boolean().default(false),
});

export const updateClauseSchema = createClauseSchema.extend({
  id: z.string().uuid(),
});

/** A document uploaded and attached to a contract. */
export const createContractDocumentSchema = z.object({
  contractId: z.string().uuid(),
  filePath: z.string().min(1, "Caminho do arquivo é obrigatório").max(500),
  fileName: z.string().min(1, "Nome do arquivo é obrigatório").max(255),
  fileSize: z.number().int().min(0),
  mimeType: z.string().max(150).optional(),
  docLabel: z.string().max(120).optional(),
});

/** Links a library clause to a contract. */
export const linkClauseSchema = z.object({
  contractId: z.string().uuid(),
  clauseId: z.string().uuid(),
});

export type CreateContractInput = z.infer<typeof createContractSchema>;
export type CreateMatterInput = z.infer<typeof createMatterSchema>;
export type CreateClauseInput = z.infer<typeof createClauseSchema>;
export type CreateContractDocumentInput = z.infer<
  typeof createContractDocumentSchema
>;
export type LinkClauseInput = z.infer<typeof linkClauseSchema>;
