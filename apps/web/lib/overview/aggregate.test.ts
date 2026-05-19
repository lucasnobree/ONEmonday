import { describe, it, expect } from "vitest";
import {
  mapSectorOverviewRow,
  mapSectorOverviewRows,
  summariseOverview,
  type RawSectorOverviewRow,
  type SectorOverviewRow,
} from "./aggregate";

function rawRow(
  overrides: Partial<RawSectorOverviewRow> = {}
): RawSectorOverviewRow {
  return {
    sector_id: "s1",
    sector_name: "Setor 1",
    sector_slug: "s1",
    board_count: 3,
    card_count: 40,
    overdue_card_count: 5,
    open_deal_count: 7,
    open_ticket_count: 2,
    ...overrides,
  };
}

describe("mapSectorOverviewRow", () => {
  it("maps snake_case fields into camelCase", () => {
    const row = mapSectorOverviewRow(rawRow());
    expect(row).toEqual<SectorOverviewRow>({
      sectorId: "s1",
      sectorName: "Setor 1",
      sectorSlug: "s1",
      boardCount: 3,
      cardCount: 40,
      overdueCardCount: 5,
      openDealCount: 7,
      openTicketCount: 2,
    });
  });

  it("coerces string counts (Postgres bigint over the wire) to numbers", () => {
    const row = mapSectorOverviewRow(
      rawRow({ card_count: "40", open_deal_count: "7" })
    );
    expect(row.cardCount).toBe(40);
    expect(row.openDealCount).toBe(7);
  });

  it("defaults null or malformed counts to zero", () => {
    const row = mapSectorOverviewRow(
      rawRow({ board_count: null, card_count: "abc", overdue_card_count: -1 })
    );
    expect(row.boardCount).toBe(0);
    expect(row.cardCount).toBe(0);
    expect(row.overdueCardCount).toBe(0);
  });
});

describe("mapSectorOverviewRows", () => {
  it("maps an empty list to an empty list", () => {
    expect(mapSectorOverviewRows([])).toEqual([]);
  });

  it("maps every row", () => {
    const rows = mapSectorOverviewRows([
      rawRow({ sector_id: "a" }),
      rawRow({ sector_id: "b" }),
    ]);
    expect(rows.map((r) => r.sectorId)).toEqual(["a", "b"]);
  });
});

describe("summariseOverview", () => {
  it("returns all-zero totals for no sectors", () => {
    expect(summariseOverview([])).toEqual({
      sectorCount: 0,
      boardCount: 0,
      cardCount: 0,
      overdueCardCount: 0,
      openDealCount: 0,
      openTicketCount: 0,
    });
  });

  it("sums every metric across sectors", () => {
    const rows = mapSectorOverviewRows([
      rawRow({
        sector_id: "a",
        board_count: 2,
        card_count: 10,
        overdue_card_count: 1,
        open_deal_count: 3,
        open_ticket_count: 4,
      }),
      rawRow({
        sector_id: "b",
        board_count: 5,
        card_count: 20,
        overdue_card_count: 6,
        open_deal_count: 7,
        open_ticket_count: 8,
      }),
    ]);
    expect(summariseOverview(rows)).toEqual({
      sectorCount: 2,
      boardCount: 7,
      cardCount: 30,
      overdueCardCount: 7,
      openDealCount: 10,
      openTicketCount: 12,
    });
  });
});
