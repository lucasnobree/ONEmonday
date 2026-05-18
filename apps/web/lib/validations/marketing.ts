import { z } from "zod";

/**
 * Marketing enums — must mirror the CHECK constraints in migration 00090.
 */
export const MARKETING_CHANNELS = [
  "email",
  "social",
  "paid_ads",
  "content",
  "event",
  "seo",
  "other",
] as const;

export const CAMPAIGN_STATUSES = [
  "draft",
  "scheduled",
  "active",
  "paused",
  "completed",
  "cancelled",
] as const;

export const CONTENT_STATUSES = [
  "idea",
  "draft",
  "scheduled",
  "published",
  "cancelled",
] as const;

export type MarketingChannel = (typeof MARKETING_CHANNELS)[number];
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");

/**
 * Monetary amount in integer cents. The UI parses user input to cents via
 * `lib/finance/money.parseCents` before it reaches a schema. Non-negative,
 * integer, with a sane upper bound to reject typos / overflow.
 */
const amountCentsSchema = z
  .number()
  .int("Valor deve ser um número inteiro de centavos")
  .min(0, "Valor não pode ser negativo")
  .max(99_999_999_999, "Valor muito alto");

/** Non-negative integer counter (impressions, leads, conversions, audience). */
const countSchema = z
  .number()
  .int("Deve ser um número inteiro")
  .min(0, "Não pode ser negativo")
  .max(9_999_999_999, "Valor muito alto");

// =============================================
// Campaigns
// =============================================
const campaignFields = {
  name: z.string().min(1, "Nome é obrigatório").max(200),
  description: z.string().max(2000).optional(),
  channel: z.enum(MARKETING_CHANNELS),
  status: z.enum(CAMPAIGN_STATUSES),
  budgetCents: amountCentsSchema,
  spendCents: amountCentsSchema,
  impressions: countSchema,
  leads: countSchema,
  conversions: countSchema,
  startDate: isoDateSchema,
  endDate: isoDateSchema.optional().nullable(),
};

export const createCampaignSchema = z
  .object({
    sectorId: z.string().uuid(),
    ...campaignFields,
  })
  .refine((v) => !v.endDate || v.endDate >= v.startDate, {
    message: "Fim não pode ser anterior ao início",
    path: ["endDate"],
  });

export const updateCampaignSchema = z
  .object({
    id: z.string().uuid(),
    ...campaignFields,
  })
  .refine((v) => !v.endDate || v.endDate >= v.startDate, {
    message: "Fim não pode ser anterior ao início",
    path: ["endDate"],
  });

// =============================================
// Content calendar items
// =============================================
const contentFields = {
  title: z.string().min(1, "Título é obrigatório").max(200),
  notes: z.string().max(2000).optional(),
  channel: z.enum(MARKETING_CHANNELS),
  status: z.enum(CONTENT_STATUSES),
  scheduledDate: isoDateSchema,
  campaignId: z.string().uuid().optional().nullable(),
};

export const createContentItemSchema = z.object({
  sectorId: z.string().uuid(),
  ...contentFields,
});

export const updateContentItemSchema = z.object({
  id: z.string().uuid(),
  ...contentFields,
});

// =============================================
// Audience segments
// =============================================
const segmentFields = {
  name: z.string().min(1, "Nome é obrigatório").max(200),
  description: z.string().max(2000).optional(),
  channel: z.enum(MARKETING_CHANNELS),
  estimatedSize: countSchema,
};

export const createSegmentSchema = z.object({
  sectorId: z.string().uuid(),
  ...segmentFields,
});

export const updateSegmentSchema = z.object({
  id: z.string().uuid(),
  ...segmentFields,
});

// =============================================
// Audience-segment contacts — Wave 5 (W2: send to the attached segment)
// Mirrors the CHECK constraints in migration 00206.
// =============================================
const segmentEmailSchema = z.string().email("E-mail inválido").max(320);

/** A single contact added to an audience segment. */
export const segmentContactSchema = z.object({
  email: segmentEmailSchema,
  name: z.string().max(200).optional().nullable(),
});

/** Replace the full contact list of a segment in one call. */
export const saveSegmentContactsSchema = z.object({
  segmentId: z.string().uuid("ID inválido"),
  contacts: z
    .array(segmentContactSchema)
    .max(5000, "Lista de contatos muito longa"),
});

export type SegmentContactInput = z.infer<typeof segmentContactSchema>;

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type CreateContentItemInput = z.infer<typeof createContentItemSchema>;
export type CreateSegmentInput = z.infer<typeof createSegmentSchema>;

// =============================================
// Email campaigns — Phase 5 marketing automation
// Must mirror the CHECK constraints in migration 00114.
// =============================================
export const EMAIL_CAMPAIGN_STATUSES = [
  "draft",
  "scheduled",
  "sending",
  "sent",
  "cancelled",
] as const;

export type EmailCampaignStatus = (typeof EMAIL_CAMPAIGN_STATUSES)[number];

