/**
 * Aggregation helpers for the admin "Visão Geral" (Global Overview) screen.
 *
 * The per-sector rows come from the `get_global_sector_overview` RPC
 * (migration 00208). This module normalises those raw rows and rolls them up
 * into account-wide totals. Pure + exported so the maths is unit-testable.
 */

/** A per-sector overview row, as returned by `get_global_sector_overview`. */
export interface SectorOverviewRow {
  sectorId: string;
  sectorName: string;
  sectorSlug: string;
  boardCount: number;
  cardCount: number;
  overdueCardCount: number;
  openDealCount: number;
  openTicketCount: number;
}

/** Raw RPC row shape (snake_case, numerics may arrive as strings). */
export interface RawSectorOverviewRow {
  sector_id: string;
  sector_name: string;
  sector_slug: string;
  board_count: number | string | null;
  card_count: number | string | null;
  overdue_card_count: number | string | null;
  open_deal_count: number | string | null;
  open_ticket_count: number | string | null;
}

/** Account-wide totals across every sector row. */
export interface OverviewTotals {
  sectorCount: number;
  boardCount: number;
  cardCount: number;
  overdueCardCount: number;
  openDealCount: number;
  openTicketCount: number;
}

/** Coerces a possibly-string Postgres count into a finite number (0 on fail). */
function toCount(value: number | string | null | undefined): number {
  if (value == null) return 0;
  const n = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Maps a raw RPC row into the camelCase {@link SectorOverviewRow}. */
export function mapSectorOverviewRow(
  row: RawSectorOverviewRow
): SectorOverviewRow {
  return {
    sectorId: row.sector_id,
    sectorName: row.sector_name,
    sectorSlug: row.sector_slug,
    boardCount: toCount(row.board_count),
    cardCount: toCount(row.card_count),
    overdueCardCount: toCount(row.overdue_card_count),
    openDealCount: toCount(row.open_deal_count),
    openTicketCount: toCount(row.open_ticket_count),
  };
}

/** Maps a batch of raw rows. */
export function mapSectorOverviewRows(
  rows: readonly RawSectorOverviewRow[]
): SectorOverviewRow[] {
  return rows.map(mapSectorOverviewRow);
}

/** Rolls per-sector rows up into account-wide {@link OverviewTotals}. */
export function summariseOverview(
  rows: readonly SectorOverviewRow[]
): OverviewTotals {
  return rows.reduce<OverviewTotals>(
    (acc, row) => ({
      sectorCount: acc.sectorCount + 1,
      boardCount: acc.boardCount + row.boardCount,
      cardCount: acc.cardCount + row.cardCount,
      overdueCardCount: acc.overdueCardCount + row.overdueCardCount,
      openDealCount: acc.openDealCount + row.openDealCount,
      openTicketCount: acc.openTicketCount + row.openTicketCount,
    }),
    {
      sectorCount: 0,
      boardCount: 0,
      cardCount: 0,
      overdueCardCount: 0,
      openDealCount: 0,
      openTicketCount: 0,
    }
  );
}
