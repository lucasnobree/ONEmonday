-- Migration 00180: security fixes from the module-backlog senior review
--
-- Two issues, both flagged against the 00138–00179 backlog work:
--
--  1. Four SECURITY DEFINER functions added by 00149/00150/00168 did not pin
--     `search_path`, regressing the fix migration 00100 landed. A SECURITY
--     DEFINER function without a pinned search_path is a privilege-escalation
--     vector. ALTER FUNCTION ... SET is idempotent.
--
--  2. The storage SELECT policies for the new private buckets
--     (`finance-receipts`, `support-attachments`, `legal-documents`) only
--     checked `bucket_id`, so any authenticated user could generate a signed
--     URL for any object in the bucket regardless of sector. The metadata
--     tables are correctly sector-scoped, but that does not protect the
--     storage object itself. These policies are tightened to the object's
--     sector. Idempotent: safe to re-run.

-- =============================================
-- 1. Pin search_path on the four SECURITY DEFINER functions
-- =============================================
ALTER FUNCTION get_hr_headcount_analytics(uuid, integer)
  SET search_path = public, pg_temp;
ALTER FUNCTION get_time_off_available_days(uuid, uuid, integer, uuid)
  SET search_path = public, pg_temp;
ALTER FUNCTION get_support_dashboard_stats(uuid)
  SET search_path = public, pg_temp;
ALTER FUNCTION check_sla_status()
  SET search_path = public, pg_temp;

-- =============================================
-- 2a. finance-receipts — object path is `<sector_id>/<expense_id>/<file>`,
--     so the leading folder is the sector. Scope read + delete to it.
-- =============================================
DROP POLICY IF EXISTS "finance_receipts_select" ON storage.objects;
CREATE POLICY "finance_receipts_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'finance-receipts'
    AND user_has_sector_access(((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "finance_receipts_delete" ON storage.objects;
CREATE POLICY "finance_receipts_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'finance-receipts'
    AND user_has_sector_access(((storage.foldername(name))[1])::uuid)
  );

-- =============================================
-- 2b. legal-documents — object path is `<sector_id>/<contract_id>/<file>`.
-- =============================================
DROP POLICY IF EXISTS "legal_documents_view" ON storage.objects;
CREATE POLICY "legal_documents_view" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'legal-documents'
    AND user_has_sector_access(((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "legal_documents_delete" ON storage.objects;
CREATE POLICY "legal_documents_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'legal-documents'
    AND user_has_sector_access(((storage.foldername(name))[1])::uuid)
  );

-- =============================================
-- 2c. support-attachments — object path leads with the uploader's uid, not a
--     sector, so scope reads through the attachment metadata row to the
--     ticket's sector. The metadata row is written right after upload; an
--     orphaned object with no row is simply unreadable (fail closed).
-- =============================================
DROP POLICY IF EXISTS "support_attachments_storage_select" ON storage.objects;
CREATE POLICY "support_attachments_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'support-attachments'
    AND EXISTS (
      SELECT 1
      FROM support_ticket_attachments sta
      JOIN support_tickets st ON st.id = sta.ticket_id
      WHERE sta.file_path = storage.objects.name
        AND user_has_sector_access(st.sector_id)
    )
  );

-- =============================================
-- 3. finance_expense_receipts.file_url stored a public URL against a private
--    bucket (always 403 on access). The column now holds the storage object
--    path, signed on demand — rename it to match the support/legal tables.
-- =============================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'finance_expense_receipts'
      AND column_name = 'file_url'
  ) THEN
    ALTER TABLE finance_expense_receipts RENAME COLUMN file_url TO file_path;
  END IF;
END $$;
