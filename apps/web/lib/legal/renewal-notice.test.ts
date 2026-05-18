import { describe, it, expect } from "vitest";
import { buildRenewalMessage, RENEWAL_EVENT_TYPE } from "./renewal-notice";

describe("RENEWAL_EVENT_TYPE", () => {
  it("is the stable contract_renewal event key", () => {
    // The migration seeds a notification_channel_routes row with this exact
    // value — a change here must be matched by a new migration.
    expect(RENEWAL_EVENT_TYPE).toBe("contract_renewal");
  });
});

describe("buildRenewalMessage", () => {
  it("frames a contract still in the notice window as a renewal decision", () => {
    const msg = buildRenewalMessage({
      title: "Contrato de TI",
      counterparty: "Acme Ltda",
      days_until_expiry: 12,
    });
    expect(msg.title).toBe("Contrato em janela de renovação");
    expect(msg.body).toContain("Contrato de TI");
    expect(msg.body).toContain("Acme Ltda");
    expect(msg.body).toContain("12 dia(s)");
    expect(msg.body).toContain("aviso prévio");
    expect(msg.url).toBe("/legal/contracts");
  });

  it("frames an already-expired contract as overdue", () => {
    const msg = buildRenewalMessage({
      title: "Locação Sede",
      counterparty: "Imobiliária X",
      days_until_expiry: -5,
    });
    expect(msg.title).toBe("Contrato vencido");
    expect(msg.body).toContain("venceu há 5 dia(s)");
    expect(msg.body).toContain("Locação Sede");
  });

  it("treats the expiry day itself (0 days) as inside the window", () => {
    const msg = buildRenewalMessage({
      title: "NDA",
      counterparty: "Fornecedor Y",
      days_until_expiry: 0,
    });
    expect(msg.title).toBe("Contrato em janela de renovação");
    expect(msg.body).toContain("0 dia(s)");
  });
});
