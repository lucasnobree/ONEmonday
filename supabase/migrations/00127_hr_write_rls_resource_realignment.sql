-- Migration 00127: HR write-RLS resource realignment
-- Migration-review finding HR S2.
--
-- Problem: migration 00012 wrote the INSERT / UPDATE RLS policies for the
-- core HR write tables against permission resources that were never seeded:
--
--   * hr_employees                -> 'hr_employee'
--   * hr_time_off_policies         -> 'hr_time_off'
--   * hr_time_off_requests         -> 'hr_time_off'
--   * hr_time_off_balances         -> 'hr_time_off'
--   * hr_onboarding_templates      -> 'hr_onboarding'
--   * hr_onboarding_instances      -> 'hr_onboarding'
--   * hr_onboarding_items          -> 'hr_onboarding'
--
-- Migration 00009 only seeds the HR resources `employee`, `time_off`,
-- `job_opening`, `candidate` and `onboarding`. `user_has_permission(...)`
-- returns false for any unseeded resource, so today ONLY global admins can
-- write these tables — a permissioned HR user is silently blocked. The
-- application code (lib/actions/hr/*) already gates on the real resources
-- (`employee`, `time_off`, `onboarding`), so the RLS layer is the only thing
-- out of sync.
--
-- Fix: realign every affected write policy onto the real, seeded resources —
-- mirroring how migration 00107 fixed the recruitment policies
-- (`hr_recruitment` -> `job_opening` / `candidate`). UPDATE policies also gain
-- a matching WITH CHECK so a permissioned user cannot move a row out of a
-- sector they control, again mirroring 00107.
--
-- Pure RLS realignment: no schema/data change, no SELECT-policy change.
-- Idempotent: every policy is dropped-then-recreated; safe to re-run.

-- =============================================
-- 1. hr_employees
-- =============================================
DROP POLICY IF EXISTS "hr_employees_insert" ON hr_employees;
CREATE POLICY "hr_employees_insert" ON hr_employees
  FOR INSERT TO authenticated
  WITH CHECK (user_has_permission(sector_id, 'employee', 'create'));

DROP POLICY IF EXISTS "hr_employees_update" ON hr_employees;
CREATE POLICY "hr_employees_update" ON hr_employees
  FOR UPDATE TO authenticated
  USING (user_has_permission(sector_id, 'employee', 'update'))
  WITH CHECK (user_has_permission(sector_id, 'employee', 'update'));

-- =============================================
-- 2. hr_time_off_policies
-- =============================================
DROP POLICY IF EXISTS "hr_time_off_policies_insert" ON hr_time_off_policies;
CREATE POLICY "hr_time_off_policies_insert" ON hr_time_off_policies
  FOR INSERT TO authenticated
  WITH CHECK (user_has_permission(sector_id, 'time_off', 'create'));

DROP POLICY IF EXISTS "hr_time_off_policies_update" ON hr_time_off_policies;
CREATE POLICY "hr_time_off_policies_update" ON hr_time_off_policies
  FOR UPDATE TO authenticated
  USING (user_has_permission(sector_id, 'time_off', 'update'))
  WITH CHECK (user_has_permission(sector_id, 'time_off', 'update'));

-- =============================================
-- 3. hr_time_off_requests
-- =============================================
DROP POLICY IF EXISTS "hr_time_off_requests_insert" ON hr_time_off_requests;
CREATE POLICY "hr_time_off_requests_insert" ON hr_time_off_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_has_permission(sector_id, 'time_off', 'create'));

DROP POLICY IF EXISTS "hr_time_off_requests_update" ON hr_time_off_requests;
CREATE POLICY "hr_time_off_requests_update" ON hr_time_off_requests
  FOR UPDATE TO authenticated
  USING (user_has_permission(sector_id, 'time_off', 'update'))
  WITH CHECK (user_has_permission(sector_id, 'time_off', 'update'));

-- =============================================
-- 4. hr_time_off_balances (sector resolved via the employee row)
-- =============================================
DROP POLICY IF EXISTS "hr_time_off_balances_insert" ON hr_time_off_balances;
CREATE POLICY "hr_time_off_balances_insert" ON hr_time_off_balances
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM hr_employees e
      WHERE e.id = employee_id
      AND user_has_permission(e.sector_id, 'time_off', 'create')
    )
  );

DROP POLICY IF EXISTS "hr_time_off_balances_update" ON hr_time_off_balances;
CREATE POLICY "hr_time_off_balances_update" ON hr_time_off_balances
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM hr_employees e
      WHERE e.id = employee_id
      AND user_has_permission(e.sector_id, 'time_off', 'update')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM hr_employees e
      WHERE e.id = employee_id
      AND user_has_permission(e.sector_id, 'time_off', 'update')
    )
  );

-- =============================================
-- 5. hr_onboarding_templates
-- =============================================
DROP POLICY IF EXISTS "hr_onboarding_templates_insert" ON hr_onboarding_templates;
CREATE POLICY "hr_onboarding_templates_insert" ON hr_onboarding_templates
  FOR INSERT TO authenticated
  WITH CHECK (user_has_permission(sector_id, 'onboarding', 'create'));

DROP POLICY IF EXISTS "hr_onboarding_templates_update" ON hr_onboarding_templates;
CREATE POLICY "hr_onboarding_templates_update" ON hr_onboarding_templates
  FOR UPDATE TO authenticated
  USING (user_has_permission(sector_id, 'onboarding', 'update'))
  WITH CHECK (user_has_permission(sector_id, 'onboarding', 'update'));

-- =============================================
-- 6. hr_onboarding_instances
-- =============================================
DROP POLICY IF EXISTS "hr_onboarding_instances_insert" ON hr_onboarding_instances;
CREATE POLICY "hr_onboarding_instances_insert" ON hr_onboarding_instances
  FOR INSERT TO authenticated
  WITH CHECK (user_has_permission(sector_id, 'onboarding', 'create'));

DROP POLICY IF EXISTS "hr_onboarding_instances_update" ON hr_onboarding_instances;
CREATE POLICY "hr_onboarding_instances_update" ON hr_onboarding_instances
  FOR UPDATE TO authenticated
  USING (user_has_permission(sector_id, 'onboarding', 'update'))
  WITH CHECK (user_has_permission(sector_id, 'onboarding', 'update'));

-- =============================================
-- 7. hr_onboarding_items (sector resolved via the onboarding instance)
-- =============================================
DROP POLICY IF EXISTS "hr_onboarding_items_insert" ON hr_onboarding_items;
CREATE POLICY "hr_onboarding_items_insert" ON hr_onboarding_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM hr_onboarding_instances oi
      WHERE oi.id = onboarding_id
      AND user_has_permission(oi.sector_id, 'onboarding', 'update')
    )
  );

DROP POLICY IF EXISTS "hr_onboarding_items_update" ON hr_onboarding_items;
CREATE POLICY "hr_onboarding_items_update" ON hr_onboarding_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM hr_onboarding_instances oi
      WHERE oi.id = onboarding_id
      AND user_has_permission(oi.sector_id, 'onboarding', 'update')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM hr_onboarding_instances oi
      WHERE oi.id = onboarding_id
      AND user_has_permission(oi.sector_id, 'onboarding', 'update')
    )
  );

DROP POLICY IF EXISTS "hr_onboarding_items_delete" ON hr_onboarding_items;
CREATE POLICY "hr_onboarding_items_delete" ON hr_onboarding_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM hr_onboarding_instances oi
      WHERE oi.id = onboarding_id
      AND user_has_permission(oi.sector_id, 'onboarding', 'update')
    )
  );
