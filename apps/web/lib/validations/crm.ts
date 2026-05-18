import { z } from "zod";
import { LOST_REASON_CATEGORIES } from "@/lib/crm/lost-reasons";

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
  ownerId: z.string().uuid().optional(),
  value: z.number().min(0).optional(),
  currency: z.string().default("BRL"),
  expectedCloseDate: z.string().optional(),
  winProbability: z.number().int().min(0).max(100).optional(),
  source: z.string().optional(),
});

/** Reassign a deal's owner (the responsible salesperson). */
export const assignDealOwnerSchema = z.object({
  dealId: z.string().uuid(),
  // null clears the owner (deal back to "unassigned").
  ownerId: z.string().uuid().nullable(),
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
  assignedTo: z.string().uuid().optional(),
  durationMin: z.number().int().min(1).optional(),
});

/** Mark a scheduled activity/task as complete (or reopen it). */
export const completeActivitySchema = z.object({
  activityId: z.string().uuid(),
  // false reopens a previously completed task.
  completed: z.boolean(),
});

/** Reschedule a task to a new due date/time. */
export const rescheduleActivitySchema = z.object({
  activityId: z.string().uuid(),
  scheduledAt: z.string().min(1, "Data é obrigatória"),
});

/**
 * Send a WhatsApp message to a contact from the deal/contact detail sheet.
 * The message is delivered through the Phase-1 WhatsApp adapter and logged as
 * an outbound `crm_activities` entry on the deal timeline.
 */
export const sendWhatsappMessageSchema = z
  .object({
    sectorId: z.string().uuid(),
    dealId: z.string().uuid().optional(),
    contactId: z.string().uuid().optional(),
    companyId: z.string().uuid().optional(),
    // E.164-ish: digits, may carry +, spaces, dashes — normalised server-side.
    to: z.string().min(8, "Número de WhatsApp inválido").max(20),
    body: z
      .string()
      .min(1, "Mensagem é obrigatória")
      .max(4096, "Mensagem muito longa"),
  })
  .refine((d) => d.dealId || d.contactId || d.companyId, {
    message: "Vincule a mensagem a um deal, contato ou empresa",
  });

/**
 * Manually log an email exchange against a deal/contact as a `crm_activities`
 * entry. Two-way email *sync* is out of scope — it needs an ESP provider
 * (see docs/research/migration-architecture.md §2.8). This is the manual
 * "log email" form that replaces RD Station CRM's manual email logging.
 */
export const logEmailSchema = z
  .object({
    sectorId: z.string().uuid(),
    dealId: z.string().uuid().optional(),
    contactId: z.string().uuid().optional(),
    companyId: z.string().uuid().optional(),
    direction: z.enum(["inbound", "outbound"]),
    subject: z.string().min(1, "Assunto é obrigatório").max(300),
    body: z.string().min(1, "Conteúdo é obrigatório").max(20000),
    // Optional counterpart address shown in the timeline ("De:" / "Para:").
    counterpartEmail: z.string().email().optional().or(z.literal("")),
  })
  .refine((d) => d.dealId || d.contactId || d.companyId, {
    message: "Vincule o e-mail a um deal, contato ou empresa",
  });

export const createProposalSchema = z.object({
  dealId: z.string().uuid(),
  sectorId: z.string().uuid(),
  title: z.string().min(1, "Título é obrigatório"),
  content: z.string().optional(),
  value: z.number().min(0).optional(),
  expiresAt: z.string().optional(),
});

export const closeDealLostSchema = z.object({
  dealId: z.string().uuid(),
  category: z.enum(LOST_REASON_CATEGORIES),
  reason: z.string().min(1, "Motivo é obrigatório").max(1000),
});

export const stageDefaultSchema = z.object({
  stage_name: z.string().min(1),
  default_probability: z.number().int().min(0).max(100),
  position: z.number().int().min(0),
  rotting_days: z.number().int().min(0).max(365).default(0),
});

// =============================================
// Lead lifecycle — capture forms, leads, conversion
// (migration 00128). Enums mirror the CHECK constraints there.
// =============================================

