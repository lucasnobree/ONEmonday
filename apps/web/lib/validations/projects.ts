import { z } from "zod";

export const projectStatusEnum = z.enum([
  "active",
  "paused",
  "completed",
  "archived",
]);

export const createProjectSchema = z.object({
  name: z.string().min(1, "Nome obrigatorio").max(100),
  description: z.string().max(2000).optional(),
  status: projectStatusEnum,
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  sectorIds: z.array(z.string().uuid()).min(1, "Selecione ao menos um setor"),
});

export const updateProjectSchema = createProjectSchema.partial().extend({
  id: z.string().uuid(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
