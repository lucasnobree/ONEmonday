-- Migration 00148: HR offboarding checklists
-- Adds an offboarding feature that is a structural peer of onboarding
-- (migration 00012): reusable templates plus per-employee instances whose
-- jsonb steps are expanded into individually-trackable item rows.
--
-- Offboarding data is LGPD-sensitive (it concerns an identified employee's
-- departure), so every new table enables RLS and every write policy is gated
-- on the seeded `employee` permission resource for the row's sector — the same
-- resource the application's termination flow already authorizes against
-- (lib/actions/hr/employees.ts -> terminateEmployee).
--
-- Idempotent: tables use IF NOT EXISTS, policies are dropped-then-created.

-- =============================================
-- 1. hr_offboarding_templates — reusable exit checklists
-- =============================================
CREATE TABLE IF NOT EXISTS hr_offboarding_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id   uuid NOT NULL REFERENCES sectors(id),
  name        text NOT NULL,
  description text,
  -- jsonb array of { title, description, responsible_role, due_days_offset }.
  -- due_days_offset is days relative to the termination date (may be negative
  -- for steps that must happen before the last day).
  items       jsonb NOT NULL DEFAULT '[]',
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_hr_offboarding_templates_updated_at ON hr_offboarding_templates;
CREATE TRIGGER trg_hr_offboarding_templates_updated_at
  BEFORE UPDATE ON hr_offboarding_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- 2. hr_offboarding_instances — one running checklist per departing employee
-- =============================================
CREATE TABLE IF NOT EXISTS hr_offboarding_instances (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id      uuid NOT NULL REFERENCES hr_employees(id),
  template_id      uuid NOT NULL REFERENCES hr_offboarding_templates(id),
  sector_id        uuid NOT NULL REFERENCES sectors(id),
  termination_date date NOT NULL,
  reason           text CHECK (
                     reason IS NULL OR reason IN (
                       'voluntary', 'involuntary', 'retirement',
                       'end_of_contract', 'other'
                     )
                   ),
  status           text NOT NULL DEFAULT 'in_progress'
                   CHECK (status IN ('in_progress', 'completed', 'cancelled')),
  completed_at     timestamptz,
  created_by       uuid REFERENCES users(id),
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- =============================================
-- 3. hr_offboarding_items — expanded, individually-tracked steps
-- =============================================
CREATE TABLE IF NOT EXISTS hr_offboarding_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offboarding_id   uuid NOT NULL REFERENCES hr_offboarding_instances(id) ON DELETE CASCADE,
  title            text NOT NULL,
  description      text,
  responsible_role text,
  due_date         date,
  is_completed     boolean NOT NULL DEFAULT false,
  completed_at     timestamptz,
  completed_by     uuid REFERENCES users(id),
  position         int NOT NULL DEFAULT 0
);

-- =============================================
-- 4. Indexes
-- =============================================
CREATE INDEX IF NOT EXISTS idx_hr_offboarding_templates_sector_id
  ON hr_offboarding_templates(sector_id);
CREATE INDEX IF NOT EXISTS idx_hr_offboarding_instances_employee_id
  ON hr_offboarding_instances(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_offboarding_instances_sector_id
  ON hr_offboarding_instances(sector_id);
CREATE INDEX IF NOT EXISTS idx_hr_offboarding_instances_status
  ON hr_offboarding_instances(status);
CREATE INDEX IF NOT EXISTS idx_hr_offboarding_items_offboarding_id
  ON hr_offboarding_items(offboarding_id);

-- =============================================
-- 5. RLS — LGPD-sensitive: every table locked down
-- =============================================
ALTER TABLE hr_offboarding_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_offboarding_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_offboarding_items ENABLE ROW LEVEL SECURITY;

-- hr_offboarding_templates
DROP POLICY IF EXISTS "hr_offboarding_templates_select" ON hr_offboarding_templates;
CREATE POLICY "hr_offboarding_templates_select" ON hr_offboarding_templates
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_sector_roles usr
            WHERE usr.user_id = auth.uid()
            AND usr.sector_id = hr_offboarding_templates.sector_id)
    OR EXISTS (SELECT 1 FROM users u
               WHERE u.id = auth.uid() AND u.is_global_admin = true)
  );

