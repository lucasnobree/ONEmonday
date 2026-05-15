import { z } from "zod";

/** Allowed enum values, shared between schemas, actions and the UI. */
export const ENVIRONMENTS = [
  "production",
  "staging",
  "development",
] as const;

export const SERVICE_CRITICALITIES = [
  "critical",
  "high",
  "medium",
  "low",
] as const;

export const SERVICE_HEALTH_STATES = [
  "operational",
  "degraded",
  "partial_outage",
  "major_outage",
] as const;

export const INCIDENT_SEVERITIES = ["sev1", "sev2", "sev3", "sev4"] as const;

export const INCIDENT_STATUSES = [
  "investigating",
  "identified",
  "monitoring",
  "resolved",
] as const;

export const DEPLOYMENT_STATUSES = [
  "pending",
  "succeeded",
  "failed",
  "rolled_back",
] as const;

/** Lowercase letters, digits and dashes — used for service + flag keys. */
const slugLike = z
  .string()
  .min(1)
  .max(80)
  .regex(
    /^[a-z0-9][a-z0-9-]*$/,
    "Use apenas letras minúsculas, números e hífens"
  );

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------
const serviceBaseSchema = z.object({
  sectorId: z.string().uuid(),
  name: z.string().min(1, "Nome é obrigatório").max(120),
  slug: slugLike,
  description: z.string().max(2000).optional(),
  environment: z.enum(ENVIRONMENTS).default("production"),
  criticality: z.enum(SERVICE_CRITICALITIES).default("medium"),
  health: z.enum(SERVICE_HEALTH_STATES).default("operational"),
  repositoryUrl: z
    .string()
    .url("URL inválida")
    .max(500)
    .optional()
    .or(z.literal("")),
});

export const createServiceSchema = serviceBaseSchema;
export const updateServiceSchema = serviceBaseSchema.extend({
  id: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// Incidents
// ---------------------------------------------------------------------------
const incidentBaseSchema = z.object({
  sectorId: z.string().uuid(),
  serviceId: z.string().uuid().optional(),
  title: z.string().min(1, "Título é obrigatório").max(200),
  description: z.string().max(5000).optional(),
  severity: z.enum(INCIDENT_SEVERITIES).default("sev3"),
  status: z.enum(INCIDENT_STATUSES).default("investigating"),
  assignedTo: z.string().uuid().optional(),
});

export const createIncidentSchema = incidentBaseSchema;
export const updateIncidentSchema = incidentBaseSchema.extend({
  id: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// Deployments
// ---------------------------------------------------------------------------
export const createDeploymentSchema = z.object({
  sectorId: z.string().uuid(),
  serviceId: z.string().uuid(),
  version: z.string().min(1, "Versão é obrigatória").max(80),
  environment: z.enum(ENVIRONMENTS).default("production"),
  status: z.enum(DEPLOYMENT_STATUSES).default("succeeded"),
  notes: z.string().max(2000).optional(),
});

export const updateDeploymentSchema = createDeploymentSchema.extend({
  id: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// Feature flags
// ---------------------------------------------------------------------------
const flagBaseSchema = z.object({
  sectorId: z.string().uuid(),
  serviceId: z.string().uuid().optional(),
  key: slugLike,
  description: z.string().max(2000).optional(),
  environment: z.enum(ENVIRONMENTS).default("production"),
  isEnabled: z.boolean().default(false),
  rolloutPercentage: z.number().int().min(0).max(100).default(0),
  ownerId: z.string().uuid().optional(),
});

export const createFeatureFlagSchema = flagBaseSchema;
export const updateFeatureFlagSchema = flagBaseSchema.extend({
  id: z.string().uuid(),
});

export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type CreateIncidentInput = z.infer<typeof createIncidentSchema>;
export type CreateDeploymentInput = z.infer<typeof createDeploymentSchema>;
export type CreateFeatureFlagInput = z.infer<typeof createFeatureFlagSchema>;
