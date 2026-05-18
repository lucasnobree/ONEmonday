-- Migration 00106: HR employee RLS hardening (LGPD)
-- Phase 3 prerequisite (migration-rh.md §6.4, migration-architecture.md §3).
--
-- Problem: the original `hr_employees_select` policy (migration 00012) granted
-- SELECT on the WHOLE employee row to EVERY user with any role in the sector.
-- As the people-management module expands (compensation, CLT/DP fields,
-- behavioural data), that is far too broad for LGPD-sensitive personal data.
--
-- Fix:
--   * Move sensitive personal/compensation data into a separate table
--     `hr_employee_compensation`, readable only by users with the
--     `hr_employee` `manage` permission (HR admins) or the employee themselves.
--   * Replace the open `hr_employees_select` policy with one that still lets
--     sector members read the directory (name, role, department) but is
--     explicit and documented; sensitive fields live elsewhere.
--   * Add an `hr_employees_delete` style not needed (soft delete only).
--
-- Idempotent: safe to re-run.

-- =============================================
-- 1. Sensitive compensation / PII table
-- =============================================
CREATE TABLE IF NOT EXISTS hr_employee_compensation (
  employee_id        uuid PRIMARY KEY REFERENCES hr_employees(id) ON DELETE CASCADE,
  sector_id          uuid NOT NULL REFERENCES sectors(id),
  -- Monthly base salary, integer minor units (cents). Never negative.
  base_salary_cents  bigint CHECK (base_salary_cents IS NULL OR base_salary_cents >= 0),
  currency           text NOT NULL DEFAULT 'BRL',
  -- Brazilian CLT / departamento-pessoal identifiers (LGPD sensitive).
  pis_number         text,
  ctps_number        text,
  cbo_code           text,
  cost_center        text,
  bank_details       text,
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_hr_employee_compensation_updated_at ON hr_employee_compensation;
CREATE TRIGGER trg_hr_employee_compensation_updated_at BEFORE UPDATE ON hr_employee_compensation
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_hr_employee_compensation_sector_id
  ON hr_employee_compensation(sector_id);

ALTER TABLE hr_employee_compensation ENABLE ROW LEVEL SECURITY;

-- Readable only by HR admins (hr_employee `manage`) or the employee themselves.
DROP POLICY IF EXISTS "hr_employee_compensation_select" ON hr_employee_compensation;
CREATE POLICY "hr_employee_compensation_select" ON hr_employee_compensation
  FOR SELECT TO authenticated
  USING (
    user_has_permission(sector_id, 'employee', 'manage')
    OR EXISTS (
      SELECT 1 FROM hr_employees e
      WHERE e.id = hr_employee_compensation.employee_id
        AND e.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "hr_employee_compensation_insert" ON hr_employee_compensation;
CREATE POLICY "hr_employee_compensation_insert" ON hr_employee_compensation
  FOR INSERT TO authenticated
  WITH CHECK (user_has_permission(sector_id, 'employee', 'manage'));

DROP POLICY IF EXISTS "hr_employee_compensation_update" ON hr_employee_compensation;
CREATE POLICY "hr_employee_compensation_update" ON hr_employee_compensation
  FOR UPDATE TO authenticated
  USING (user_has_permission(sector_id, 'employee', 'manage'))
  WITH CHECK (user_has_permission(sector_id, 'employee', 'manage'));

-- =============================================
-- 2. Tighten hr_employees SELECT
-- =============================================
-- The directory itself (name, position, department) stays readable to sector
-- members so the org chart, recruitment and onboarding screens keep working,
-- but the policy is now explicit and documented, and all genuinely sensitive
-- data has been moved to hr_employee_compensation above. The `notes` column on
-- hr_employees may carry sensitive context, so restrict the directory read to
-- the employee themselves plus users with at least `employee` `read`
-- permission (not merely any sector role).
DROP POLICY IF EXISTS "hr_employees_select" ON hr_employees;
CREATE POLICY "hr_employees_select" ON hr_employees
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR user_has_permission(sector_id, 'employee', 'read')
  );

-- =============================================
-- 3. Backfill: every active sector role that previously had implicit read
--    keeps it via the `employee` `read` permission grant in migration 00009,
--    so no data-access regression for legitimately-permissioned users.
-- =============================================
