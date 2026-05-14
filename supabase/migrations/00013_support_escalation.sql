-- Migration 00013: Support Desk escalation tracking and SLA notifications

-- Add escalation tracking to support_tickets
ALTER TABLE support_tickets
  ADD COLUMN escalated_to_sector_id uuid REFERENCES sectors(id),
  ADD COLUMN escalated_at timestamptz,
  ADD COLUMN escalated_by uuid REFERENCES users(id),
  ADD COLUMN escalation_reason text;

-- Escalation history log
CREATE TABLE ticket_escalation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  from_sector_id uuid NOT NULL REFERENCES sectors(id),
  to_sector_id uuid NOT NULL REFERENCES sectors(id),
  escalated_by uuid NOT NULL REFERENCES users(id),
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ticket_escalation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "escalation_log_select" ON ticket_escalation_log
  FOR SELECT TO authenticated
  USING (
    from_sector_id IN (SELECT sector_id FROM user_sector_roles WHERE user_id = auth.uid())
    OR to_sector_id IN (SELECT sector_id FROM user_sector_roles WHERE user_id = auth.uid())
  );

CREATE POLICY "escalation_log_insert" ON ticket_escalation_log
  FOR INSERT TO authenticated
  WITH CHECK (
    from_sector_id IN (SELECT sector_id FROM user_sector_roles WHERE user_id = auth.uid())
  );

-- Support notifications table
CREATE TABLE support_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('sla_warning', 'sla_breach')),
  message text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE support_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "support_notifications_select" ON support_notifications
  FOR SELECT TO authenticated
  USING (
    ticket_id IN (
      SELECT id FROM support_tickets
      WHERE sector_id IN (SELECT sector_id FROM user_sector_roles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "support_notifications_update" ON support_notifications
  FOR UPDATE TO authenticated
  USING (
    ticket_id IN (
      SELECT id FROM support_tickets
      WHERE sector_id IN (SELECT sector_id FROM user_sector_roles WHERE user_id = auth.uid())
    )
  );

-- RPC to check SLA status
-- NOTE: support_tickets does NOT have title, priority, or status columns.
-- title and priority live on the linked cards table (via card_id).
-- SLA columns are sla_response_due_at and sla_resolve_due_at.
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
    AND (st.sla_response_due_at IS NOT NULL OR st.sla_resolve_due_at IS NOT NULL)
    AND st.sector_id IN (SELECT sector_id FROM user_sector_roles WHERE user_id = auth.uid());
$$;
