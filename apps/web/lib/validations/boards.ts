import { z } from "zod";

export const createBoardSchema = z.object({
  name: z.string().min(1, "Nome obrigatorio").max(100),
  description: z.string().max(500).optional(),
  visibility: z.enum(["sector", "cross_sector", "global"]),
  sectorIds: z.array(z.string().uuid()).min(1, "Selecione ao menos um setor"),
});

export const updateBoardSchema = createBoardSchema.partial().extend({
  id: z.string().uuid(),
});

export type CreateBoardInput = z.infer<typeof createBoardSchema>;
export type UpdateBoardInput = z.infer<typeof updateBoardSchema>;
