/**
 * Printable-invoice document builder.
 *
 * Produces a self-contained HTML string for one invoice that can be opened in
 * a new window and printed / saved as PDF via the browser. Keeping this as a
 * pure function (no DOM, no React) makes it unit-testable and avoids touching
 * global styles.
 */

import { formatCents, type Currency } from "./money";
import { formatDateOnly } from "./dates";
import { formatQuantity } from "./line-items";

/** Minimal invoice shape the printable document needs. */
export interface PrintableInvoice {
  number: string;
  customer_name: string;
  description: string | null;
  amount_cents: number;
  currency: Currency;
  issue_date: string;
  due_date: string;
  status: string;
}

/** Minimal line-item shape for the printable document. */
export interface PrintableLineItem {
  description: string;
  quantity_milli: number;
  unit_price_cents: number;
  line_total_cents: number;
}

/** Escapes a string for safe interpolation into HTML text/attributes. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Builds the full printable HTML document for an invoice. `sectorName` is the
 * issuing sector (the "from" party); `statusLabel` is the pt-BR status text.
 */
export function buildInvoicePrintHtml(
  invoice: PrintableInvoice,
  lines: PrintableLineItem[],
  sectorName: string,
  statusLabel: string
): string {
  const currency = invoice.currency;
  const rowsHtml =
    lines.length > 0
      ? lines
          .map(
            (l) => `
        <tr>
          <td>${escapeHtml(l.description)}</td>
          <td class="num">${escapeHtml(formatQuantity(l.quantity_milli))}</td>
          <td class="num">${escapeHtml(
            formatCents(l.unit_price_cents, currency)
          )}</td>
          <td class="num">${escapeHtml(
            formatCents(l.line_total_cents, currency)
          )}</td>
        </tr>`
          )
          .join("")
      : `
        <tr>
          <td>${escapeHtml(invoice.description || "Servicos / produtos")}</td>
          <td class="num">1</td>
          <td class="num">${escapeHtml(
            formatCents(invoice.amount_cents, currency)
          )}</td>
          <td class="num">${escapeHtml(
            formatCents(invoice.amount_cents, currency)
          )}</td>
        </tr>`;

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Fatura ${escapeHtml(invoice.number)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, Segoe UI, sans-serif;
         color: #111; margin: 0; padding: 40px; }
  .doc { max-width: 720px; margin: 0 auto; }
  header { display: flex; justify-content: space-between;
           align-items: flex-start; border-bottom: 2px solid #111;
           padding-bottom: 16px; margin-bottom: 24px; }
  h1 { font-size: 22px; margin: 0; }
  .meta { text-align: right; font-size: 13px; color: #444; }
  .parties { display: flex; justify-content: space-between;
             margin-bottom: 24px; font-size: 13px; }
  .parties h2 { font-size: 12px; text-transform: uppercase;
                color: #888; margin: 0 0 4px; letter-spacing: .04em; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; border-bottom: 1px solid #ccc;
       padding: 8px 6px; color: #555; }
  td { padding: 8px 6px; border-bottom: 1px solid #eee; }
  .num { text-align: right; }
  tfoot td { font-weight: 700; border-top: 2px solid #111;
             border-bottom: none; font-size: 15px; }
  .status { display: inline-block; padding: 2px 10px; border-radius: 999px;
            background: #eee; font-size: 12px; }
  footer { margin-top: 32px; font-size: 11px; color: #999;
           text-align: center; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <div class="doc">
    <header>
      <h1>Fatura ${escapeHtml(invoice.number)}</h1>
      <div class="meta">
        <div>Emissao: ${escapeHtml(formatDateOnly(invoice.issue_date))}</div>
        <div>Vencimento: ${escapeHtml(formatDateOnly(invoice.due_date))}</div>
        <div><span class="status">${escapeHtml(statusLabel)}</span></div>
      </div>
    </header>
    <div class="parties">
      <div>
        <h2>De</h2>
        <div>${escapeHtml(sectorName)}</div>
      </div>
      <div style="text-align:right">
        <h2>Para</h2>
        <div>${escapeHtml(invoice.customer_name)}</div>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Descricao</th>
          <th class="num">Qtd</th>
          <th class="num">Preco un.</th>
          <th class="num">Total</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="3">Total</td>
          <td class="num">${escapeHtml(
            formatCents(invoice.amount_cents, currency)
          )}</td>
        </tr>
      </tfoot>
    </table>
    <footer>
      Documento gerado pelo ONEmonday — nao substitui nota fiscal.
    </footer>
  </div>
</body>
</html>`;
}