/** Lead triage statuses — mirrors the crm_leads CHECK in migration 00128. */
export const LEAD_STATUSES = [
  "new",
  "working",
  "qualified",
  "discarded",
] as const;

/** Capture-form field types — the MVP field-list builder's supported inputs. */
export const LEAD_FORM_FIELD_TYPES = [
  "text",
  "email",
  "tel",
  "textarea",
  "select",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];
export type LeadFormFieldType = (typeof LEAD_FORM_FIELD_TYPES)[number];

/** A single field definition inside a capture form's `fields` jsonb array. */
export const leadFormFieldSchema = z
  .object({
    // Stable machine key — becomes the lead `payload` object key.
    key: z
      .string()
      .min(1, "Chave obrigatória")
      .max(60)
      .regex(/^[a-z0-9_]+$/, "Use apenas letras minúsculas, números e _"),
    label: z.string().min(1, "Rótulo obrigatório").max(120),
    type: z.enum(LEAD_FORM_FIELD_TYPES),
    required: z.boolean().default(false),
    // Only meaningful for type 'select'.
    options: z.array(z.string().min(1).max(120)).max(30).optional(),
  })
  .refine((f) => f.type !== "select" || (f.options?.length ?? 0) > 0, {
    message: "Campos do tipo seleção precisam de ao menos uma opção",
    path: ["options"],
  });

export type LeadFormField = z.infer<typeof leadFormFieldSchema>;

/** Create / update a lead-capture form. */
export const leadFormSchema = z.object({
  sectorId: z.string().uuid(),
  name: z.string().min(1, "Nome é obrigatório").max(200),
  description: z.string().max(1000).optional(),
  source: z.string().min(1).max(80).default("form"),
  successMessage: z
    .string()
    .min(1, "Mensagem de sucesso é obrigatória")
    .max(500)
    .default("Obrigado! Recebemos seu contato."),
  isPublished: z.boolean().default(false),
  fields: z
    .array(leadFormFieldSchema)
    .max(30, "Máximo de 30 campos por formulário")
    // Field keys must be unique within a form so the payload object is well-formed.
    .refine(
      (fields) => new Set(fields.map((f) => f.key)).size === fields.length,
      { message: "Cada campo precisa de uma chave única" }
    ),
});

/** Manually create a lead from inside the inbox. */
export const createLeadSchema = z.object({
  sectorId: z.string().uuid(),
  name: z.string().min(1, "Nome é obrigatório").max(200),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  phone: z.string().max(40).optional(),
  company: z.string().max(200).optional(),
  source: z.string().min(1).max(80).default("manual"),
  payload: z.record(z.string(), z.unknown()).optional(),
  ownerId: z.string().uuid().optional(),
});

/** Update a lead's triage fields (status / owner). */
export const updateLeadSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["new", "working"]).optional(),
  ownerId: z.string().uuid().nullable().optional(),
});

/** Discard a lead with a reason. */
export const discardLeadSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().min(1, "Motivo é obrigatório").max(500),
});

/** Qualify a lead -> convert it into a contact + a deal on a pipeline column. */
export const qualifyLeadSchema = z.object({
  id: z.string().uuid(),
  boardId: z.string().uuid(),
  columnId: z.string().uuid(),
  // Optional deal value entered at qualify time.
  value: z.number().min(0).optional(),
  currency: z.string().default("BRL"),
  ownerId: z.string().uuid().optional(),
});

/**
 * A public, unauthenticated form submission. `formToken` addresses the form by
 * its unguessable public token; `values` is the raw key/value map the visitor
 * filled in. Per-field requiredness is validated server-side against the form
 * definition (this schema only enforces shape + anti-abuse limits).
 */
export const publicLeadSubmissionSchema = z.object({
  formToken: z.string().min(16).max(128),
  values: z
    .record(z.string().max(60), z.string().max(5000))
    .refine((v) => Object.keys(v).length <= 40, {
      message: "Excesso de campos",
    }),
  // Honeypot — a hidden field bots fill in; a real human leaves it empty.
  website: z.string().max(0).optional(),
});
