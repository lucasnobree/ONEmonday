-- Migration 00208: Global cross-sector overview RPC
--
-- Nav phase 2 ships an admin-only "Visão Geral" screen that monitors every
-- sector at a glance. Rendering it client-side would mean one COUNT query per
-- sector per metric — dozens of round trips. This adds a single SECURITY
-- DEFINER RPC, `get_global_sector_overview`, that returns one row per sector
-- with the headline counts the screen needs.
--
-- Columns (all per sector):
--   * sector_id, sector_name, sector_slug — identity
--   * board_count       — active boards linked to the sector
--   * card_count        — active cards in the sector
--   * overdue_card_count — active cards past due and not in a done column
--   * open_deal_count   — active CRM deals not yet closed
--   * open_ticket_count — active support tickets not yet resolved
--
-- Access: admin-only. A non-admin caller gets an empty result set — the
-- screen is part of the admin landing and is never shown to other roles.
-- SECURITY DEFINER with a pinned search_path (migration 00180 discipline) so
-- the counts read consistently regardless of the caller's row visibility.
--
-- Idempotent: CREATE OR REPLACE FUNCTION; safe to re-run.

CREATE OR REPLACE FUNCTION get_global_sector_overview()
RETURNS TABLE (
  sector_id          uuid,
  sector_name        text,
  sector_slug        text,
  board_count        bigint,
  card_count         bigint,
  overdue_card_count bigint,
  open_deal_count    bigint,
  open_ticket_count  bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Admin-only: the overview is a global monitoring screen. Non-admins get
  -- nothing rather than a partial, sector-scoped view.
  IF NOT EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = auth.uid() AND u.is_global_admin = true
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.name,
    s.slug,
    (SELECT count(*) FROM board_sectors bs
       JOIN boards b ON b.id = bs.board_id
      WHERE bs.sector_id = s.id AND b.is_active = true) AS board_count,
    (SELECT count(*) FROM cards c
      WHERE c.sector_id = s.id AND c.is_active = true) AS card_count,
    (SELECT count(*) FROM cards c
       JOIN board_columns bc ON bc.id = c.column_id
      WHERE c.sector_id = s.id
        AND c.is_active = true
        AND c.due_date < CURRENT_DATE
        AND bc.is_done_column = false) AS overdue_card_count,
    (SELECT count(*) FROM crm_deals d
      WHERE d.sector_id = s.id
        AND d.is_active = true
        AND d.actual_close_date IS NULL) AS open_deal_count,
    (SELECT count(*) FROM support_tickets t
      WHERE t.sector_id = s.id
        AND t.is_active = true
        AND t.resolved_at IS NULL) AS open_ticket_count
  FROM sectors s
  ORDER BY s.name;
END;
$$;
