/**
 * Provider-adapter registry.
 *
 * Resolves a `(channel | provider)` plus an {@link AdapterConfig} into a
 * concrete {@link ChannelAdapter}. The rest of the app asks the registry for
 * an adapter and never imports a vendor class directly — swapping a provider
 * is a config/registry change, not an application rewrite
 * (docs/research/migration-architecture.md §1.2a).
 */
import type {
  AdapterConfig,
  ChannelAdapter,
  IntegrationChannel,
  ProviderSlug,
} from "./types";
import { TeamsAdapter } from "./messaging/teams-adapter";
import { WhatsAppAdapter } from "./messaging/whatsapp-adapter";

/** Factory signature — every adapter is constructed from an AdapterConfig. */
type AdapterFactory = (config: AdapterConfig) => ChannelAdapter;

/** All provider slugs registered with a Phase-1 outbound adapter. */
const ADAPTER_FACTORIES: Record<ProviderSlug, AdapterFactory> = {
  teams: (config) => new TeamsAdapter(config),
  whatsapp: (config) => new WhatsAppAdapter(config),
};

/** Maps an outbound channel to the provider slug that serves it. */
const CHANNEL_PROVIDER: Record<
  Exclude<IntegrationChannel, "in_app">,
  ProviderSlug
> = {
  teams: "teams",
  whatsapp: "whatsapp",
};

/** True when `slug` has a registered adapter. */
export function isKnownProvider(slug: string): slug is ProviderSlug {
  return slug in ADAPTER_FACTORIES;
}

/** All registered provider slugs — drives the Settings UI provider list. */
export function listProviders(): ProviderSlug[] {
  return Object.keys(ADAPTER_FACTORIES) as ProviderSlug[];
}

/** Constructs the adapter for a provider slug. Throws on an unknown slug. */
export function resolveProvider(
  provider: string,
  config: AdapterConfig
): ChannelAdapter {
  if (!isKnownProvider(provider)) {
    throw new Error(`Provider de integracao desconhecido: ${provider}`);
  }
  return ADAPTER_FACTORIES[provider](config);
}

/**
 * Constructs the adapter for an outbound channel. `in_app` has no external
 * adapter (it is the existing native notifications path) and throws here.
 */
export function resolveChannel(
  channel: IntegrationChannel,
  config: AdapterConfig
): ChannelAdapter {
  if (channel === "in_app") {
    throw new Error("O canal in_app nao usa um adapter de integracao");
  }
  return resolveProvider(CHANNEL_PROVIDER[channel], config);
}
