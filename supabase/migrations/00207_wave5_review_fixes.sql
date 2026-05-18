-- Migration 00207: security fixes from the Wave 5 senior review
--
-- Four issues flagged against the 00181-00206 Wave 5 work:
--
--  B1 — HR survey anonymity was defeated by a timestamp-correlation leak:
--       hr_survey_participants.responded_at and hr_survey_responses.submitted_at
--       both default to now(), which is identical within submit_survey_response's
--       single transaction. A survey manager (who can SELECT both tables) could
--       join participant -> response on that timestamp and de-anonymise every
--       submission. Dropping responded_at removes the only correlatable column;
--       participation reporting only ever counts rows, never reads a timestamp.
--
--  S1 — get_support_operational_metrics (00197) is SECURITY DEFINER but never
--       checks sector access, so any authenticated user could read another
--       sector's operational metrics. Recreated in plpgsql with an explicit
--       user_has_sector_access() guard.
--
--  S2 — 00010's support_tickets insert/update RLS policies reference a
--       permission resource 'support_ticket' that is never seeded (only
--       'ticket' exists), so non-admin ticket writes silently fell back to
--       global-admin-only. Pre-existing, but fixed here: the policies are
--       rewritten to use the real 'ticket' resource.
--
--  S6 — reorder_board_columns (00182) compared array_length() (NULL for an
--       empty array) without COALESCE, so the column-set guard could be
--       skipped for an empty input. Hardened.
--
-- Idempotent: safe to re-run.

-- =============================================
-- B1. Remove the survey anonymity timestamp-correlation leak
-- =============================================
ALTER TABLE hr_survey_participants DROP COLUMN IF EXISTS responded_at;

-- =============================================
-- S1. get_support_operational_metrics — add the sector-access check
-- =============================================
DROP FUNCTION IF EXISTS get_support_operational_metrics(uuid);
CREATE FUNCTION get_support_operational_metrics(p_sector_id uuid)
RETURNS TABLE (
  avg_first_response_minutes numeric,
  avg_resolution_minutes     numeric,
  sla_attainment_pct         numeric,
  oldest_backlog_minutes     numeric,
  open_backlog_count         bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- The sector argument is the access boundary — enforce it.
  IF NOT user_has_sector_access(p_sector_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT round(avg(
        EXTRACT(EPOCH FROM (st.first_response_at - st.created_at)) / 60.0
      )::numeric, 1)
     FROM support_tickets st
     WHERE st.sector_id = p_sector_id
       AND st.is_active = true
       AND st.first_response_at IS NOT NULL
    ),
    (SELECT round(avg(
        EXTRACT(EPOCH FROM (st.resolved_at - st.created_at)) / 60.0
      )::numeric, 1)
     FROM support_tickets st
     WHERE st.sector_id = p_sector_id
       AND st.is_active = true
       AND st.resolved_at IS NOT NULL
    ),
    (SELECT
       CASE
         WHEN count(*) = 0 THEN NULL
         ELSE round(
           100.0 * count(*) FILTER (
             WHERE st.sla_response_breached = false
               AND st.sla_resolve_breached = false
           ) / count(*), 1
         )
       END
     FROM support_tickets st
     WHERE st.sector_id = p_sector_id
       AND st.is_active = true
       AND st.resolved_at IS NOT NULL
    ),
    (SELECT round(
        EXTRACT(EPOCH FROM (now() - min(st.created_at))) / 60.0, 1
      )::numeric
     FROM support_tickets st
     WHERE st.sector_id = p_sector_id
       AND st.is_active = true
       AND st.resolved_at IS NULL
    ),
    (SELECT count(*)
     FROM support_tickets st
     WHERE st.sector_id = p_sector_id
       AND st.is_active = true
       AND st.resolved_at IS NULL
    );
END;
$$;

-- =============================================
-- S2. Fix the support_tickets write policies to use the seeded 'ticket'
--     permission resource (00010 referenced a non-existent 'support_ticket').
-- =============================================
DROP POLICY IF EXISTS "support_tickets_insert" ON support_tickets;
CREATE POLICY "support_tickets_insert" ON support_tickets
  FOR INSERT TO authenticated
  WITH CHECK (
    is_global_admin() OR
    EXISTS (
      SELECT 1 FROM user_sector_roles usr
      JOIN role_permissions rp ON rp.role_id = usr.role_id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE usr.user_id = auth.uid()
      AND usr.sector_id = support_tickets.sector_id
      AND p.resource = 'ticket' AND p.action = 'create'
    )
  );

DROP POLICY IF EXISTS "support_tickets_update" ON support_tickets;
CREATE POLICY "support_tickets_update" ON support_tickets
  FOR UPDATE TO authenticated
  USING (
    is_global_admin() OR
    EXISTS (
      SELECT 1 FROM user_sector_roles usr
      JOIN role_permissions rp ON rp.role_id = usr.role_id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE usr.user_id = auth.uid()
      AND usr.sector_id = support_tickets.sector_id
      AND p.resource = 'ticket' AND p.action = 'update'
    )
  );

-- =============================================
-- S6. reorder_board_columns — guard the array-length comparison with COALESCE
-- =============================================
CREATE OR REPLACE FUNCTION reorder_board_columns(
  p_board_id   uuid,
  p_column_ids uuid[]
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_can_update boolean;
  v_actual_count int;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM board_sectors bs
    WHERE bs.board_id = p_board_id
    AND user_has_permission(bs.sector_id, 'board_column', 'update')
  ) INTO v_can_update;

  IF NOT v_can_update THEN
    RETURN json_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT count(*) INTO v_actual_count
  FROM board_columns
  WHERE board_id = p_board_id;

  IF v_actual_count <> COALESCE(array_length(p_column_ids, 1), 0)
     OR EXISTS (
       SELECT 1 FROM board_columns
       WHERE board_id = p_board_id
       AND id <> ALL (p_column_ids)
     ) THEN
    RETURN json_build_object('success', false, 'error', 'column_set_mismatch');
  END IF;

  UPDATE board_columns bc
  SET position = ord.idx - 1
  FROM (
    SELECT unnest(p_column_ids) AS id,
           generate_subscripts(p_column_ids, 1) AS idx
  ) ord
  WHERE bc.id = ord.id AND bc.board_id = p_board_id;

  RETURN json_build_object('success', true);
END;
$$;
