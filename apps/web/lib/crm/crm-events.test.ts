import { describe, it, expect } from "vitest";
import {
  buildDealWonEvent,
  buildDealLostEvent,
  buildDealStageChangedEvent,
  buildActivityDueEvent,
} from "./crm-events";

describe("buildDealWonEvent", () => {
  it("uses the crm_deal_won event type and a value-bearing body", () => {
    const e = buildDealWonEvent({
      dealTitle: "Contrato Acme",
      value: 15000,
      companyName: "Acme",
      ownerName: "Ana",
    });
    expect(e.eventType).toBe("crm_deal_won");
    expect(e.body).toContain("Contrato Acme");
    expect(e.body).toContain("Acme");
    expect(e.body).toContain("Ana");
    // Value is formatted as BRL currency.
    expect(e.body).toMatch(/R\$/);
  });

  it("tolerates a missing value and company", () => {
    const e = buildDealWonEvent({ dealTitle: "Deal sem valor" });
    expect(e.body).toContain("valor nao informado");
    expect(e.body).not.toContain("undefined");
  });
});

describe("buildDealLostEvent", () => {
  it("uses the crm_deal_lost event type and includes the reason", () => {
    const e = buildDealLostEvent({
      dealTitle: "Proposta X",
      lostReason: "Preco — orcamento acima",
    });
    expect(e.eventType).toBe("crm_deal_lost");
    expect(e.body).toContain("Proposta X");
    expect(e.body).toContain("Preco");
  });

  it("omits the reason clause when none is given", () => {
    const e = buildDealLostEvent({ dealTitle: "Sem motivo" });
    expect(e.body).not.toContain("Motivo:");
  });
});

describe("buildDealStageChangedEvent", () => {
  it("describes the from/to stages", () => {
    const e = buildDealStageChangedEvent({
      dealTitle: "Deal Y",
      fromStage: "Qualificacao",
      toStage: "Proposta",
    });
    expect(e.eventType).toBe("crm_deal_stage_changed");
    expect(e.body).toContain("Qualificacao");
    expect(e.body).toContain("Proposta");
  });

  it("handles a null origin stage gracefully", () => {
    const e = buildDealStageChangedEvent({
      dealTitle: "Deal Z",
      fromStage: null,
      toStage: "Novo",
    });
    expect(e.body).toContain("Novo");
    expect(e.body).not.toContain("null");
  });
});

describe("buildActivityDueEvent", () => {
  it("uses the crm_activity_due event type and the subject", () => {
    const e = buildActivityDueEvent({
      subject: "Ligar para cliente",
      type: "call",
      dueAt: "2026-05-20T14:30:00",
      assigneeName: "Bruno",
    });
    expect(e.eventType).toBe("crm_activity_due");
    expect(e.body).toContain("Ligar para cliente");
    expect(e.body).toContain("Bruno");
  });

  it("falls back to the raw string for an unparseable due date", () => {
    const e = buildActivityDueEvent({
      subject: "Tarefa",
      type: "task",
      dueAt: "invalid",
    });
    expect(e.body).toContain("invalid");
  });
});
