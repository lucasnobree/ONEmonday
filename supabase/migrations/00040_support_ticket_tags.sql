-- Migration 00040: Support Desk ticket tags
-- Adds a per-sector tag vocabulary and a ticket<->tag join table.
-- Idempotent: safe to re-run.

-- =============================================
-- Tag vocabulary (one row per distinct tag in a sector)
-- =============================================
CREATE TABLE IF NOT EXISTS ticket_tags (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id  uuid NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
  name       text NOT NULL,
  color      text NOT NULL DEFAULT 'gray'
             CHECK (color IN ('gray', 'red', 'orange', 'yellow', 'green', 'blue', 'purple')),
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sector_id, name)
);

CREATE INDEX IF NOT EXISTS idx_ticket_tags_sector_id ON ticket_tags(sector_id);

-- =============================================
-- Ticket <-> tag join table
-- =============================================
CREATE TABLE IF NOT EXISTS support_ticket_tags (
  ticket_id  uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  tag_id     uuid NOT NULL REFERENCES ticket_tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ticket_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_support_ticket_tags_ticket_id ON support_ticket_tags(ticket_id);
CREATE INDEX IF NOT EXISTS idx_support_ticket_tags_tag_id ON support_ticket_tags(tag_id);

-- =============================================
-- Enable RLS
-- =============================================
ALTER TABLE ticket_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_ticket_tags ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS Policies: ticket_tags
-- Reads are gated on sector membership; writes require ticket:update,
-- consistent with the other Support Desk write policies (00010).
-- =============================================
DROP POLICY IF EXISTS "ticket_tags_select" ON ticket_tags;
CREATE POLICY "ticket_tags_select" ON ticket_tags
  FOR SELECT TO authenticated
  USING (user_has_sector_access(sector_id));

DROP POLICY IF EXISTS "ticket_tags_insert" ON ticket_tags;
CREATE POLICY "ticket_tags_insert" ON ticket_tags
  FOR INSERT TO authenticated
  WITH CHECK (user_has_permission(sector_id, 'ticket', 'update'));

DROP POLICY IF EXISTS "ticket_tags_update" ON ticket_tags;
CREATE POLICY "ticket_tags_update" ON ticket_tags
  FOR UPDATE TO authenticated
  USING (user_has_permission(sector_id, 'ticket', 'update'))
  WITH CHECK (user_has_permission(sector_id, 'ticket', 'update'));

DROP POLICY IF EXISTS "ticket_tags_delete" ON ticket_tags;
CREATE POLICY "ticket_tags_delete" ON ticket_tags
  FOR DELETE TO authenticated
  USING (user_has_permission(sector_id, 'ticket', 'update'));

-- =============================================
-- RLS Policies: support_ticket_tags
-- Reads require access to the ticket's sector; link/unlink requires
-- ticket:update on that sector.
-- =============================================
DROP POLICY IF EXISTS "support_ticket_tags_select" ON support_ticket_tags;
CREATE POLICY "support_ticket_tags_select" ON support_ticket_tags
  FOR SELECT TO authenticated
  USING (
    ticket_id IN (
      SELECT id FROM support_tickets st
      WHERE user_has_sector_access(st.sector_id)
    )
  );

DROP POLICY IF EXISTS "support_ticket_tags_insert" ON support_ticket_tags;
CREATE POLICY "support_ticket_tags_insert" ON support_ticket_tags
  FOR INSERT TO authenticated
  WITH CHECK (
    ticket_id IN (
      SELECT id FROM support_tickets st
      WHERE user_has_permission(st.sector_id, 'ticket', 'update')
    )
  );

DROP POLICY IF EXISTS "support_ticket_tags_delete" ON support_ticket_tags;
CREATE POLICY "support_ticket_tags_delete" ON support_ticket_tags
  FOR DELETE TO authenticated
  USING (
    ticket_id IN (
      SELECT id FROM support_tickets st
      WHERE user_has_permission(st.sector_id, 'ticket', 'update')
    )
  );
