/**
 * Focus NFe fiscal adapter — NF-e / NFS-e emission.
 *
 * Focus NFe is the recommended fiscal gateway (docs/research/migration-
 * architecture.md §2.9): best municipal NFS-e coverage and it custodies the A1
 * digital certificate, so ONEmonday never stores the certificate — it stores
 * only the Focus NFe API token.
 *
 * Config:
 *   secret:   { "token": "..." }            — the Focus NFe API token
 *   metadata: { "baseUrl": "https://api.focusnfe.com.br" }  — optional
 *
 * When the token is absent the adapter runs in **no-op mode**: it never calls
 * the gateway and returns a soft result flagged `noop: true` with status
 * `processing`. There is no real Focus NFe account / A1 certificate in dev, so
 * nothing crashes without one.
 *
 * ONEmonday does not emit fiscal documents itself and assumes no fiscal/legal
 * liability — the company + accountant remain responsible
 * (migration-architecture.md §3, §6).
 *
 * The transport is injected (defaults to global `fetch`) for unit testing.
 */
import type {
  FetchTransport,
  FinanceAdapterConfig,
  FiscalAdapter,
  FiscalEmissionRequest,
  FiscalEmissionResult,
  FiscalStatus,
} from "../finance-types";

const DEFAULT_BASE_URL = "https://api.focusnfe.com.br";

interface FocusNfeSecret {
  token: string;
}

/** Maps a Focus NFe `status` field to our {@link FiscalStatus}. */
export function mapFocusStatus(raw: unknown): FiscalStatus {
  switch (raw) {
    case "autorizado":
      return "authorized";
    case "cancelado":
      return "cancelled";
    case "erro_autorizacao":
    case "denegado":
      return "rejected";
    case "processando_autorizacao":
    case "enviada":
      return "processing";
    default:
      return "processing";
  }
}

/** Builds the Focus NFe emission request body for a fiscal document. */
export function buildFocusPayload(request: FiscalEmissionRequest): unknown {
  // Amounts are sent to the gateway in major units (reais) with 2 decimals.
  const valor = (request.amountCents / 100).toFixed(2);
  return {
    // Focus NFe distinguishes the endpoint by doc type; the body is shared.
    natureza_operacao:
      request.docType === "nfse" ? "Prestacao de servico" : "Venda",
    discriminacao: request.description,
    valor_servicos: valor,
    valor_total: valor,
    tomador: {
      razao_social: request.customerName,
      cnpj: request.customerTaxId ?? null,
    },
  };
}

export class FocusNfeAdapter implements FiscalAdapter {
  readonly provider = "focus_nfe" as const;

  private readonly token: string | null;
  private readonly baseUrl: string;
  private readonly transport: FetchTransport;

  constructor(config: FinanceAdapterConfig) {
    const token = (config.secret as FocusNfeSecret | null)?.token;
    this.token = typeof token === "string" && token.length > 0 ? token : null;

    const base = config.metadata?.baseUrl;
    this.baseUrl =
      typeof base === "string" && base.length > 0 ? base : DEFAULT_BASE_URL;

    this.transport =
      config.transport ??
      ((u, init) => fetch(u, init) as ReturnType<FetchTransport>);
  }

  isConfigured(): boolean {
    return this.token !== null;
  }

  async emit(
    request: FiscalEmissionRequest
  ): Promise<FiscalEmissionResult> {
    if (!this.isConfigured()) {
      // No-op / log-only mode — keeps dev environments from crashing. The
      // document stays effectively un-emitted; the caller persists it as a
      // draft and surfaces "gateway nao configurado" to the user.
      console.info(
        `[integrations:focus_nfe] no-op (unconfigured): ${request.reference}`
      );
      return { ok: true, status: "processing", noop: true };
    }

    const path = request.docType === "nfse" ? "nfse" : "nfe";
    // `ref` is the gateway idempotency key — a re-emit with the same ref is
    // safely de-duplicated by Focus NFe.
    const url = `${this.baseUrl}/v2/${path}?ref=${encodeURIComponent(
      request.reference
    )}`;

    try {
      const res = await this.transport(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Focus NFe authenticates with HTTP Basic — token as the username.
          Authorization: `Basic ${Buffer.from(`${this.token}:`).toString(
            "base64"
          )}`,
        },
        body: JSON.stringify(buildFocusPayload(request)),
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
          reason: `Focus NFe respondeu ${res.status}${
            raw ? `: ${raw}` : ""
          }`,
        };
      }

      const status = mapFocusStatus(body.status);
      return {
        ok: status !== "rejected" && status !== "error",
        status,
        providerRef:
          typeof body.ref === "string" ? body.ref : request.reference,
        protocol:
          typeof body.numero === "string" ? body.numero : undefined,
        accessKey:
          typeof body.chave_nfe === "string" ? body.chave_nfe : undefined,
        pdfUrl:
          typeof body.caminho_danfe === "string"
            ? body.caminho_danfe
            : undefined,
        xmlUrl:
          typeof body.caminho_xml_nota_fiscal === "string"
            ? body.caminho_xml_nota_fiscal
            : undefined,
        reason:
          typeof body.mensagem_sefaz === "string"
            ? body.mensagem_sefaz
            : undefined,
      };
    } catch (err) {
      return {
        ok: false,
        status: "error",
        reason:
          err instanceof Error ? err.message : "Falha ao emitir documento",
      };
    }
  }
}
