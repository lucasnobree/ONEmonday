-- Migration 00197: Support Desk operational metrics RPC
--
-- Wave 4 audit H1: the dashboard reports bare counts but no operational metric
-- a support manager steers by. This adds `get_support_operational_metrics`,
-- which returns first-response time, resolution time, SLA attainment % and
-- backlog age for a sector in one round trip.
--
--  * avg_first_response_minutes — mean (first_response_at - created_at) over
--    tickets that recorded a first response.
--  * avg_resolution_minutes     — mean (resolved_at - created_at) over
--    resolved tickets.
--  * sla_attainment_pct         — % of resolved tickets that breached neither
--    the response nor the resolution SLA.
--  * oldest_backlog_minutes     — age of the oldest still-open (non-resolved)
--    ticket; the backlog-age headline metric.
--  * open_backlog_count         — number of still-open tickets.
--
-- SECURITY DEFINER with a pinned search_path (migration 00180 discipline) so
-- the metrics read consistently regardless of the caller's row visibility,
-- while the sector argument is the access boundary.
--
-- Idempotent: safe to re-run.

CREATE OR REPLACE FUNCTION get_support_operational_metrics(p_sector_id uuid)
RETURNS TABLE (
  avg_first_response_minutes numeric,
  avg_resolution_minutes     numeric,
  sla_attainment_pct         numeric,
  oldest_backlog_minutes     numeric,
  open_backlog_count         bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    (SELECT round(avg(
        EXTRACT(EPOCH FROM (st.first_response_at - st.created_at)) / 60.0
      )::numeric, 1)
     FROM support_tickets st
     WHERE st.sector_id = p_sector_id
       AND st.is_active = true
       AND st.first_response_at IS NOT NULL
    ) AS avg_first_response_minutes,

    (SELECT round(avg(
        EXTRACT(EPOCH FROM (st.resolved_at - st.created_at)) / 60.0
      )::numeric, 1)
     FROM support_tickets st
     WHERE st.sector_id = p_sector_id
       AND st.is_active = true
       AND st.resolved_at IS NOT NULL
    ) AS avg_resolution_minutes,

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
    ) AS sla_attainment_pct,

    (SELECT round(
        EXTRACT(EPOCH FROM (now() - min(st.created_at))) / 60.0, 1
      )::numeric
     FROM support_tickets st
     WHERE st.sector_id = p_sector_id
       AND st.is_active = true
       AND st.resolved_at IS NULL
    ) AS oldest_backlog_minutes,

    (SELECT count(*)
     FROM support_tickets st
     WHERE st.sector_id = p_sector_id
       AND st.is_active = true
       AND st.resolved_at IS NULL
    ) AS open_backlog_count;
$$;
