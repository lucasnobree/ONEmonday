/**
 * Integration-layer contracts for Phase 4 — fiscal, banking and payment
 * gateways (docs/research/migration-architecture.md §1.2, §2.9).
 *
 * Phase 1 (`types.ts`) defined the messaging contracts. Phase 4 extends the
 * same provider-adapter pattern to three new capabilities, each backing one
 * regulated sub-capability of Omie:
 *
 *   * `FiscalAdapter`  — NF-e / NFS-e emission (Focus NFe).
 *   * `BankingAdapter` — Open Finance transaction sync (Pluggy).
 *   * `PaymentAdapter` — boleto / PIX charge issuance (Asaas).
 *
 * Every adapter:
 *   * takes an injected {@link FetchTransport} so it is fully unit-testable;
 *   * runs in a safe no-op mode when unconfigured — there are no real provider
 *     accounts, certificates or SEFAZ access in dev, and nothing may crash
 *     without them. A no-op call returns a soft result flagged `noop: true`.
 *
 * Fiscal/legal liability never moves to ONEmonday: these adapters are plumbing
 * for a certified gateway; the company + accountant stay responsible
 * (migration-architecture.md §3, §6).
 */
import type { AdapterConfig } from "./types";

export type { AdapterConfig, FetchTransport } from "./types";

// =============================================
// Fiscal — NF-e / NFS-e emission
// =============================================

/** Fiscal document kinds an adapter can request. */
export type FiscalDocType = "nfe" | "nfse";

/** A fiscal-emission request — provider-agnostic. */
export interface FiscalEmissionRequest {
  /** Idempotency key — the same reference never double-emits. */
  reference: string;
  docType: FiscalDocType;
  /** Total document amount in integer cents. */
  amountCents: number;
  /** Service / product description that appears on the document. */
  description: string;
  /** Taker (customer) display name. */
  customerName: string;
  /** Taker tax id (CNPJ/CPF) — optional in dev; required for real emission. */
  customerTaxId?: string;
}

/** Lifecycle status reported by a fiscal gateway. */
export type FiscalStatus =
  | "processing"
  | "authorized"
  | "rejected"
  | "cancelled"
  | "error";

/** Outcome of a fiscal emission — never throws for expected failures. */
export interface FiscalEmissionResult {
  ok: boolean;
  status: FiscalStatus;
  /** Gateway-side document id. */
  providerRef?: string;
  /** SEFAZ/prefeitura protocol once authorised. */
  protocol?: string;
  accessKey?: string;
  pdfUrl?: string;
  xmlUrl?: string;
  /** Human-readable reason on rejection / error. */
  reason?: string;
  /** True when the adapter ran in no-op mode (unconfigured). */
  noop?: boolean;
}

/** The contract every fiscal-emission provider implements. */
export interface FiscalAdapter {
  readonly provider: string;
  /** True when the adapter holds real credentials and can actually emit. */
  isConfigured(): boolean;
  /** Requests emission of a fiscal document. Resolves; never throws. */
  emit(request: FiscalEmissionRequest): Promise<FiscalEmissionResult>;
}

// =============================================
// Banking — Open Finance transaction sync
// =============================================

/** A bank transaction as normalised from any banking provider / OFX file. */
export interface BankTransaction {
  /** Provider-side / OFX FITID — the dedup key. */
  externalId: string;
  direction: "credit" | "debit";
  /** Amount in integer cents — always positive; `direction` carries the sign. */
  amountCents: number;
  currency: string;
  /** Value date, `YYYY-MM-DD`. */
  postedDate: string;
  description: string;
  accountLabel?: string;
}

/** Outcome of a banking transaction pull. */
export interface BankSyncResult {
  ok: boolean;
  transactions: BankTransaction[];
  error?: string;
  noop?: boolean;
}

/** The contract every banking (Open Finance) provider implements. */
export interface BankingAdapter {
  readonly provider: string;
  isConfigured(): boolean;
  /**
   * Pulls transactions for an account between [from, to] (`YYYY-MM-DD`).
   * Resolves to a {@link BankSyncResult}; never throws.
   */
  fetchTransactions(
    accountId: string,
    from: string,
    to: string
  ): Promise<BankSyncResult>;
}

// =============================================
// Payments — boleto / PIX issuance
// =============================================

/** Billing methods a PSP can issue. */
export type ChargeBillingType = "pix" | "boleto" | "undefined";

/** A charge-creation request — provider-agnostic. */
export interface ChargeRequest {
  /** Idempotency key — the same reference never double-charges. */
  reference: string;
  billingType: ChargeBillingType;
  amountCents: number;
  currency: string;
  /** Due date, `YYYY-MM-DD`. */
  dueDate: string;
  customerName: string;
  description: string;
}

/** Lifecycle status reported by a PSP. */
export type ChargeStatus =
  | "pending"
  | "received"
  | "overdue"
  | "cancelled"
  | "error";

/** Outcome of a charge creation — never throws for expected failures. */
export interface ChargeResult {
  ok: boolean;
  status: ChargeStatus;
  providerRef?: string;
  /** Boleto digitable line, when a boleto was issued. */
  boletoLine?: string;
  /** PIX copy-paste payload, when a PIX charge was issued. */
  pixPayload?: string;
  /** Hosted invoice / boleto URL. */
  invoiceUrl?: string;
  reason?: string;
  noop?: boolean;
}

/** The contract every payment (PSP) provider implements. */
export interface PaymentAdapter {
  readonly provider: string;
  isConfigured(): boolean;
  /** Creates a boleto / PIX charge. Resolves; never throws. */
  createCharge(request: ChargeRequest): Promise<ChargeResult>;
}

/** Re-export so adapter modules import a single config shape. */
export type FinanceAdapterConfig = AdapterConfig;
