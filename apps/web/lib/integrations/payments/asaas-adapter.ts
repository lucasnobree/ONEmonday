/**
 * Asaas payment adapter — boleto / PIX charge issuance.
 *
 * Asaas is the recommended PSP (docs/research/migration-architecture.md §2.9):
 * a simple flat-fee API covering PIX, boleto and payment links. ONEmonday owns
 * the AR ledger; Asaas issues the regulated charge and confirms payment via
 * webhook.
 *
 * Config:
 *   secret:   { "apiKey": "..." }   — the Asaas API key (access_token header)
 *   metadata: { "baseUrl": "https://api.asaas.com/v3" }   — optional
 *
 * When the API key is absent the adapter runs in **no-op mode**: it never
 * calls Asaas and returns a soft result flagged `noop: true` with status
 * `pending`. There is no real Asaas merchant account in dev, so nothing
 * crashes without one.
 *
 * ONEmonday does not move money itself and assumes no settlement liability —
 * the PSP is the licensed institution (migration-architecture.md §6).
 *
 * The transport is injected (defaults to global `fetch`) for unit testing.
 */
import type {
  ChargeRequest,
  ChargeResult,
  ChargeStatus,
  FetchTransport,
  FinanceAdapterConfig,
  PaymentAdapter,
} from "../finance-types";

const DEFAULT_BASE_URL = "https://api.asaas.com/v3";

interface AsaasSecret {
  apiKey: string;
}

/** Maps an Asaas `status` field to our {@link ChargeStatus}. */
export function mapAsaasStatus(raw: unknown): ChargeStatus {
  switch (raw) {
    case "RECEIVED":
    case "CONFIRMED":
    case "RECEIVED_IN_CASH":
      return "received";
    case "OVERDUE":
      return "overdue";
    case "REFUNDED":
    case "DELETED":
      return "cancelled";
    case "PENDING":
    case "AWAITING_RISK_ANALYSIS":
      return "pending";
    default:
      return "pending";
  }
}

/** Maps our billing type to the Asaas `billingType` enum. */
export function toAsaasBillingType(billingType: string): string {
  switch (billingType) {
    case "pix":
      return "PIX";
    case "boleto":
      return "BOLETO";
    default:
      return "UNDEFINED";
  }
}

/** Builds the Asaas charge-creation request body. */
export function buildAsaasPayload(request: ChargeRequest): unknown {
  return {
    // `externalReference` is our idempotency key, echoed back on the webhook.
    externalReference: request.reference,
    billingType: toAsaasBillingType(request.billingType),
    // Asaas takes the amount in major units (reais).
    value: request.amountCents / 100,
    dueDate: request.dueDate,
    description: request.description,
  };
}

export class AsaasAdapter implements PaymentAdapter {
  readonly provider = "asaas" as const;

  private readonly apiKey: string | null;
  private readonly baseUrl: string;
  private readonly transport: FetchTransport;

  constructor(config: FinanceAdapterConfig) {
    const key = (config.secret as AsaasSecret | null)?.apiKey;
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

  async createCharge(request: ChargeRequest): Promise<ChargeResult> {
    if (!this.isConfigured()) {
      console.info(
        `[integrations:asaas] no-op (unconfigured): ${request.reference}`
      );
      return { ok: true, status: "pending", noop: true };
    }

    const url = `${this.baseUrl}/payments`;

    try {
      const res = await this.transport(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          access_token: this.apiKey as string,
        },
        body: JSON.stringify(buildAsaasPayload(request)),
      });

      const raw = await res.text().catch(() => "");
      let body: Record<string, unknown> = {};
      try {
        body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      } catch {
        // Non-JSON body — leave `body` empty.
      }

      if (!res.ok) {
        return {
          ok: false,
          status: "error",
          reason: `Asaas respondeu ${res.status}${raw ? `: ${raw}` : ""}`,
        };
      }

      const status = mapAsaasStatus(body.status);
      return {
        ok: true,
        status,
        providerRef: typeof body.id === "string" ? body.id : undefined,
        boletoLine:
          typeof body.identificationField === "string"
            ? body.identificationField
            : undefined,
        pixPayload:
          typeof body.pixCopyAndPaste === "string"
            ? body.pixCopyAndPaste
            : undefined,
        invoiceUrl:
          typeof body.invoiceUrl === "string" ? body.invoiceUrl : undefined,
      };
    } catch (err) {
      return {
        ok: false,
        status: "error",
        reason: err instanceof Error ? err.message : "Falha ao gerar cobranca",
      };
    }
  }
}
