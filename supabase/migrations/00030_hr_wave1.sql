-- Migration 00030: HR wave 1
-- Adds document expiry tracking and onboarding-item responsible role.
-- Idempotent: safe to run more than once.

-- 1. Document expiry tracking on hr_employee_documents.
--    Lets HR record (and the app surface) when contracts / IDs / certificates lapse.
--    hr_employee_documents already has RLS enabled (migration 00015); adding a
--    nullable column does not require new policies.
ALTER TABLE hr_employee_documents
  ADD COLUMN IF NOT EXISTS expiry_date date;

CREATE INDEX IF NOT EXISTS idx_hr_employee_documents_expiry_date
  ON hr_employee_documents (expiry_date)
  WHERE expiry_date IS NOT NULL;

-- 2. Responsible role on onboarding instance items.
--    Onboarding templates already store responsible_role per jsonb item, but the
--    expanded hr_onboarding_items rows dropped it. Persisting it here lets the
--    detail sheet show who owns each step. hr_onboarding_items already has RLS
--    enabled (migration 00012).
ALTER TABLE hr_onboarding_items
  ADD COLUMN IF NOT EXISTS responsible_role text;

-- 3. RPC: documents expiring within a window for a sector.
--    SECURITY DEFINER + explicit sector check via user_sector_roles, mirroring
--    get_employee_time_off_balance in migration 00015.
CREATE OR REPLACE FUNCTION get_expiring_hr_documents(
  p_sector_id uuid,
  p_within_days integer DEFAULT 30
)
RETURNS TABLE (
  id uuid,
  employee_id uuid,
  employee_name text,
  name text,
  category text,
  expiry_date date,
  days_until_expiry integer
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    d.id,
    d.employee_id,
    e.full_name,
    d.name,
    d.category,
    d.expiry_date,
    (d.expiry_date - CURRENT_DATE)::integer
  FROM hr_employee_documents d
  JOIN hr_employees e ON e.id = d.employee_id
  WHERE d.sector_id = p_sector_id
    AND d.expiry_date IS NOT NULL
    AND d.expiry_date <= CURRENT_DATE + (p_within_days || ' days')::interval
    AND d.sector_id IN (
      SELECT sector_id FROM user_sector_roles WHERE user_id = auth.uid()
    )
  ORDER BY d.expiry_date ASC;
$$;
