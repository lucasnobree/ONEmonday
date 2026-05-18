import { z } from "zod";

/** A hex colour like `#3b82f6`. Columns store an optional hex string. */
const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida");

export const createBoardColumnSchema = z.object({
  boardId: z.string().uuid(),
  name: z.string().min(1, "Nome obrigatório").max(60),
  color: hexColor.optional(),
  // 1..999 keeps a WIP limit a sane positive integer; null clears it.
  wipLimit: z.number().int().min(1).max(999).nullable().optional(),
  isDoneColumn: z.boolean().optional(),
});

export const updateBoardColumnSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, "Nome obrigatório").max(60).optional(),
  color: hexColor.nullable().optional(),
  wipLimit: z.number().int().min(1).max(999).nullable().optional(),
  isDoneColumn: z.boolean().optional(),
});

export const reorderBoardColumnsSchema = z.object({
  boardId: z.string().uuid(),
  columnIds: z.array(z.string().uuid()).min(1),
});

export type CreateBoardColumnInput = z.infer<typeof createBoardColumnSchema>;
export type UpdateBoardColumnInput = z.infer<typeof updateBoardColumnSchema>;
export type ReorderBoardColumnsInput = z.infer<
  typeof reorderBoardColumnsSchema
>;

/** Preset colours offered by the column-management UI. */
export const COLUMN_COLOR_PRESETS = [
  { value: "#94a3b8", label: "Cinza" },
  { value: "#3b82f6", label: "Azul" },
  { value: "#22c55e", label: "Verde" },
  { value: "#f59e0b", label: "Âmbar" },
  { value: "#ef4444", label: "Vermelho" },
  { value: "#a855f7", label: "Roxo" },
  { value: "#ec4899", label: "Rosa" },
  { value: "#14b8a6", label: "Turquesa" },
] as const;
