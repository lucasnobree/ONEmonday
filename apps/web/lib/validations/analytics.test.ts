import { describe, it, expect } from "vitest";
import {
  createReportSchema,
  updateReportSchema,
  CHART_TYPES,
  GROUP_BY_OPTIONS,
} from "./analytics";

const UUID = "3826e880-b077-4930-a676-7c5b96d10f63";

describe("createReportSchema", () => {
  it("applies defaults for chartType, groupBy and dateRangeDays", () => {
    const parsed = createReportSchema.parse({
      sectorId: UUID,
      name: "Cards concluídos",
      metric: "cards_completed",
    });
    expect(parsed.chartType).toBe("bar");
    expect(parsed.groupBy).toBe("month");
    expect(parsed.dateRangeDays).toBe(30);
  });

  it("rejects an unknown metric", () => {
    const result = createReportSchema.safeParse({
      sectorId: UUID,
      name: "Inválido",
      metric: "not_a_metric",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateReportSchema", () => {
  // The report form no longer sends `group_by` (the trend RPC ignores it),
  // so the update schema must default it instead of requiring it.
  it("defaults groupBy to 'month' when omitted", () => {
    const parsed = updateReportSchema.parse({
      id: UUID,
      name: "Tickets resolvidos",
      metric: "tickets_resolved",
      chartType: "line",
      dateRangeDays: 90,
    });
    expect(parsed.groupBy).toBe("month");
  });

  it("still accepts a legacy stored groupBy value", () => {
    const parsed = updateReportSchema.parse({
      id: UUID,
      name: "Tickets resolvidos",
      metric: "tickets_resolved",
      chartType: "bar",
      groupBy: "priority",
      dateRangeDays: 30,
    });
    expect(parsed.groupBy).toBe("priority");
  });
});

describe("report enums", () => {
  it("keeps 'pie' a valid stored chart type for legacy reports", () => {
    expect(CHART_TYPES).toContain("pie");
  });

  it("retains the full group-by enum for legacy report rows", () => {
    expect(GROUP_BY_OPTIONS).toEqual([
      "day",
      "week",
      "month",
      "status",
      "priority",
    ]);
  });
});
