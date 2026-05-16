import { describe, it, expect } from "vitest";
import {
  CONTRACT_TYPE_LABELS,
  CONTRACT_STATUS_LABELS,
  RENEWAL_TYPE_LABELS,
  RENEWAL_STATUS_LABELS,
  MATTER_TYPE_LABELS,
  MATTER_PRIORITY_LABELS,
  MATTER_STATUS_LABELS,
  CLAUSE_CATEGORY_LABELS,
  formatCurrency,
} from "./labels";

describe("Legal enum labels — pt-BR accent correctness", () => {
  // Regression: the UX audit flagged that diacritics were stripped from
  // every enum label. These assertions lock the accented spelling in.
  it("uses accented contract type labels", () => {
    expect(CONTRACT_TYPE_LABELS.service).toBe("Serviço");
    expect(CONTRACT_TYPE_LABELS.lease).toBe("Locação");
    expect(CONTRACT_TYPE_LABELS.license).toBe("Licença");
  });

  it("uses accented contract status labels", () => {
    expect(CONTRACT_STATUS_LABELS.in_review.label).toBe("Em revisão");
  });

  it("uses accented renewal type labels", () => {
    expect(RENEWAL_TYPE_LABELS.none).toBe("Sem renovação");
    expect(RENEWAL_TYPE_LABELS.auto).toBe("Renovação automática");
    expect(RENEWAL_TYPE_LABELS.optional).toBe("Renovação opcional");
  });

  it("uses accented renewal status labels", () => {
    expect(RENEWAL_STATUS_LABELS.upcoming.label).toBe("Renovação próxima");
    expect(RENEWAL_STATUS_LABELS.notice.label).toBe("Ação necessária");
  });

  it("uses accented matter type and priority labels", () => {
    expect(MATTER_TYPE_LABELS.contract_review).toBe("Revisão de contrato");
    expect(MATTER_TYPE_LABELS.litigation).toBe("Litígio");
    expect(MATTER_PRIORITY_LABELS.medium.label).toBe("Média");
  });

  it("uses accented clause category labels", () => {
    expect(CLAUSE_CATEGORY_LABELS.termination).toBe("Rescisão");
  });

  it("has no stripped-accent words anywhere in the label maps", () => {
    const allLabels = [
      ...Object.values(CONTRACT_TYPE_LABELS),
      ...Object.values(CONTRACT_STATUS_LABELS).map((v) => v.label),
      ...Object.values(RENEWAL_TYPE_LABELS),
      ...Object.values(RENEWAL_STATUS_LABELS).map((v) => v.label),
      ...Object.values(MATTER_TYPE_LABELS),
      ...Object.values(MATTER_PRIORITY_LABELS).map((v) => v.label),
      ...Object.values(MATTER_STATUS_LABELS).map((v) => v.label),
      ...Object.values(CLAUSE_CATEGORY_LABELS),
    ].join(" ");
    // Tokens that, if present un-accented, indicate a stripped diacritic.
    expect(allLabels).not.toMatch(
      /\b(Servico|Locacao|Licenca|Renovacao|Acao|revisao|Revisao|Litigio|Media|Rescisao)\b/
    );
  });
});

describe("formatCurrency", () => {
  it("returns a dash for a null amount", () => {
    expect(formatCurrency(null, "BRL")).toBe("-");
  });

  it("formats a BRL amount in pt-BR", () => {
    const out = formatCurrency(1234.5, "BRL");
    expect(out).toContain("R$");
    expect(out).toContain("1.234,50");
  });

  it("falls back gracefully for an unknown currency code", () => {
    expect(formatCurrency(1000, "REAIS")).toBe("REAIS 1.000");
  });
});
