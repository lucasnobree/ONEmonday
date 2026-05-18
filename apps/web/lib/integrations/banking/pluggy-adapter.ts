/**
 * Pluggy banking adapter — Open Finance transaction sync.
 *
 * Pluggy is the recommended Open Finance aggregator (docs/research/migration-
 * architecture.md §2.9): Brazil-native, Open-Finance-regulated, with a widget
 * for the bank-link consent flow. ONEmonday builds the reconciliation/matching
 * UI natively; Pluggy supplies the transaction feed.
 *
 * Config:
 *   secret:   { "apiKey": "..." }    — a Pluggy API key (X-API-KEY header)
 *   metadata: { "baseUrl": "https://api.pluggy.ai" }   — optional
 *
 * When the API key is absent the adapter runs in **no-op mode**: it never
 * calls Pluggy and returns an empty, soft `BankSyncResult` flagged
 * `noop: true`. There is no real Pluggy account in dev, and the manual
 * OFX-import fallback (see lib/finance/ofx.ts) covers reconciliation without
 * an aggregator credential.
 *
 * The transport is injected (defaults to global `fetch`) for unit testing.
 */
import type {
  BankingAdapter,
  BankSyncResult,
  BankTransaction,
  FetchTransport,
  FinanceAdapterConfig,
} from "../finance-types";

const DEFAULT_BASE_URL = "https://api.pluggy.ai";

interface PluggySecret {
  apiKey: string;
}

/** A raw Pluggy transaction, as returned by `GET /transactions`. */
interface PluggyTransaction {
  id?: string;
  description?: string;
  amount?: number;
  currencyCode?: string;
  date?: string;
  type?: string;
}

/**
 * Normalises a raw Pluggy transaction into a {@link BankTransaction}.
 * Pluggy signs the `amount` (negative = debit); we split that into a positive
 * `amountCents` plus an explicit `direction`. Returns null when the row is
 * unusable (no id or no amount).
 */
export function normalizePluggyTransaction(
  raw: PluggyTransaction
): BankTransaction | null {
  if (!raw.id || typeof raw.amount !== "number" || !Number.isFinite(raw.amount)) {
    return null;
  }
  const direction: "credit" | "debit" =
    raw.type === "CREDIT" || raw.amount > 0 ? "credit" : "debit";
  const amountCents = Math.round(Math.abs(raw.amount) * 100);
  if (amountCents <= 0) return null;

  return {
    externalId: raw.id,
    direction,
    amountCents,
    currency:
      typeof raw.currencyCode === "string" && raw.currencyCode.length > 0
        ? raw.currencyCode
        : "BRL",
    postedDate: (raw.date ?? "").slice(0, 10),
    description: raw.description ?? "",
  };
}

export class PluggyAdapter implements BankingAdapter {
  readonly provider = "pluggy" as const;

  private readonly apiKey: string | null;
  private readonly baseUrl: string;
  private readonly transport: FetchTransport;

  constructor(config: FinanceAdapterConfig) {
    const key = (config.secret as PluggySecret | null)?.apiKey;
    this.apiKey = typeof key === "string" && key.length > 0 ? key : null;

    const base = config.metadata?.baseUrl;
    this.baseUrl =
      typeof base === "string" && base.length > 0 ? base : DEFAULT_BASE_URL;

    this.transport =
      config.transport ??
      ((u, init) => fetch(u, init) as ReturnType<FetchTransport>);
  }

  isConfigured(): boolean {
    return this.apiKey !== null;
  }

  async fetchTransactions(
    accountId: string,
    from: string,
    to: string
  ): Promise<BankSyncResult> {
    if (!this.isConfigured()) {
      console.info(
        `[integrations:pluggy] no-op (unconfigured): account ${accountId}`
      );
      return { ok: true, transactions: [], noop: true };
    }

    const url =
      `${this.baseUrl}/transactions?accountId=${encodeURIComponent(accountId)}` +
      `&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;

    try {
      const res = await this.transport(url, {
        method: "GET",
        headers: { "X-API-KEY": this.apiKey as string },
      });

      const raw = await res.text().catch(() => "");
      if (!res.ok) {
        return {
          ok: false,
          transactions: [],
          error: `Pluggy respondeu ${res.status}${raw ? `: ${raw}` : ""}`,
        };
      }

      let parsed: { results?: PluggyTransaction[] } = {};
      try {
        parsed = raw ? (JSON.parse(raw) as typeof parsed) : {};
      } catch {
        return {
          ok: false,
          transactions: [],
          error: "Resposta invalida do Pluggy",
        };
      }

      const transactions = (parsed.results ?? [])
        .map(normalizePluggyTransaction)
        .filter((t): t is BankTransaction => t !== null);

      return { ok: true, transactions };
    } catch (err) {
      return {
        ok: false,
        transactions: [],
        error:
          err instanceof Error ? err.message : "Falha ao sincronizar com o banco",
      };
    }
  }
}
