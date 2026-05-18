import { z } from "zod";

/**
 * Integration-layer validation schemas — must mirror the CHECK constraints in
 * migrations 00101-00103.
 */

/** Provider slugs with a Phase-1 outbound adapter. */
export const INTEGRATION_PROVIDERS = ["teams", "whatsapp"] as const;

/** Logical capabilities (mirrors integration_credentials.capability). */
export const INTEGRATION_CAPABILITIES = [
  "messaging",
  "email",
  "fiscal",
  "banking",
  "payments",
  "payroll",
  "timeclock",
] as const;

/** Outbound channels with a dispatch adapter. */
export const INTEGRATION_CHANNELS = ["teams", "whatsapp", "in_app"] as const;

export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number];
export type IntegrationCapability = (typeof INTEGRATION_CAPABILITIES)[number];

const uuid = z.string().uuid("ID invalido");

/**
 * Per-provider secret shapes. The secret object is encrypted as a whole before
 * it ever reaches the DB (see lib/integrations/crypto.ts). Each field is
 * optional so a credential can be created "configured but no secret yet".
 */
const teamsSecretSchema = z.object({
  webhookUrl: z
    .string()
    .url("URL do webhook do Teams invalida")
    .optional()
    .or(z.literal("")),
});

const whatsappSecretSchema = z.object({
  accessToken: z.string().optional().or(z.literal("")),
  phoneNumberId: z.string().optional().or(z.literal("")),
});

/** Discriminated secret payload, validated against the chosen provider. */
export function secretSchemaForProvider(provider: IntegrationProvider) {
  return provider === "teams" ? teamsSecretSchema : whatsappSecretSchema;
}

/** Create / upsert an integration credential. */
export const upsertCredentialSchema = z.object({
  // null sectorId = a global credential.
  sectorId: uuid.nullable(),
  provider: z.enum(INTEGRATION_PROVIDERS),
  capability: z.enum(INTEGRATION_CAPABILITIES).default("messaging"),
  isEnabled: z.boolean().default(true),
  /** Raw, plaintext secret object — encrypted by the server action. */
  secret: z.record(z.string(), z.string()).optional(),
  /** Non-secret config (template name, api version, ...). */
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type UpsertCredentialInput = z.infer<typeof upsertCredentialSchema>;

/** Delete (soft) an integration credential. */
export const deleteCredentialSchema = z.object({ id: uuid });

/** Create an event-to-channel routing rule. */
export const upsertRouteSchema = z.object({
  sectorId: uuid.nullable(),
  eventType: z
    .string()
    .min(1, "Tipo de evento obrigatorio")
    .max(80, "Tipo de evento muito longo"),
  channel: z.enum(INTEGRATION_CHANNELS),
  isEnabled: z.boolean().default(true),
});

export type UpsertRouteInput = z.infer<typeof upsertRouteSchema>;

/** Delete a routing rule. */
export const deleteRouteSchema = z.object({ id: uuid });

/** Enqueue an outbound dispatch for an event. */
export const enqueueDispatchSchema = z.object({
  sectorId: uuid.nullable(),
  eventType: z.string().min(1).max(80),
  title: z.string().min(1, "Titulo obrigatorio").max(200),
  body: z.string().max(4000).default(""),
  url: z.string().url().optional(),
  /** WhatsApp E.164 target — required only for the whatsapp channel. */
  target: z.string().max(40).optional(),
});

export type EnqueueDispatchInput = z.infer<typeof enqueueDispatchSchema>;
