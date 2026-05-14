-- =============================================
-- HR Employee Documents + Time-Off Balance RPC
-- =============================================

-- 1. hr_employee_documents
CREATE TABLE hr_employee_documents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
  name        text NOT NULL,
  file_url    text NOT NULL,
  file_size   bigint,
  category    text NOT NULL CHECK (category IN ('contract', 'id', 'certificate', 'other')),
  uploaded_by uuid NOT NULL REFERENCES users(id),
  sector_id   uuid NOT NULL REFERENCES sectors(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE hr_employee_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hr_documents_select" ON hr_employee_documents
  FOR SELECT TO authenticated
  USING (sector_id IN (SELECT sector_id FROM user_sector_roles WHERE user_id = auth.uid()));

CREATE POLICY "hr_documents_insert" ON hr_employee_documents
  FOR INSERT TO authenticated
  WITH CHECK (sector_id IN (SELECT sector_id FROM user_sector_roles WHERE user_id = auth.uid()));

CREATE POLICY "hr_documents_update" ON hr_employee_documents
  FOR UPDATE TO authenticated
  USING (sector_id IN (SELECT sector_id FROM user_sector_roles WHERE user_id = auth.uid()));

CREATE POLICY "hr_documents_delete" ON hr_employee_documents
  FOR DELETE TO authenticated
  USING (sector_id IN (SELECT sector_id FROM user_sector_roles WHERE user_id = auth.uid()));

CREATE INDEX idx_hr_employee_documents_employee_id ON hr_employee_documents(employee_id);
CREATE INDEX idx_hr_employee_documents_sector_id ON hr_employee_documents(sector_id);

-- 2. Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('hr-documents', 'hr-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "hr_docs_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'hr-documents');

CREATE POLICY "hr_docs_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'hr-documents');

CREATE POLICY "hr_docs_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'hr-documents');

-- 3. Time-off balance RPC
CREATE OR REPLACE FUNCTION get_employee_time_off_balance(p_employee_id uuid, p_year integer)
RETURNS TABLE (
  policy_id uuid,
  policy_name text,
  total_days numeric,
  used_days numeric,
  pending_days numeric,
  available_days numeric
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    p.id,
    p.name,
    COALESCE(b.total_days, 0)::numeric,
    COALESCE(
      (SELECT SUM(r.days_count)::numeric FROM hr_time_off_requests r
       WHERE r.employee_id = p_employee_id
         AND r.policy_id = p.id
         AND r.status = 'approved'
         AND EXTRACT(YEAR FROM r.start_date) = p_year),
      0
    ),
    COALESCE(
      (SELECT SUM(r.days_count)::numeric FROM hr_time_off_requests r
       WHERE r.employee_id = p_employee_id
         AND r.policy_id = p.id
         AND r.status = 'pending'
         AND EXTRACT(YEAR FROM r.start_date) = p_year),
      0
    ),
    COALESCE(b.total_days, 0)::numeric
    - COALESCE(
        (SELECT SUM(r.days_count)::numeric FROM hr_time_off_requests r
         WHERE r.employee_id = p_employee_id
           AND r.policy_id = p.id
           AND r.status IN ('approved', 'pending')
           AND EXTRACT(YEAR FROM r.start_date) = p_year),
        0
      )
  FROM hr_time_off_policies p
  LEFT JOIN hr_time_off_balances b ON b.policy_id = p.id AND b.employee_id = p_employee_id AND b.year = p_year
  WHERE p.sector_id IN (SELECT sector_id FROM user_sector_roles WHERE user_id = auth.uid());
$$;
