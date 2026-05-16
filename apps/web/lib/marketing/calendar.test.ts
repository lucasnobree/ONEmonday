import { describe, it, expect } from "vitest";
import {
  buildMonthGrid,
  previousMonth,
  nextMonth,
  monthLabel,
  groupByDate,
} from "./calendar";

describe("buildMonthGrid", () => {
  it("returns whole weeks (a multiple of 7 cells)", () => {
    expect(buildMonthGrid("2026-05").length % 7).toBe(0);
  });

  it("starts on a Sunday and marks padding days out of month", () => {
    const cells = buildMonthGrid("2026-05");
    // 2026-05-01 is a Friday, so the grid starts on the prior Sunday.
    expect(cells[0].inMonth).toBe(false);
    const firstInMonth = cells.find((c) => c.inMonth);
    expect(firstInMonth?.date).toBe("2026-05-01");
  });
});

describe("previousMonth / nextMonth", () => {
  it("steps across year boundaries", () => {
    expect(previousMonth("2026-01")).toBe("2025-12");
    expect(nextMonth("2026-12")).toBe("2027-01");
  });
});

describe("monthLabel", () => {
  it("capitalizes only the first letter, leaving the preposition lower", () => {
    // pt-BR long format is "maio de 2026"; the preposition stays lowercase.
    const label = monthLabel("2026-05");
    expect(label).toBe("Maio de 2026");
    expect(label).not.toContain(" De ");
  });
});

describe("groupByDate", () => {
  it("buckets items by their scheduled_date", () => {
    const grouped = groupByDate([
      { scheduled_date: "2026-05-10", id: "a" },
      { scheduled_date: "2026-05-10", id: "b" },
      { scheduled_date: "2026-05-11", id: "c" },
    ]);
    expect(grouped.get("2026-05-10")).toHaveLength(2);
    expect(grouped.get("2026-05-11")).toHaveLength(1);
    expect(grouped.get("2026-05-12")).toBeUndefined();
  });
});
