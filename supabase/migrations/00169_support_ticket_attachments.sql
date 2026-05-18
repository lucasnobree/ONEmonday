-- Migration 00169: Support Desk ticket attachments
-- Adds file attachments scoped to a support ticket (screenshots, logs) plus a
-- dedicated private storage bucket. Reads/writes are gated on the ticket's
-- sector, consistent with the other Support Desk policies.
-- Idempotent: safe to re-run.

-- =============================================
-- Attachment records
-- =============================================
CREATE TABLE IF NOT EXISTS support_ticket_attachments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  file_path   text NOT NULL,
  file_name   text NOT NULL,
  file_size   bigint NOT NULL DEFAULT 0,
  mime_type   text,
  uploaded_by uuid NOT NULL REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_ticket_attachments_ticket_id
  ON support_ticket_attachments(ticket_id);

-- =============================================
-- Enable RLS
-- =============================================
ALTER TABLE support_ticket_attachments ENABLE ROW LEVEL SECURITY;

-- Reads require access to the ticket's sector.
DROP POLICY IF EXISTS "support_ticket_attachments_select" ON support_ticket_attachments;
CREATE POLICY "support_ticket_attachments_select" ON support_ticket_attachments
  FOR SELECT TO authenticated
  USING (
    ticket_id IN (
      SELECT id FROM support_tickets st
      WHERE user_has_sector_access(st.sector_id)
    )
  );

-- Upload requires ticket:update on the ticket's sector and self-ownership.
DROP POLICY IF EXISTS "support_ticket_attachments_insert" ON support_ticket_attachments;
CREATE POLICY "support_ticket_attachments_insert" ON support_ticket_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND ticket_id IN (
      SELECT id FROM support_tickets st
      WHERE user_has_permission(st.sector_id, 'ticket', 'update')
    )
  );

-- Delete requires ticket:update on the ticket's sector.
DROP POLICY IF EXISTS "support_ticket_attachments_delete" ON support_ticket_attachments;
CREATE POLICY "support_ticket_attachments_delete" ON support_ticket_attachments
  FOR DELETE TO authenticated
  USING (
    ticket_id IN (
      SELECT id FROM support_tickets st
      WHERE user_has_permission(st.sector_id, 'ticket', 'update')
    )
  );

-- =============================================
-- Private storage bucket for ticket attachments
-- =============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'support-attachments',
  'support-attachments',
  false,
  10485760,  -- 10MB limit
  ARRAY[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf', 'text/plain', 'text/csv', 'application/zip',
    'application/json',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "support_attachments_storage_select" ON storage.objects;
CREATE POLICY "support_attachments_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'support-attachments');

DROP POLICY IF EXISTS "support_attachments_storage_insert" ON storage.objects;
CREATE POLICY "support_attachments_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'support-attachments');

DROP POLICY IF EXISTS "support_attachments_storage_delete" ON storage.objects;
CREATE POLICY "support_attachments_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'support-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
