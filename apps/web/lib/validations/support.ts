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

export const submitCSATSchema = z.object({
  ticketId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional(),
});

export const createSLARuleSchema = z.object({
  sectorId: z.string().uuid(),
  name: z.string().min(1, "Nome é obrigatório"),
  priority: z.enum(["critical", "high", "medium", "low"]),
  category: z.string().optional(),
  responseTimeHours: z.number().int().min(1),
  resolveTimeHours: z.number().int().min(1),
  businessHoursOnly: z.boolean().default(true),
});

export const createArticleSchema = z.object({
  sectorId: z.string().uuid(),
  title: z.string().min(1, "Título é obrigatório").max(200),
  content: z.string().min(1, "Conteúdo é obrigatório"),
  category: z.string().min(1, "Categoria é obrigatória"),
  tags: z.array(z.string()).default([]),
});

export const createCannedResponseSchema = z.object({
  sectorId: z.string().uuid(),
  title: z.string().min(1, "Título é obrigatório"),
  content: z.string().min(1, "Conteúdo é obrigatório"),
  category: z.string().optional(),
  shortcut: z.string().optional(),
});
