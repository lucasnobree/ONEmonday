import { z } from "zod";

export const escalateCardSchema = z.object({
  sourceCardId: z.string().uuid(),
  targetSectorId: z.string().uuid(),
  targetBoardId: z.string().uuid(),
  referenceType: z.enum(["escalation", "related", "blocks", "blocked_by"]),
  note: z.string().max(1000).optional(),
});

export type EscalateCardInput = z.infer<typeof escalateCardSchema>;
