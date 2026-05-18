/**
 * Phase-5 provider-adapter registry — the email-sending capability.
 *
 * Mirrors the messaging `registry.ts` and the finance `finance-registry.ts`:
 * the rest of the app asks this registry for an adapter by provider slug and
 * never imports a vendor class directly, so swapping Resend for SES (or any
 * future ESP) is a registry change rather than an application rewrite
 * (docs/research/migration-architecture.md §1.2a).
 *
 * Email has exactly one default provider today (Resend); the map is the
 * extension point for a second implementation.
 */
import type { EmailAdapter, EmailAdapterConfig } from "./email-types";
import { ResendAdapter } from "./email/resend-adapter";

/** Email (ESP) providers with a registered adapter. */
const EMAIL_FACTORIES: Record<
  string,
  (config: EmailAdapterConfig) => EmailAdapter
> = {
  resend: (config) => new ResendAdapter(config),
};

/** Default email provider slug for the email capability. */
export const DEFAULT_EMAIL_PROVIDER = "resend";

/** True when `slug` has a registered email adapter. */
export function isKnownEmailProvider(slug: string): boolean {
  return slug in EMAIL_FACTORIES;
}

/** All registered email provider slugs. */
export function listEmailProviders(): string[] {
  return Object.keys(EMAIL_FACTORIES);
}

/** Constructs the email adapter for a provider slug. Throws on an unknown slug. */
export function resolveEmailAdapter(
  provider: string,
  config: EmailAdapterConfig
): EmailAdapter {
  const factory = EMAIL_FACTORIES[provider];
  if (!factory) {
    throw new Error(`Provider de e-mail desconhecido: ${provider}`);
  }
  return factory(config);
}