const uuidSchema = z.string().uuid("ID inválido");
const emailSchema = z.string().email("E-mail inválido").max(320);

const emailCampaignFields = {
  name: z.string().min(1, "Nome é obrigatório").max(200),
  subject: z.string().min(1, "Assunto é obrigatório").max(300),
  fromName: z.string().min(1, "Nome do remetente é obrigatório").max(120),
  fromEmail: emailSchema,
  replyTo: emailSchema.optional().nullable(),
  bodyHtml: z.string().max(100_000).default(""),
  bodyText: z.string().max(50_000).default(""),
  campaignId: uuidSchema.optional().nullable(),
  segmentId: uuidSchema.optional().nullable(),
};

export const createEmailCampaignSchema = z.object({
  sectorId: uuidSchema,
  ...emailCampaignFields,
});

export const updateEmailCampaignSchema = z.object({
  id: uuidSchema,
  ...emailCampaignFields,
});

/** A recipient row supplied to a manual send. */
export const emailRecipientSchema = z.object({
  email: emailSchema,
  name: z.string().max(200).optional(),
});

/**
 * Send an email campaign.
 *
 * Two recipient sources, exactly one must be supplied:
 *  - `source: "segment"` — the server resolves recipients from the campaign's
 *    attached audience segment (W2). No `recipients` array is sent.
 *  - `source: "manual"` — an explicit hand-typed recipient list (fallback).
 */
export const sendEmailCampaignSchema = z
  .object({
    emailCampaignId: uuidSchema,
    source: z.enum(["segment", "manual"]).default("manual"),
    recipients: z
      .array(emailRecipientSchema)
      .max(5000, "Lista de destinatários muito longa")
      .default([]),
  })
  .refine((v) => v.source !== "manual" || v.recipients.length > 0, {
    message: "Informe ao menos um destinatário",
    path: ["recipients"],
  });

/** Send a single preview ("test") email of a campaign to one recipient. */
export const sendEmailCampaignTestSchema = z.object({
  emailCampaignId: uuidSchema,
  recipient: emailRecipientSchema,
});

// =============================================
// Automation sequences — Phase 5 marketing automation
// =============================================
export const SEQUENCE_TRIGGERS = ["segment_entry", "manual"] as const;
export const SEQUENCE_STATUSES = ["draft", "active", "paused"] as const;
export const SEQUENCE_STEP_TYPES = ["wait", "send_email"] as const;

export type SequenceTrigger = (typeof SEQUENCE_TRIGGERS)[number];
export type SequenceStatus = (typeof SEQUENCE_STATUSES)[number];
export type SequenceStepType = (typeof SEQUENCE_STEP_TYPES)[number];

const sequenceFields = {
  name: z.string().min(1, "Nome é obrigatório").max(200),
  description: z.string().max(2000).optional(),
  triggerType: z.enum(SEQUENCE_TRIGGERS),
  segmentId: uuidSchema.optional().nullable(),
  status: z.enum(SEQUENCE_STATUSES),
};

export const createSequenceSchema = z.object({
  sectorId: uuidSchema,
  ...sequenceFields,
});

export const updateSequenceSchema = z.object({
  id: uuidSchema,
  ...sequenceFields,
});

/**
 * One step in a sequence. A `wait` step uses `waitDays`; a `send_email` step
 * uses `emailCampaignId`. Cross-field rules are enforced by `.refine`.
 */
export const sequenceStepSchema = z
  .object({
    stepOrder: z.number().int().min(0).max(100),
    stepType: z.enum(SEQUENCE_STEP_TYPES),
    waitDays: z.number().int().min(0).max(365).default(0),
    emailCampaignId: uuidSchema.optional().nullable(),
  })
  .refine(
    (v) => v.stepType !== "send_email" || !!v.emailCampaignId,
    {
      message: "Passo de e-mail exige uma campanha de e-mail",
      path: ["emailCampaignId"],
    }
  )
  .refine((v) => v.stepType !== "wait" || v.waitDays >= 1, {
    message: "Passo de espera exige ao menos 1 dia",
    path: ["waitDays"],
  });

/** Replace the full ordered step list of a sequence in one call. */
export const saveSequenceStepsSchema = z.object({
  sequenceId: uuidSchema,
  steps: z
    .array(sequenceStepSchema)
    .max(50, "Sequência muito longa"),
});

/** Manually enroll a recipient into a sequence (for testing / ad-hoc use). */
export const enrollInSequenceSchema = z.object({
  sequenceId: uuidSchema,
  recipientEmail: emailSchema,
  recipientName: z.string().max(200).optional(),
});

export type CreateEmailCampaignInput = z.infer<
  typeof createEmailCampaignSchema
>;
export type SendEmailCampaignInput = z.infer<typeof sendEmailCampaignSchema>;
export type SendEmailCampaignTestInput = z.infer<
  typeof sendEmailCampaignTestSchema
>;
export type CreateSequenceInput = z.infer<typeof createSequenceSchema>;
export type SequenceStepInput = z.infer<typeof sequenceStepSchema>;
