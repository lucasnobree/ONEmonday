import { describe, it, expect } from "vitest";
import {
  matchesTicketSearch,
  filterTicketsBySearch,
  type SearchableTicket,
} from "./ticket-search";

const TICKETS: SearchableTicket[] = [
  {
    id: "11111111-aaaa-bbbb-cccc-000000000001",
    requester_email: "ana@cliente.com",
    card: { title: "Erro de login no portal" },
  },
  {
    id: "22222222-aaaa-bbbb-cccc-000000000002",
    requester_email: "bruno@empresa.com.br",
    card: { title: "Solicitação de reembolso" },
  },
  {
    id: "33333333-aaaa-bbbb-cccc-000000000003",
    requester_email: null,
    card: { title: null },
  },
];

describe("matchesTicketSearch", () => {
  it("matches everything for an empty query", () => {
    for (const t of TICKETS) {
      expect(matchesTicketSearch(t, "")).toBe(true);
      expect(matchesTicketSearch(t, "   ")).toBe(true);
    }
  });

  it("matches by title, case-insensitively", () => {
    expect(matchesTicketSearch(TICKETS[0], "LOGIN")).toBe(true);
    expect(matchesTicketSearch(TICKETS[0], "reembolso")).toBe(false);
  });

  it("matches by requester email", () => {
    expect(matchesTicketSearch(TICKETS[1], "bruno@empresa")).toBe(true);
  });

  it("matches by ticket id", () => {
    expect(matchesTicketSearch(TICKETS[1], "000000000002")).toBe(true);
  });

  it("is accent-insensitive", () => {
    // query without accents finds the accented "Solicitação"
    expect(matchesTicketSearch(TICKETS[1], "solicitacao")).toBe(true);
    // query with accents finds it too
    expect(matchesTicketSearch(TICKETS[1], "Solicitação")).toBe(true);
  });

  it("does not throw on null title / email", () => {
    expect(matchesTicketSearch(TICKETS[2], "qualquer")).toBe(false);
  });
});

describe("filterTicketsBySearch", () => {
  it("returns the full list for a blank query", () => {
    expect(filterTicketsBySearch(TICKETS, "")).toHaveLength(3);
  });

  it("narrows to matching tickets", () => {
    const result = filterTicketsBySearch(TICKETS, "reembolso");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(TICKETS[1].id);
  });
});
