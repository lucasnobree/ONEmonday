-- Migration 00214: Support operational metrics — cross-sector aggregate mode
--
-- See migration 00209 for the rationale. Recreates
-- `get_support_operational_metrics` with a nullable `p_sector_id`: NULL means
-- "every sector" and is gated to global admins; a concrete id keeps the
-- existing per-sector access check.
--
-- SECURITY DEFINER with a pinned search_path. Idempotent.

CREATE OR REPLACE FUNCTION get_support_operational_metrics(p_sector_id uuid DEFAULT NULL)
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
  -- The sector argument is the access boundary — enforce it. The all-sectors
  -- aggregate (NULL) is admin-only.
  IF p_sector_id IS NULL THEN
    IF NOT is_global_admin() THEN
      RAISE EXCEPTION 'Access denied';
    END IF;
  ELSIF NOT user_has_sector_access(p_sector_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT round(avg(
        EXTRACT(EPOCH FROM (st.first_response_at - st.created_at)) / 60.0
      )::numeric, 1)
     FROM support_tickets st
     WHERE (p_sector_id IS NULL OR st.sector_id = p_sector_id)
       AND st.is_active = true
       AND st.first_response_at IS NOT NULL
    ),
    (SELECT round(avg(
        EXTRACT(EPOCH FROM (st.resolved_at - st.created_at)) / 60.0
      )::numeric, 1)
     FROM support_tickets st
     WHERE (p_sector_id IS NULL OR st.sector_id = p_sector_id)
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
     WHERE (p_sector_id IS NULL OR st.sector_id = p_sector_id)
       AND st.is_active = true
       AND st.resolved_at IS NOT NULL
    ),
    (SELECT round(
        EXTRACT(EPOCH FROM (now() - min(st.created_at))) / 60.0, 1
      )::numeric
     FROM support_tickets st
     WHERE (p_sector_id IS NULL OR st.sector_id = p_sector_id)
       AND st.is_active = true
       AND st.resolved_at IS NULL
    ),
    (SELECT count(*)
     FROM support_tickets st
     WHERE (p_sector_id IS NULL OR st.sector_id = p_sector_id)
       AND st.is_active = true
       AND st.resolved_at IS NULL
    );
END;
$$;
