import { describe, it, expect } from "vitest";
import {
  planLeadConversion,
  probabilityFromScore,
  priorityFromScore,
  type ConvertibleLead,
} from "./lead-conversion";

const baseLead: ConvertibleLead = {
  id: "lead-1",
  sector_id: "sector-1",
  name: "Ana Souza",
  email: "ana@empresa.com",
  phone: "+55 11 99999-0000",
  company: "Empresa X",
  source: "form",
  score: 70,
};

describe("probabilityFromScore", () => {
  it("scales probability with the score band", () => {
    expect(probabilityFromScore(70)).toBe(30);
    expect(probabilityFromScore(60)).toBe(30);
    expect(probabilityFromScore(45)).toBe(20);
    expect(probabilityFromScore(30)).toBe(20);
    expect(probabilityFromScore(10)).toBe(10);
    expect(probabilityFromScore(0)).toBe(10);
  });

  it("treats null / negative scores as cold", () => {
    expect(probabilityFromScore(null)).toBe(10);
    expect(probabilityFromScore(-5)).toBe(10);
  });
});

describe("priorityFromScore", () => {
  it("maps score to card priority", () => {
    expect(priorityFromScore(80)).toBe("high");
    expect(priorityFromScore(40)).toBe("medium");
    expect(priorityFromScore(5)).toBe("low");
    expect(priorityFromScore(null)).toBe("low");
  });
});

describe("planLeadConversion", () => {
  it("builds company, contact, card and deal inserts from a full lead", () => {
    const plan = planLeadConversion(baseLead, 5000);

    expect(plan.company).toEqual({
      sector_id: "sector-1",
      name: "Empresa X",
    });
    expect(plan.contact).toEqual({
      sector_id: "sector-1",
      full_name: "Ana Souza",
      email: "ana@empresa.com",
      phone: "+55 11 99999-0000",
      is_primary: true,
    });
    expect(plan.card.title).toBe("Empresa X — Ana Souza");
    expect(plan.card.sector_id).toBe("sector-1");
    expect(plan.card.priority).toBe("high"); // score 70
    expect(plan.deal).toEqual({
      sector_id: "sector-1",
      value: 5000,
      currency: "BRL",
      source: "form",
      win_probability: 30,
    });
  });

  it("omits the company insert when the lead names no company", () => {
    const plan = planLeadConversion({ ...baseLead, company: "  " });
    expect(plan.company).toBeNull();
    // Card title falls back to the contact name.
    expect(plan.card.title).toBe("Ana Souza");
  });

  it("falls back to a placeholder when the lead has no name", () => {
    const plan = planLeadConversion({ ...baseLead, name: "   ", company: null });
    expect(plan.contact.full_name).toBe("Lead sem nome");
    expect(plan.card.title).toBe("Lead sem nome");
  });

  it("nulls a missing / blank deal value", () => {
    expect(planLeadConversion(baseLead, null).deal.value).toBeNull();
    expect(planLeadConversion(baseLead, -1).deal.value).toBeNull();
  });

  it("nulls blank email / phone on the contact", () => {
    const plan = planLeadConversion({
      ...baseLead,
      email: "",
      phone: "   ",
    });
    expect(plan.contact.email).toBeNull();
    expect(plan.contact.phone).toBeNull();
  });

  it("defaults the deal source to 'lead' when the lead has none", () => {
    const plan = planLeadConversion({ ...baseLead, source: null });
    expect(plan.deal.source).toBe("lead");
  });

  it("honours a non-default currency", () => {
    const plan = planLeadConversion(baseLead, 100, "USD");
    expect(plan.deal.currency).toBe("USD");
  });
});
