-- Migration 00139: Expense receipts (Despesas — comprovantes).
-- Deferred Finance backlog item E1: expenses had no file attachment at all.
-- This adds receipt capture — an image/PDF uploaded to Supabase Storage and
-- recorded against the expense.
--
-- Storage: a private `finance-receipts` bucket. Files are stored under
-- `<sector_id>/<expense_id>/<timestamp>_<name>` and served via the recorded
-- public URL (the bucket is private; access is mediated by the app + RLS on
-- this metadata table). Idempotent: safe to re-run.

-- =============================================
-- Storage bucket for expense receipts
-- =============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'finance-receipts',
  'finance-receipts',
  false,
  10485760,  -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE
  SET file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Authenticated users can upload to / read / delete from the receipts bucket;
-- finer access control is enforced on the metadata table below.
DROP POLICY IF EXISTS "finance_receipts_insert" ON storage.objects;
CREATE POLICY "finance_receipts_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'finance-receipts');

DROP POLICY IF EXISTS "finance_receipts_select" ON storage.objects;
CREATE POLICY "finance_receipts_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'finance-receipts');

DROP POLICY IF EXISTS "finance_receipts_delete" ON storage.objects;
CREATE POLICY "finance_receipts_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'finance-receipts');

-- =============================================
-- finance_expense_receipts — receipt metadata
-- =============================================
CREATE TABLE IF NOT EXISTS finance_expense_receipts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id   uuid NOT NULL REFERENCES finance_expenses(id) ON DELETE CASCADE,
  -- Denormalized sector for straightforward RLS without a join.
  sector_id    uuid NOT NULL REFERENCES sectors(id),
  -- Original file name shown in the UI.
  file_name    text NOT NULL,
  -- Public URL of the stored object in the `finance-receipts` bucket.
  file_url     text NOT NULL,
  -- File size in bytes.
  file_size    bigint NOT NULL DEFAULT 0 CHECK (file_size >= 0),
  -- MIME type as reported by the browser at upload time.
  mime_type    text,
  uploaded_by  uuid NOT NULL REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finance_expense_receipts_expense
  ON finance_expense_receipts (expense_id);
CREATE INDEX IF NOT EXISTS idx_finance_expense_receipts_sector
  ON finance_expense_receipts (sector_id);

ALTER TABLE finance_expense_receipts ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS — finance_expense_receipts  (`expense` resource)
-- A receipt inherits the access rules of the expense it documents.
-- =============================================
DROP POLICY IF EXISTS "finance_expense_receipts_select"
  ON finance_expense_receipts;
CREATE POLICY "finance_expense_receipts_select" ON finance_expense_receipts
  FOR SELECT TO authenticated
  USING (user_has_sector_access(sector_id));

DROP POLICY IF EXISTS "finance_expense_receipts_insert"
  ON finance_expense_receipts;
CREATE POLICY "finance_expense_receipts_insert" ON finance_expense_receipts
  FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid() AND
    user_has_permission(sector_id, 'expense', 'update')
  );

DROP POLICY IF EXISTS "finance_expense_receipts_delete"
  ON finance_expense_receipts;
CREATE POLICY "finance_expense_receipts_delete" ON finance_expense_receipts
  FOR DELETE TO authenticated
  USING (user_has_permission(sector_id, 'expense', 'update'));
