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
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data invalida");

/**
 * Monetary amount in integer cents. The UI parses user input to cents via
 * `lib/finance/money.parseCents` before it reaches a schema. Non-negative,
 * integer, with a sane upper bound to reject typos / overflow.
 */
const amountCentsSchema = z
  .number()
  .int("Valor deve ser um numero inteiro de centavos")
  .min(0, "Valor nao pode ser negativo")
  .max(99_999_999_999, "Valor muito alto");

/** Non-negative integer counter (impressions, leads, conversions, audience). */
const countSchema = z
  .number()
  .int("Deve ser um numero inteiro")
  .min(0, "Nao pode ser negativo")
  .max(9_999_999_999, "Valor muito alto");

// =============================================
// Campaigns
// =============================================
const campaignFields = {
  name: z.string().min(1, "Nome e obrigatorio").max(200),
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
    message: "Fim nao pode ser anterior ao inicio",
    path: ["endDate"],
  });

export const updateCampaignSchema = z
  .object({
    id: z.string().uuid(),
    ...campaignFields,
  })
  .refine((v) => !v.endDate || v.endDate >= v.startDate, {
    message: "Fim nao pode ser anterior ao inicio",
    path: ["endDate"],
  });

// =============================================
// Content calendar items
// =============================================
const contentFields = {
  title: z.string().min(1, "Titulo e obrigatorio").max(200),
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
  name: z.string().min(1, "Nome e obrigatorio").max(200),
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

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type CreateContentItemInput = z.infer<typeof createContentItemSchema>;
export type CreateSegmentInput = z.infer<typeof createSegmentSchema>;
