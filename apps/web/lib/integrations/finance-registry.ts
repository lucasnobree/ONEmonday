/**
 * Phase-4 provider-adapter registry — fiscal, banking and payment gateways.
 *
 * Mirrors the messaging `registry.ts`: the rest of the app asks this registry
 * for an adapter by provider slug and never imports a vendor class directly, so
 * swapping Focus NFe for PlugNotas, or Pluggy for Belvo, is a registry change
 * rather than an application rewrite (migration-architecture.md §1.2a).
 *
 * Each capability has exactly one default provider today; the maps are the
 * extension point for a second implementation.
 */
import type {
  BankingAdapter,
  FinanceAdapterConfig,
  FiscalAdapter,
  PaymentAdapter,
} from "./finance-types";
import { FocusNfeAdapter } from "./fiscal/focus-nfe-adapter";
import { PluggyAdapter } from "./banking/pluggy-adapter";
import { AsaasAdapter } from "./payments/asaas-adapter";

/** Fiscal-emission providers with a registered adapter. */
const FISCAL_FACTORIES: Record<
  string,
  (config: FinanceAdapterConfig) => FiscalAdapter
> = {
  focus_nfe: (config) => new FocusNfeAdapter(config),
};

/** Banking (Open Finance) providers with a registered adapter. */
const BANKING_FACTORIES: Record<
  string,
  (config: FinanceAdapterConfig) => BankingAdapter
> = {
  pluggy: (config) => new PluggyAdapter(config),
};

/** Payment (PSP) providers with a registered adapter. */
const PAYMENT_FACTORIES: Record<
  string,
  (config: FinanceAdapterConfig) => PaymentAdapter
> = {
  asaas: (config) => new AsaasAdapter(config),
};

/** Default provider slug for each Phase-4 capability. */
export const DEFAULT_FISCAL_PROVIDER = "focus_nfe";
export const DEFAULT_BANKING_PROVIDER = "pluggy";
export const DEFAULT_PAYMENT_PROVIDER = "asaas";

/** Constructs the fiscal adapter for a provider slug. Throws on unknown slug. */
export function resolveFiscalAdapter(
  provider: string,
  config: FinanceAdapterConfig
): FiscalAdapter {
  const factory = FISCAL_FACTORIES[provider];
  if (!factory) {
    throw new Error(`Provider fiscal desconhecido: ${provider}`);
  }
  return factory(config);
}

/** Constructs the banking adapter for a provider slug. Throws on unknown slug. */
export function resolveBankingAdapter(
  provider: string,
  config: FinanceAdapterConfig
): BankingAdapter {
  const factory = BANKING_FACTORIES[provider];
  if (!factory) {
    throw new Error(`Provider bancario desconhecido: ${provider}`);
  }
  return factory(config);
}

/** Constructs the payment adapter for a provider slug. Throws on unknown slug. */
export function resolvePaymentAdapter(
  provider: string,
  config: FinanceAdapterConfig
): PaymentAdapter {
  const factory = PAYMENT_FACTORIES[provider];
  if (!factory) {
    throw new Error(`Provider de pagamento desconhecido: ${provider}`);
  }
  return factory(config);
}

/** True when `slug` has a registered fiscal adapter. */
export function isKnownFiscalProvider(slug: string): boolean {
  return slug in FISCAL_FACTORIES;
}

/** True when `slug` has a registered banking adapter. */
export function isKnownBankingProvider(slug: string): boolean {
  return slug in BANKING_FACTORIES;
}

/** True when `slug` has a registered payment adapter. */
export function isKnownPaymentProvider(slug: string): boolean {
  return slug in PAYMENT_FACTORIES;
}
