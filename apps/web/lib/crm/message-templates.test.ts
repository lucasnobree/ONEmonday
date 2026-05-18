import { describe, it, expect } from "vitest";
import {
  renderTemplate,
  firstName,
  TEMPLATE_VARIABLES,
} from "./message-templates";

describe("firstName", () => {
  it("returns the first word of a full name", () => {
    expect(firstName("Ana Souza Lima")).toBe("Ana");
  });

  it("collapses leading/trailing whitespace", () => {
    expect(firstName("  Bruno  Costa ")).toBe("Bruno");
  });

  it("returns an empty string for nullish input", () => {
    expect(firstName(null)).toBe("");
    expect(firstName(undefined)).toBe("");
  });
});

describe("renderTemplate", () => {
  it("substitutes pt-BR merge fields", () => {
    const out = renderTemplate(
      "Olá {{contato.nome}}, sobre {{deal.titulo}} da {{empresa.nome}}.",
      {
        contactName: "Ana Souza",
        dealTitle: "Projeto X",
        companyName: "ACME",
      }
    );
    expect(out).toBe("Olá Ana Souza, sobre Projeto X da ACME.");
  });

  it("supports the English aliases", () => {
    const out = renderTemplate("Hi {{contact.name}} from {{company.name}}", {
      contactName: "John",
      companyName: "Corp",
    });
    expect(out).toBe("Hi John from Corp");
  });

  it("tolerates whitespace inside the braces", () => {
    expect(
      renderTemplate("Oi {{  contato.nome  }}", { contactName: "Bia" })
    ).toBe("Oi Bia");
  });

  it("derives the first name when only a full name is known", () => {
    expect(
      renderTemplate("Olá {{contato.primeiro_nome}}!", {
        contactName: "Carla Mendes",
      })
    ).toBe("Olá Carla!");
  });

  it("prefers an explicit first name over the derived one", () => {
    expect(
      renderTemplate("Olá {{contato.primeiro_nome}}!", {
        contactName: "Carla Mendes",
        contactFirstName: "Cacá",
      })
    ).toBe("Olá Cacá!");
  });

  it("replaces an unknown variable with an empty string", () => {
    expect(renderTemplate("Valor: {{deal.valor}}", {})).toBe("Valor: ");
  });

  it("replaces a known variable with no value with an empty string", () => {
    // A draft must never ship a literal {{token}}.
    expect(renderTemplate("Olá {{contato.nome}}", {})).toBe("Olá ");
  });

  it("substitutes every recognised variable", () => {
    for (const variable of TEMPLATE_VARIABLES) {
      const out = renderTemplate(`x{{${variable}}}x`, {});
      expect(out).toBe("xx");
    }
  });
});
