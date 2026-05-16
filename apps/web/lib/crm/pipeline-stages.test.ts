import { describe, it, expect } from "vitest";
import type { Deal } from "@/hooks/crm/use-deals";
import { buildStageColumns, buildFunnelStages } from "./pipeline-stages";

/**
 * Builds a minimal deal fixture. Only the fields the pipeline-stage
 * helpers read are populated; the rest is cast away.
 */
function makeDeal(opts: {
  id: string;
  columnId: string;
  columnName: string;
  position: number;
  value?: number | null;
  closed?: boolean;
}): Deal {
  return {
    id: opts.id,
    value: opts.value ?? null,
    actual_close_date: opts.closed ? "2026-01-01" : null,
    card: {
      board_columns: {
        id: opts.columnId,
        name: opts.columnName,
        color: "#000000",
        position: opts.position,
        is_done_column: false,
      },
    },
  } as unknown as Deal;
}

describe("buildStageColumns", () => {
  it("orders columns by board position, not insertion order", () => {
    // Inserted out of order: Negociacao(pos 2) before Lead(pos 0).
    const deals = [
      makeDeal({ id: "d1", columnId: "c2", columnName: "Negociacao", position: 2 }),
      makeDeal({ id: "d2", columnId: "c0", columnName: "Lead", position: 0 }),
      makeDeal({ id: "d3", columnId: "c1", columnName: "Proposta", position: 1 }),
    ];
    const stages = buildStageColumns(deals);
    expect(stages.map((s) => s.stageName)).toEqual([
      "Lead",
      "Proposta",
      "Negociacao",
    ]);
  });

  it("groups multiple deals into the same column", () => {
    const deals = [
      makeDeal({ id: "d1", columnId: "c0", columnName: "Lead", position: 0 }),
      makeDeal({ id: "d2", columnId: "c0", columnName: "Lead", position: 0 }),
      makeDeal({ id: "d3", columnId: "c1", columnName: "Proposta", position: 1 }),
    ];
    const stages = buildStageColumns(deals);
    expect(stages).toHaveLength(2);
    expect(stages[0].deals.map((d) => d.id)).toEqual(["d1", "d2"]);
    expect(stages[1].deals.map((d) => d.id)).toEqual(["d3"]);
  });

  it("preserves each column's real position value", () => {
    const deals = [
      makeDeal({ id: "d1", columnId: "c5", columnName: "Ganho", position: 5 }),
    ];
    expect(buildStageColumns(deals)[0].position).toBe(5);
  });

  it("breaks position ties deterministically by stage name", () => {
    const deals = [
      makeDeal({ id: "d1", columnId: "cb", columnName: "Beta", position: 0 }),
      makeDeal({ id: "d2", columnId: "ca", columnName: "Alfa", position: 0 }),
    ];
    expect(buildStageColumns(deals).map((s) => s.stageName)).toEqual([
      "Alfa",
      "Beta",
    ]);
  });

  it("skips deals with no board column", () => {
    const orphan = { id: "x", card: {} } as unknown as Deal;
    expect(buildStageColumns([orphan])).toEqual([]);
  });

  it("returns an empty array for no deals", () => {
    expect(buildStageColumns([])).toEqual([]);
  });
});

describe("buildFunnelStages", () => {
  it("orders funnel stages by board position", () => {
    const deals = [
      makeDeal({ id: "d1", columnId: "c2", columnName: "Negociacao", position: 2 }),
      makeDeal({ id: "d2", columnId: "c0", columnName: "Lead", position: 0 }),
    ];
    expect(buildFunnelStages(deals).map((s) => s.stage)).toEqual([
      "Lead",
      "Negociacao",
    ]);
  });

  it("counts deals and sums value per stage", () => {
    const deals = [
      makeDeal({
        id: "d1",
        columnId: "c0",
        columnName: "Lead",
        position: 0,
        value: 1000,
      }),
      makeDeal({
        id: "d2",
        columnId: "c0",
        columnName: "Lead",
        position: 0,
        value: 500,
      }),
    ];
    const [lead] = buildFunnelStages(deals);
    expect(lead.count).toBe(2);
    expect(lead.value).toBe(1500);
  });

  it("excludes closed deals from the funnel", () => {
    const deals = [
      makeDeal({ id: "d1", columnId: "c0", columnName: "Lead", position: 0 }),
      makeDeal({
        id: "d2",
        columnId: "c1",
        columnName: "Ganho",
        position: 1,
        closed: true,
      }),
    ];
    const stages = buildFunnelStages(deals);
    expect(stages).toHaveLength(1);
    expect(stages[0].stage).toBe("Lead");
  });

  it("treats a missing column as a trailing 'Sem estagio' bucket", () => {
    const orphan = {
      id: "x",
      actual_close_date: null,
      card: {},
    } as unknown as Deal;
    const deals = [
      makeDeal({ id: "d1", columnId: "c0", columnName: "Lead", position: 0 }),
      orphan,
    ];
    const stages = buildFunnelStages(deals);
    expect(stages[stages.length - 1].stage).toBe("Sem estagio");
  });
});
