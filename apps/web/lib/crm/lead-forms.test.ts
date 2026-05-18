import { describe, it, expect } from "vitest";
import {
  validateSubmission,
  mapSubmissionToLead,
  type LeadFormDefinition,
} from "./lead-forms";
import type { LeadFormField } from "@/lib/validations/crm";

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

  describe("explicit field-to-property mapping", () => {
    it("maps a tagged field onto its lead column even with an unconventional key", () => {
      const fields: LeadFormField[] = [
        { key: "q1", label: "Seu nome", type: "text", required: true, map: "name" },
        { key: "q2", label: "Seu e-mail", type: "email", required: true, map: "email" },
        { key: "q3", label: "Telefone", type: "tel", required: false, map: "phone" },
        { key: "q4", label: "Onde trabalha", type: "text", required: false, map: "company" },
      ];
      const mapped = mapSubmissionToLead(
        { q1: "Bia", q2: "bia@x.com", q3: "11999990000", q4: "ACME" },
        fields
      );
      expect(mapped.name).toBe("Bia");
      expect(mapped.email).toBe("bia@x.com");
      expect(mapped.phone).toBe("11999990000");
      expect(mapped.company).toBe("ACME");
      // Mapped fields are consumed — nothing leaks into the payload.
      expect(mapped.payload).toEqual({});
    });

    it("explicit mapping wins over a conventional-key collision", () => {
      const fields: LeadFormField[] = [
        { key: "email", label: "Contato", type: "text", required: false },
        { key: "work_email", label: "E-mail", type: "email", required: true, map: "email" },
      ];
      const mapped = mapSubmissionToLead(
        { email: "pessoal@gmail.com", work_email: "bia@acme.com" },
        fields
      );
      expect(mapped.email).toBe("bia@acme.com");
      // The conventional `email` key was not claimed — it stays in payload.
      expect(mapped.payload).toEqual({ email: "pessoal@gmail.com" });
    });

    it("falls back to conventional keys for untagged fields", () => {
      const fields: LeadFormField[] = [
        { key: "nome", label: "Nome", type: "text", required: true },
        { key: "setor", label: "Setor", type: "text", required: false, map: "company" },
      ];
      const mapped = mapSubmissionToLead(
        { nome: "Caio", setor: "TI", email: "caio@x.com" },
        fields
      );
      // `nome` resolves via the conventional fallback, `setor` via the tag.
      expect(mapped.name).toBe("Caio");
      expect(mapped.company).toBe("TI");
      expect(mapped.email).toBe("caio@x.com");
      expect(mapped.payload).toEqual({});
    });

    it("ignores a 'none' map and keeps the field in payload", () => {
      const fields: LeadFormField[] = [
        { key: "obs", label: "Observação", type: "textarea", required: false, map: "none" },
      ];
      const mapped = mapSubmissionToLead({ obs: "qualquer" }, fields);
      expect(mapped.payload).toEqual({ obs: "qualquer" });
    });
  });
});
