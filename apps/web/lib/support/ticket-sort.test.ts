import { describe, it, expect } from "vitest";
import { sortTickets, compareTickets, type SortableTicket } from "./ticket-sort";

function ticket(
  partial: Partial<SortableTicket> & {
    title?: string;
    priority?: string;
  }
): SortableTicket {
  return {
    created_at: partial.created_at ?? "2026-05-15T12:00:00Z",
    status: partial.status ?? "open",
    card: {
      title: partial.title ?? "Ticket",
      priority: partial.priority ?? "medium",
    },
  };
}

describe("compareTickets", () => {
  it("orders critical before low for priority ascending", () => {
    const a = ticket({ priority: "critical" });
    const b = ticket({ priority: "low" });
    // ascending sort key = most urgent (lowest rank) first
    expect(compareTickets(a, b, "priority", "asc")).toBeLessThan(0);
    // descending flips it
    expect(compareTickets(a, b, "priority", "desc")).toBeGreaterThan(0);
  });

  it("orders by creation date", () => {
    const older = ticket({ created_at: "2026-05-10T00:00:00Z" });
    const newer = ticket({ created_at: "2026-05-15T00:00:00Z" });
    expect(compareTickets(newer, older, "created", "desc")).toBeLessThan(0);
    expect(compareTickets(newer, older, "created", "asc")).toBeGreaterThan(0);
  });

  it("orders titles alphabetically", () => {
    const a = ticket({ title: "Alpha" });
    const b = ticket({ title: "Beta" });
    expect(compareTickets(a, b, "title", "asc")).toBeLessThan(0);
  });
});

describe("sortTickets", () => {
  it("does not mutate the input array", () => {
    const input = [
      ticket({ priority: "low" }),
      ticket({ priority: "critical" }),
    ];
    const sorted = sortTickets(input, "priority", "desc");
    expect(sorted).not.toBe(input);
    expect(input[0].card?.priority).toBe("low");
  });

  it("sorts a queue by priority with critical first", () => {
    const sorted = sortTickets(
      [
        ticket({ priority: "medium", title: "m" }),
        ticket({ priority: "critical", title: "c" }),
        ticket({ priority: "low", title: "l" }),
      ],
      "priority",
      "asc"
    );
    expect(sorted.map((t) => t.card?.priority)).toEqual([
      "critical",
      "medium",
      "low",
    ]);
  });

  it("sorts by workflow status order", () => {
    const sorted = sortTickets(
      [
        ticket({ status: "resolved" }),
        ticket({ status: "new" }),
        ticket({ status: "pending" }),
      ],
      "status",
      "asc"
    );
    expect(sorted.map((t) => t.status)).toEqual([
      "new",
      "pending",
      "resolved",
    ]);
  });
});