DROP POLICY IF EXISTS "hr_offboarding_templates_insert" ON hr_offboarding_templates;
CREATE POLICY "hr_offboarding_templates_insert" ON hr_offboarding_templates
  FOR INSERT TO authenticated
  WITH CHECK (user_has_permission(sector_id, 'employee', 'create'));

DROP POLICY IF EXISTS "hr_offboarding_templates_update" ON hr_offboarding_templates;
CREATE POLICY "hr_offboarding_templates_update" ON hr_offboarding_templates
  FOR UPDATE TO authenticated
  USING (user_has_permission(sector_id, 'employee', 'update'))
  WITH CHECK (user_has_permission(sector_id, 'employee', 'update'));

-- hr_offboarding_instances
DROP POLICY IF EXISTS "hr_offboarding_instances_select" ON hr_offboarding_instances;
CREATE POLICY "hr_offboarding_instances_select" ON hr_offboarding_instances
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_sector_roles usr
            WHERE usr.user_id = auth.uid()
            AND usr.sector_id = hr_offboarding_instances.sector_id)
    OR EXISTS (SELECT 1 FROM users u
               WHERE u.id = auth.uid() AND u.is_global_admin = true)
  );

DROP POLICY IF EXISTS "hr_offboarding_instances_insert" ON hr_offboarding_instances;
CREATE POLICY "hr_offboarding_instances_insert" ON hr_offboarding_instances
  FOR INSERT TO authenticated
  WITH CHECK (user_has_permission(sector_id, 'employee', 'update'));

DROP POLICY IF EXISTS "hr_offboarding_instances_update" ON hr_offboarding_instances;
CREATE POLICY "hr_offboarding_instances_update" ON hr_offboarding_instances
  FOR UPDATE TO authenticated
  USING (user_has_permission(sector_id, 'employee', 'update'))
  WITH CHECK (user_has_permission(sector_id, 'employee', 'update'));

-- hr_offboarding_items (sector resolved via the owning instance)
DROP POLICY IF EXISTS "hr_offboarding_items_select" ON hr_offboarding_items;
CREATE POLICY "hr_offboarding_items_select" ON hr_offboarding_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM hr_offboarding_instances oi
      WHERE oi.id = hr_offboarding_items.offboarding_id
      AND (
        EXISTS (SELECT 1 FROM user_sector_roles usr
                WHERE usr.user_id = auth.uid() AND usr.sector_id = oi.sector_id)
        OR EXISTS (SELECT 1 FROM users u
                   WHERE u.id = auth.uid() AND u.is_global_admin = true)
      )
    )
  );

DROP POLICY IF EXISTS "hr_offboarding_items_insert" ON hr_offboarding_items;
CREATE POLICY "hr_offboarding_items_insert" ON hr_offboarding_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM hr_offboarding_instances oi
      WHERE oi.id = offboarding_id
      AND user_has_permission(oi.sector_id, 'employee', 'update')
    )
  );

DROP POLICY IF EXISTS "hr_offboarding_items_update" ON hr_offboarding_items;
CREATE POLICY "hr_offboarding_items_update" ON hr_offboarding_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM hr_offboarding_instances oi
      WHERE oi.id = offboarding_id
      AND user_has_permission(oi.sector_id, 'employee', 'update')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM hr_offboarding_instances oi
      WHERE oi.id = offboarding_id
      AND user_has_permission(oi.sector_id, 'employee', 'update')
    )
  );

DROP POLICY IF EXISTS "hr_offboarding_items_delete" ON hr_offboarding_items;
CREATE POLICY "hr_offboarding_items_delete" ON hr_offboarding_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM hr_offboarding_instances oi
      WHERE oi.id = offboarding_id
      AND user_has_permission(oi.sector_id, 'employee', 'update')
    )
  );
