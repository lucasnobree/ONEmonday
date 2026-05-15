import { z } from "zod";

export const createCardSchema = z.object({
  title: z.string().min(1, "Titulo obrigatorio").max(200),
  description: z.string().max(5000).optional(),
  priority: z.enum(["critical", "high", "medium", "low"]).default("medium"),
  columnId: z.string().uuid(),
  boardId: z.string().uuid(),
  sectorId: z.string().uuid(),
  assigneeIds: z.array(z.string().uuid()).optional(),
  dueDate: z.string().optional(),
});

export const updateCardSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1, "Titulo obrigatorio").max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  priority: z.enum(["critical", "high", "medium", "low"]).optional(),
  dueDate: z.string().nullable().optional(),
});

export const setCardTagsSchema = z.object({
  cardId: z.string().uuid(),
  tagIds: z
    .array(z.string().uuid())
    .refine((ids) => new Set(ids).size === ids.length, "tagIds duplicados"),
});

export type SetCardTagsInput = z.infer<typeof setCardTagsSchema>;

export const reorderCardsSchema = z.object({
  boardId: z.string().uuid(),
  columnId: z.string().uuid(),
  cardPositions: z.array(
    z.object({
      card_id: z.string().uuid(),
      position: z.number().int().min(0),
    })
  ),
  expectedBoardUpdatedAt: z.string(),
});

export type CreateCardInput = z.infer<typeof createCardSchema>;
export type UpdateCardInput = z.infer<typeof updateCardSchema>;
export type ReorderCardsInput = z.infer<typeof reorderCardsSchema>;
