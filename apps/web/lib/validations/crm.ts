import { z } from "zod";

export const createCompanySchema = z.object({
  sectorId: z.string().uuid(),
  name: z.string().min(1, "Nome é obrigatório").max(200),
  domain: z.string().optional(),
  industry: z.string().optional(),
  size: z.enum(["micro", "small", "medium", "large", "enterprise"]).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  notes: z.string().optional(),
  ownerId: z.string().uuid().optional(),
});

export const createContactSchema = z.object({
  sectorId: z.string().uuid(),
  companyId: z.string().uuid().optional(),
  fullName: z.string().min(1, "Nome é obrigatório").max(200),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  position: z.string().optional(),
  isPrimary: z.boolean().default(false),
  ownerId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

export const createDealSchema = z.object({
  sectorId: z.string().uuid(),
  boardId: z.string().uuid(),
  columnId: z.string().uuid(),
  title: z.string().min(1, "Título é obrigatório").max(200),
  description: z.string().optional(),
  priority: z.enum(["critical", "high", "medium", "low"]).default("medium"),
  companyId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  value: z.number().min(0).optional(),
  currency: z.string().default("BRL"),
  expectedCloseDate: z.string().optional(),
  winProbability: z.number().int().min(0).max(100).optional(),
  source: z.string().optional(),
});

export const createActivitySchema = z.object({
  sectorId: z.string().uuid(),
  dealId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  companyId: z.string().uuid().optional(),
  type: z.enum(["call", "email", "meeting", "note", "task"]),
  subject: z.string().min(1, "Assunto é obrigatório"),
  description: z.string().optional(),
  scheduledAt: z.string().optional(),
  durationMin: z.number().int().min(1).optional(),
});

export const createProposalSchema = z.object({
  dealId: z.string().uuid(),
  sectorId: z.string().uuid(),
  title: z.string().min(1, "Título é obrigatório"),
  content: z.string().optional(),
  value: z.number().min(0).optional(),
  expiresAt: z.string().optional(),
});
