import { describe, it, expect } from "vitest";
import {
  closeDealLostSchema,
  stageDefaultSchema,
  sendWhatsappMessageSchema,
  logEmailSchema,
  sendEmailSchema,
} from "./crm";

const UUID = "11111111-1111-4111-8111-111111111111";

describe("closeDealLostSchema", () => {
  it("accepts a valid closed-lost payload", () => {
    const result = closeDealLostSchema.safeParse({
      dealId: UUID,
      category: "competitor",
      reason: "Cliente escolheu concorrente X",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown lost-reason category", () => {
    const result = closeDealLostSchema.safeParse({
      dealId: UUID,
      category: "bad fit",
      reason: "algo",
    });
    expect(result.success).toBe(false);
  });

  it("requires a non-empty reason note", () => {
    const result = closeDealLostSchema.safeParse({
      dealId: UUID,
      category: "price",
      reason: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-uuid deal id", () => {
    const result = closeDealLostSchema.safeParse({
      dealId: "not-a-uuid",
      category: "timing",
      reason: "motivo",
    });
    expect(result.success).toBe(false);
  });
});

describe("stageDefaultSchema", () => {
  it("defaults rotting_days to 0 when omitted", () => {
    const result = stageDefaultSchema.safeParse({
      stage_name: "Negociacao",
      default_probability: 50,
      position: 0,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.rotting_days).toBe(0);
  });

  it("rejects probability outside 0-100", () => {
    const result = stageDefaultSchema.safeParse({
      stage_name: "Negociacao",
      default_probability: 150,
      position: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a negative rotting threshold", () => {
    const result = stageDefaultSchema.safeParse({
      stage_name: "Negociacao",
      default_probability: 50,
      position: 0,
      rotting_days: -1,
    });
    expect(result.success).toBe(false);
  });
});

describe("sendWhatsappMessageSchema", () => {
  it("accepts a valid WhatsApp send payload linked to a deal", () => {
    const result = sendWhatsappMessageSchema.safeParse({
      sectorId: UUID,
      dealId: UUID,
      to: "+55 11 99999-8888",
      body: "Olá, segue a proposta.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a payload with no deal/contact/company link", () => {
    const result = sendWhatsappMessageSchema.safeParse({
      sectorId: UUID,
      to: "5511999998888",
      body: "Oi",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty message body", () => {
    const result = sendWhatsappMessageSchema.safeParse({
      sectorId: UUID,
      contactId: UUID,
      to: "5511999998888",
      body: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a too-short number", () => {
    const result = sendWhatsappMessageSchema.safeParse({
      sectorId: UUID,
      contactId: UUID,
      to: "123",
      body: "Oi",
    });
    expect(result.success).toBe(false);
  });
});

describe("logEmailSchema", () => {
  it("accepts a valid outbound email log", () => {
    const result = logEmailSchema.safeParse({
      sectorId: UUID,
      dealId: UUID,
      direction: "outbound",
      subject: "Proposta comercial",
      body: "Segue em anexo a proposta.",
      counterpartEmail: "cliente@empresa.com",
    });
    expect(result.success).toBe(true);
  });

  it("accepts an inbound email log without a counterpart address", () => {
    const result = logEmailSchema.safeParse({
      sectorId: UUID,
      contactId: UUID,
      direction: "inbound",
      subject: "Re: Proposta",
      body: "Recebido, vamos avaliar.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid direction", () => {
    const result = logEmailSchema.safeParse({
      sectorId: UUID,
      dealId: UUID,
      direction: "sideways",
      subject: "Assunto",
      body: "Corpo",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a payload with no deal/contact/company link", () => {
    const result = logEmailSchema.safeParse({
      sectorId: UUID,
      direction: "outbound",
      subject: "Assunto",
      body: "Corpo",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed counterpart email", () => {
    const result = logEmailSchema.safeParse({
      sectorId: UUID,
      dealId: UUID,
      direction: "outbound",
      subject: "Assunto",
      body: "Corpo",
      counterpartEmail: "not-an-email",
    });
    expect(result.success).toBe(false);
  });
});

describe("sendEmailSchema", () => {
  it("accepts a valid send-email payload linked to a deal", () => {
    const result = sendEmailSchema.safeParse({
      sectorId: UUID,
      dealId: UUID,
      contactId: UUID,
      to: "cliente@empresa.com",
      subject: "Proposta comercial",
      body: "Segue nossa proposta para avaliação.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a malformed recipient address", () => {
    const result = sendEmailSchema.safeParse({
      sectorId: UUID,
      dealId: UUID,
      to: "not-an-email",
      subject: "Assunto",
      body: "Corpo",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty subject", () => {
    const result = sendEmailSchema.safeParse({
      sectorId: UUID,
      dealId: UUID,
      to: "cliente@empresa.com",
      subject: "",
      body: "Corpo",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a payload with no deal/contact/company link", () => {
    const result = sendEmailSchema.safeParse({
      sectorId: UUID,
      to: "cliente@empresa.com",
      subject: "Assunto",
      body: "Corpo",
    });
    expect(result.success).toBe(false);
  });
});
