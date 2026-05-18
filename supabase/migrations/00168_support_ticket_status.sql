-- Migration 00168: Support Desk multi-state ticket status
-- Replaces the binary (open/resolved) model with an explicit status enum so
-- the desk can represent "waiting on customer" / "on hold" and pause the SLA
-- clock while a ticket is not actionable by the agent.
-- Idempotent: safe to re-run.

-- =============================================
-- Status + SLA-pause columns on support_tickets
-- =============================================
ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'open', 'pending', 'on_hold', 'resolved')),
  -- Timestamp the SLA clock was paused at (NULL while running).
  ADD COLUMN IF NOT EXISTS sla_paused_at timestamptz,
  -- Cumulative paused time already folded into the SLA due dates.
  ADD COLUMN IF NOT EXISTS sla_paused_ms bigint NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_support_tickets_status
  ON support_tickets(sector_id, status);

-- =============================================
-- Backfill status from the existing binary signals.
-- resolved_at wins; otherwise a recorded first response means "open",
-- a fresh ticket stays "new".
-- =============================================
UPDATE support_tickets
SET status = CASE
  WHEN resolved_at IS NOT NULL THEN 'resolved'
  WHEN first_response_at IS NOT NULL THEN 'open'
  ELSE 'new'
END
WHERE status = 'new';

-- =============================================
-- Refresh the dashboard stats RPC so "open" counts every non-resolved
-- status (new / open / pending / on_hold), consistent with the new model.
-- =============================================
CREATE OR REPLACE FUNCTION get_support_dashboard_stats(p_sector_id uuid)
RETURNS TABLE (
  total_open        bigint,
  total_resolved_today bigint,
  sla_compliance_pct numeric,
  avg_csat          numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT count(*)
     FROM support_tickets st
     JOIN cards c ON c.id = st.card_id
     WHERE st.sector_id = p_sector_id
     AND st.is_active = true
     AND st.status <> 'resolved'
     AND c.is_active = true
    ) AS total_open,

    (SELECT count(*)
     FROM support_tickets st
     WHERE st.sector_id = p_sector_id
     AND st.is_active = true
     AND st.resolved_at >= date_trunc('day', now())
    ) AS total_resolved_today,

    (SELECT
      CASE
        WHEN count(*) = 0 THEN 100.0
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
    ) AS sla_compliance_pct,

    (SELECT round(avg(st.csat_rating)::numeric, 2)
     FROM support_tickets st
     WHERE st.sector_id = p_sector_id
     AND st.is_active = true
     AND st.csat_rating IS NOT NULL
    ) AS avg_csat;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- SLA status RPC: exclude paused tickets (pending / on_hold) so a ticket
-- waiting on the customer never shows as breaching the agent SLA.
-- =============================================
CREATE OR REPLACE FUNCTION check_sla_status()
RETURNS TABLE (
  ticket_id uuid,
  ticket_title text,
  priority text,
  sla_type text,
  deadline_at timestamptz,
  remaining_pct numeric
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    st.id,
    c.title,
    c.priority,
    CASE
      WHEN st.first_response_at IS NULL THEN 'first_response'
      ELSE 'resolution'
    END,
    CASE
      WHEN st.first_response_at IS NULL THEN st.sla_response_due_at
      ELSE st.sla_resolve_due_at
    END,
    CASE
      WHEN st.first_response_at IS NULL AND st.sla_response_due_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (st.sla_response_due_at - now())) /
             NULLIF(EXTRACT(EPOCH FROM (st.sla_response_due_at - st.created_at)), 0) * 100
      WHEN st.sla_resolve_due_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (st.sla_resolve_due_at - now())) /
             NULLIF(EXTRACT(EPOCH FROM (st.sla_resolve_due_at - st.created_at)), 0) * 100
      ELSE NULL
    END
  FROM support_tickets st
  JOIN cards c ON c.id = st.card_id
  WHERE st.resolved_at IS NULL
    AND st.is_active = true
    AND c.is_active = true
    AND st.status NOT IN ('pending', 'on_hold')
    AND (st.sla_response_due_at IS NOT NULL OR st.sla_resolve_due_at IS NOT NULL)
    AND st.sector_id IN (SELECT sector_id FROM user_sector_roles WHERE user_id = auth.uid());
$$;
