import { z } from "zod";

export const createTicketSchema = z.object({
  sectorId: z.string().uuid(),
  boardId: z.string().uuid().optional().or(z.literal("")),
  columnId: z.string().uuid().optional().or(z.literal("")),
  title: z.string().min(1, "Título é obrigatório").max(200),
  description: z.string().optional(),
  priority: z.enum(["critical", "high", "medium", "low"]).default("medium"),
  category: z.string().min(1, "Categoria é obrigatória"),
  subcategory: z.string().optional(),
  channel: z.enum(["internal", "email", "chat", "phone"]).default("internal"),
  requesterId: z.string().uuid().optional(),
  requesterEmail: z.string().email().optional(),
});

export const updateTicketSchema = z.object({
  id: z.string().uuid(),
  category: z.string().optional(),
  subcategory: z.string().optional(),
  channel: z.enum(["internal", "email", "chat", "phone"]).optional(),
});

export const ticketStatusSchema = z.enum([
  "new",
  "open",
  "pending",
  "on_hold",
  "resolved",
]);

export const updateTicketStatusSchema = z.object({
  ticketId: z.string().uuid(),
  status: ticketStatusSchema,
});

// Bulk status update — capped to keep a single request bounded, matching the
// Zendesk-style bulk-triage workflow the queue exposes.
export const bulkUpdateTicketStatusSchema = z.object({
  ticketIds: z.array(z.string().uuid()).min(1).max(100),
  status: ticketStatusSchema,
});

export const createTicketAttachmentSchema = z.object({
  ticketId: z.string().uuid(),
  filePath: z.string().min(1),
  fileName: z.string().min(1).max(255),
  fileSize: z.number().int().min(0),
  mimeType: z.string().optional(),
});

export const submitCSATSchema = z.object({
  ticketId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional(),
});

// Ticket reply — internal note vs public reply. A public reply on an
// email-channel ticket is delivered to the requester via the ESP.
export const ticketMessageVisibilitySchema = z.enum(["internal", "public"]);

export const addTicketMessageSchema = z.object({
  ticketId: z.string().uuid(),
  visibility: ticketMessageVisibilitySchema,
  body: z.string().min(1, "Mensagem obrigatória").max(5000),
});

// SLA breach action vocabulary, mirroring migration 00196.
export const slaBreachActionSchema = z.enum(["none", "notify", "escalate"]);

export const createSLARuleSchema = z.object({
  sectorId: z.string().uuid(),
  name: z.string().min(1, "Nome é obrigatório"),
  priority: z.enum(["critical", "high", "medium", "low"]),
  category: z.string().optional(),
  responseTimeHours: z.number().int().min(1),
  resolveTimeHours: z.number().int().min(1),
  businessHoursOnly: z.boolean().default(true),
  isActive: z.boolean().default(true),
  // Business-hours schedule (Wave 5). Defaulted so older callers keep working.
  businessTimezone: z.string().min(1).default("America/Sao_Paulo"),
  businessStartMinute: z.number().int().min(0).max(1439).default(540),
  businessEndMinute: z.number().int().min(1).max(1440).default(1080),
  businessDaysMask: z.number().int().min(0).max(127).default(62),
  // Breach escalation action + warn threshold.
  breachAction: slaBreachActionSchema.default("none"),
  warnThresholdPct: z.number().int().min(1).max(100).default(80),
});

export const createArticleSchema = z.object({
  sectorId: z.string().uuid(),
  title: z.string().min(1, "Título é obrigatório").max(200),
  content: z.string().min(1, "Conteúdo é obrigatório"),
  category: z.string().min(1, "Categoria é obrigatória"),
  tags: z.array(z.string()).default([]),
  isPublished: z.boolean().default(false),
});

export const createCannedResponseSchema = z.object({
  sectorId: z.string().uuid(),
  title: z.string().min(1, "Título é obrigatório").max(200),
  content: z.string().min(1, "Conteúdo é obrigatório"),
  category: z.string().optional(),
  shortcut: z.string().optional(),
});

export const createTagSchema = z.object({
  sectorId: z.string().uuid(),
  name: z
    .string()
    .min(1, "Nome é obrigatório")
    .max(40, "Nome muito longo")
    .transform((v) => v.trim().toLowerCase()),
  color: z
    .enum(["gray", "red", "orange", "yellow", "green", "blue", "purple"])
    .default("gray"),
});

export const tagAssignmentSchema = z.object({
  ticketId: z.string().uuid(),
  tagId: z.string().uuid(),
});
