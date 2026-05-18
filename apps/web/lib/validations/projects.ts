import { z } from "zod";

export const projectStatusEnum = z.enum([
  "active",
  "paused",
  "completed",
  "archived",
]);

/** Coarse RYG health signal, independent of the lifecycle `status`. */
export const projectHealthEnum = z.enum([
  "on_track",
  "at_risk",
  "off_track",
]);

export const createProjectSchema = z.object({
  name: z.string().min(1, "Nome obrigatorio").max(100),
  description: z.string().max(2000).optional(),
  status: projectStatusEnum,
  health: projectHealthEnum.optional(),
  statusNote: z.string().max(2000).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  sectorIds: z.array(z.string().uuid()).min(1, "Selecione ao menos um setor"),
});

export const updateProjectSchema = createProjectSchema.partial().extend({
  id: z.string().uuid(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
