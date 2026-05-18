import { describe, it, expect } from "vitest";
import {
  escapeHtml,
  buildInvoicePrintHtml,
  type PrintableInvoice,
  type PrintableLineItem,
} from "./invoice-print";

const invoice: PrintableInvoice = {
  number: "INV-007",
  customer_name: "Acme Ltda",
  description: "Consultoria",
  amount_cents: 150000,
  currency: "BRL",
  issue_date: "2026-05-01",
  due_date: "2026-05-31",
  status: "sent",
};

describe("escapeHtml", () => {
  it("escapes HTML-significant characters", () => {
    expect(escapeHtml('<b>"x" & y</b>')).toBe(
      "&lt;b&gt;&quot;x&quot; &amp; y&lt;/b&gt;"
    );
  });
});

describe("buildInvoicePrintHtml", () => {
  it("renders the invoice number, customer and sector", () => {
    const html = buildInvoicePrintHtml(invoice, [], "Setor Vendas", "Enviada");
    expect(html).toContain("Fatura INV-007");
    expect(html).toContain("Acme Ltda");
    expect(html).toContain("Setor Vendas");
    expect(html).toContain("Enviada");
  });

  it("renders the total in pt-BR currency", () => {
    const html = buildInvoicePrintHtml(invoice, [], "Setor", "Enviada");
    // 150000 cents -> R$ 1.500,00
    expect(html).toContain("1.500,00");
  });

  it("renders a row per line item when itemized", () => {
    const lines: PrintableLineItem[] = [
      {
        description: "Hora de consultoria",
        quantity_milli: 1500,
        unit_price_cents: 20000,
        line_total_cents: 30000,
      },
      {
        description: "Licenca",
        quantity_milli: 1000,
        unit_price_cents: 5000,
        line_total_cents: 5000,
      },
    ];
    const html = buildInvoicePrintHtml(invoice, lines, "Setor", "Enviada");
    expect(html).toContain("Hora de consultoria");
    expect(html).toContain("Licenca");
    // Fractional quantity rendered pt-BR.
    expect(html).toContain("1,5");
  });

  it("escapes a malicious customer name", () => {
    const evil: PrintableInvoice = {
      ...invoice,
      customer_name: "<script>alert(1)</script>",
    };
    const html = buildInvoicePrintHtml(evil, [], "Setor", "Enviada");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("falls back to the invoice description when there are no lines", () => {
    const html = buildInvoicePrintHtml(invoice, [], "Setor", "Enviada");
    expect(html).toContain("Consultoria");
  });
});
