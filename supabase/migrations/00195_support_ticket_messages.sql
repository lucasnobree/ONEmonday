-- Migration 00195: Support Desk public reply channel
--
-- Wave 4 audit H3: the ticket conversation never reaches the requester. The
-- detail sheet only posts internal `card_comments`. This migration introduces
-- a distinct `ticket_messages` table that stores agent replies with an
-- explicit visibility — `internal` (a private note, equivalent to the legacy
-- comment) or `public` (a reply delivered to the requester). For `email`-channel
-- tickets a public reply is sent out via the existing Resend ESP adapter; the
-- row records the delivery outcome so the timeline shows what actually shipped.
--
-- Idempotent: safe to re-run.

-- =============================================
-- ticket_messages
-- =============================================
CREATE TABLE IF NOT EXISTS ticket_messages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id     uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_id     uuid NOT NULL REFERENCES users(id),
  -- internal = private agent note; public = reply delivered to the requester.
  visibility    text NOT NULL DEFAULT 'internal'
    CHECK (visibility IN ('internal', 'public')),
  body          text NOT NULL,
  -- Delivery state for public replies: pending = queued, sent = ESP accepted,
  -- skipped = no ESP configured (no-op mode), failed = ESP rejected,
  -- not_applicable = internal note or non-email channel (no delivery attempt).
  delivery_status text NOT NULL DEFAULT 'not_applicable'
    CHECK (delivery_status IN
      ('not_applicable', 'pending', 'sent', 'skipped', 'failed')),
  -- ESP message id (Resend) when a send was accepted.
  delivery_ref  text,
  -- Human-readable failure detail when delivery_status = 'failed'.
  delivery_error text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket
  ON ticket_messages(ticket_id, created_at);

ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS — a ticket message inherits the access of its parent ticket's sector.
-- =============================================
DROP POLICY IF EXISTS "ticket_messages_select" ON ticket_messages;
CREATE POLICY "ticket_messages_select" ON ticket_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM support_tickets st
      WHERE st.id = ticket_messages.ticket_id
      AND user_has_sector_access(st.sector_id)
    )
  );

DROP POLICY IF EXISTS "ticket_messages_insert" ON ticket_messages;
CREATE POLICY "ticket_messages_insert" ON ticket_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM support_tickets st
      WHERE st.id = ticket_messages.ticket_id
      AND (
        is_global_admin() OR
        EXISTS (
          SELECT 1 FROM user_sector_roles usr
          JOIN role_permissions rp ON rp.role_id = usr.role_id
          JOIN permissions p ON p.id = rp.permission_id
          WHERE usr.user_id = auth.uid()
          AND usr.sector_id = st.sector_id
          AND p.resource = 'support_ticket' AND p.action = 'update'
        )
      )
    )
  );

DROP POLICY IF EXISTS "ticket_messages_update" ON ticket_messages;
CREATE POLICY "ticket_messages_update" ON ticket_messages
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM support_tickets st
      WHERE st.id = ticket_messages.ticket_id
      AND (
        is_global_admin() OR
        EXISTS (
          SELECT 1 FROM user_sector_roles usr
          JOIN role_permissions rp ON rp.role_id = usr.role_id
          JOIN permissions p ON p.id = rp.permission_id
          WHERE usr.user_id = auth.uid()
          AND usr.sector_id = st.sector_id
          AND p.resource = 'support_ticket' AND p.action = 'update'
        )
      )
    )
  );
