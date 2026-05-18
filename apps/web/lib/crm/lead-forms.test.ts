import { describe, it, expect } from "vitest";
import {
  validateSubmission,
  mapSubmissionToLead,
  type LeadFormDefinition,
} from "./lead-forms";

const form: LeadFormDefinition = {
  id: "form-1",
  sector_id: "sector-1",
  source: "site-form",
  fields: [
    { key: "nome", label: "Nome", type: "text", required: true },
    { key: "email", label: "E-mail", type: "email", required: true },
    { key: "telefone", label: "Telefone", type: "tel", required: false },
    {
      key: "interesse",
      label: "Interesse",
      type: "select",
      required: false,
      options: ["Vendas", "Suporte"],
    },
  ],
};

describe("validateSubmission", () => {
  it("accepts a well-formed submission and trims values", () => {
    const result = validateSubmission(form, {
      nome: "  Ana  ",
      email: "ana@empresa.com",
      telefone: "+55 11 99999-0000",
      interesse: "Vendas",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.values.nome).toBe("Ana");
      expect(result.values.email).toBe("ana@empresa.com");
    }
  });

  it("flags missing required fields", () => {
    const result = validateSubmission(form, { telefone: "11999990000" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.nome).toMatch(/obrigatório/);
      expect(result.errors.email).toMatch(/obrigatório/);
    }
  });

  it("rejects a malformed email", () => {
    const result = validateSubmission(form, {
      nome: "Ana",
      email: "not-an-email",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.email).toMatch(/e-mail válido/);
  });

  it("rejects a malformed phone", () => {
    const result = validateSubmission(form, {
      nome: "Ana",
      email: "ana@empresa.com",
      telefone: "abc",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.telefone).toMatch(/telefone válido/);
  });

  it("rejects a select value outside the option list", () => {
    const result = validateSubmission(form, {
      nome: "Ana",
      email: "ana@empresa.com",
      interesse: "Financeiro",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.interesse).toMatch(/inválida/);
  });

  it("drops keys the form does not define (no payload injection)", () => {
    const result = validateSubmission(form, {
      nome: "Ana",
      email: "ana@empresa.com",
      malicious: "<script>",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.values).not.toHaveProperty("malicious");
    }
  });

  it("treats an empty optional field as simply absent", () => {
    const result = validateSubmission(form, {
      nome: "Ana",
      email: "ana@empresa.com",
      telefone: "   ",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.values).not.toHaveProperty("telefone");
  });
});

describe("mapSubmissionToLead", () => {
  it("maps conventional keys to lead columns and the rest to payload", () => {
    const mapped = mapSubmissionToLead({
      nome: "Ana Souza",
      email: "ana@empresa.com",
      telefone: "11999990000",
      empresa: "Empresa X",
      cargo: "Diretora",
      interesse: "Vendas",
    });
    expect(mapped.name).toBe("Ana Souza");
    expect(mapped.email).toBe("ana@empresa.com");
    expect(mapped.phone).toBe("11999990000");
    expect(mapped.company).toBe("Empresa X");
    expect(mapped.payload).toEqual({ cargo: "Diretora", interesse: "Vendas" });
  });

  it("falls back to a placeholder name and null columns", () => {
    const mapped = mapSubmissionToLead({ comentario: "olá" });
    expect(mapped.name).toBe("Lead sem nome");
    expect(mapped.email).toBeNull();
    expect(mapped.phone).toBeNull();
    expect(mapped.company).toBeNull();
    expect(mapped.payload).toEqual({ comentario: "olá" });
  });

  it("recognises English-keyed forms too", () => {
    const mapped = mapSubmissionToLead({
      name: "John",
      email: "john@corp.com",
      phone: "123456789",
      company: "Corp",
    });
    expect(mapped.name).toBe("John");
    expect(mapped.company).toBe("Corp");
    expect(mapped.payload).toEqual({});
  });
});
