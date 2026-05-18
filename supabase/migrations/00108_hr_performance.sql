-- Migration 00108: HR performance management (Phase 3)
-- Performance review cycles, evaluations, 9-box placement and individual
-- development plans (PDI). Replaces the Sólides "Avaliação de desempenho",
-- "9Box" and "PDI" modules (migration-rh.md backlog #4-#6).
--
-- Idempotent: safe to re-run.

-- =============================================
-- 1. Register HR performance permissions
-- =============================================
INSERT INTO permissions (module_id, resource, action)
SELECT m.id, r, a
FROM modules m,
     unnest(ARRAY['performance', 'pdi']) AS r,
     unnest(ARRAY['create', 'read', 'update', 'delete', 'manage']) AS a
WHERE m.slug = 'hr'
ON CONFLICT (module_id, resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
JOIN modules m ON p.module_id = m.id
WHERE r.slug IN ('admin', 'manager')
  AND m.slug = 'hr'
  AND p.resource IN ('performance', 'pdi')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
JOIN modules m ON p.module_id = m.id
WHERE r.slug = 'analyst'
  AND m.slug = 'hr'
  AND p.resource IN ('performance', 'pdi')
  AND p.action IN ('create', 'read', 'update')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
JOIN modules m ON p.module_id = m.id
WHERE r.slug = 'intern'
  AND m.slug = 'hr'
  AND p.resource IN ('performance', 'pdi')
  AND p.action = 'read'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- =============================================
-- 2. hr_review_cycles — performance review cycle
-- =============================================
CREATE TABLE IF NOT EXISTS hr_review_cycles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id    uuid NOT NULL REFERENCES sectors(id),
  name         text NOT NULL,
  description  text,
  start_date   date NOT NULL DEFAULT CURRENT_DATE,
  end_date     date NOT NULL DEFAULT CURRENT_DATE,
  status       text NOT NULL DEFAULT 'draft'
               CHECK (status IN ('draft', 'active', 'closed')),
  created_by   uuid NOT NULL REFERENCES users(id),
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

DROP TRIGGER IF EXISTS trg_hr_review_cycles_updated_at ON hr_review_cycles;
CREATE TRIGGER trg_hr_review_cycles_updated_at BEFORE UPDATE ON hr_review_cycles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- 3. hr_evaluations — one evaluation of an employee in a cycle
-- =============================================
CREATE TABLE IF NOT EXISTS hr_evaluations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id        uuid NOT NULL REFERENCES hr_review_cycles(id) ON DELETE CASCADE,
  sector_id       uuid NOT NULL REFERENCES sectors(id),
  employee_id     uuid NOT NULL REFERENCES hr_employees(id),
  reviewer_id     uuid REFERENCES users(id),
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'submitted')),
  -- 9-box axes, 1-3 each (low / medium / high). Performance = horizontal,
  -- potential = vertical. Combined they place the employee on the 9-box grid.
  performance_score int CHECK (performance_score IS NULL
                               OR (performance_score >= 1 AND performance_score <= 3)),
  potential_score   int CHECK (potential_score IS NULL
                               OR (potential_score >= 1 AND potential_score <= 3)),
  -- Overall rating 1-5 for list/summary views.
  overall_rating  int CHECK (overall_rating IS NULL
                             OR (overall_rating >= 1 AND overall_rating <= 5)),
  strengths       text,
  improvements    text,
  comments        text,
  submitted_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cycle_id, employee_id)
);

DROP TRIGGER IF EXISTS trg_hr_evaluations_updated_at ON hr_evaluations;
CREATE TRIGGER trg_hr_evaluations_updated_at BEFORE UPDATE ON hr_evaluations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- 4. hr_development_plans — individual development plan (PDI)
-- =============================================
CREATE TABLE IF NOT EXISTS hr_development_plans (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id     uuid NOT NULL REFERENCES sectors(id),
  employee_id   uuid NOT NULL REFERENCES hr_employees(id),
  -- Optional link to the evaluation that motivated the plan.
  evaluation_id uuid REFERENCES hr_evaluations(id) ON DELETE SET NULL,
  title         text NOT NULL,
  objective     text,
  status        text NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'completed', 'cancelled')),
  target_date   date,
  created_by    uuid NOT NULL REFERENCES users(id),
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_hr_development_plans_updated_at ON hr_development_plans;
CREATE TRIGGER trg_hr_development_plans_updated_at BEFORE UPDATE ON hr_development_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- 5. hr_development_actions — individual actions inside a PDI
-- =============================================
CREATE TABLE IF NOT EXISTS hr_development_actions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id       uuid NOT NULL REFERENCES hr_development_plans(id) ON DELETE CASCADE,
  title         text NOT NULL,
  due_date      date,
  is_completed  boolean NOT NULL DEFAULT false,
  completed_at  timestamptz,
  position      int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- =============================================
-- Indexes
-- =============================================
CREATE INDEX IF NOT EXISTS idx_hr_review_cycles_sector_id ON hr_review_cycles(sector_id);
CREATE INDEX IF NOT EXISTS idx_hr_review_cycles_status ON hr_review_cycles(status);
CREATE INDEX IF NOT EXISTS idx_hr_evaluations_cycle_id ON hr_evaluations(cycle_id);
CREATE INDEX IF NOT EXISTS idx_hr_evaluations_sector_id ON hr_evaluations(sector_id);
CREATE INDEX IF NOT EXISTS idx_hr_evaluations_employee_id ON hr_evaluations(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_development_plans_sector_id ON hr_development_plans(sector_id);
CREATE INDEX IF NOT EXISTS idx_hr_development_plans_employee_id ON hr_development_plans(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_development_actions_plan_id ON hr_development_actions(plan_id);

-- =============================================
-- Enable RLS
-- =============================================
ALTER TABLE hr_review_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_development_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_development_actions ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS — hr_review_cycles
-- =============================================
DROP POLICY IF EXISTS "hr_review_cycles_select" ON hr_review_cycles;
CREATE POLICY "hr_review_cycles_select" ON hr_review_cycles
  FOR SELECT TO authenticated
  USING (user_has_permission(sector_id, 'performance', 'read'));

DROP POLICY IF EXISTS "hr_review_cycles_insert" ON hr_review_cycles;
CREATE POLICY "hr_review_cycles_insert" ON hr_review_cycles
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid()
              AND user_has_permission(sector_id, 'performance', 'create'));

DROP POLICY IF EXISTS "hr_review_cycles_update" ON hr_review_cycles;
CREATE POLICY "hr_review_cycles_update" ON hr_review_cycles
  FOR UPDATE TO authenticated
  USING (user_has_permission(sector_id, 'performance', 'update'))
  WITH CHECK (user_has_permission(sector_id, 'performance', 'update'));

-- =============================================
-- RLS — hr_evaluations
-- =============================================
DROP POLICY IF EXISTS "hr_evaluations_select" ON hr_evaluations;
CREATE POLICY "hr_evaluations_select" ON hr_evaluations
  FOR SELECT TO authenticated
  USING (user_has_permission(sector_id, 'performance', 'read'));

DROP POLICY IF EXISTS "hr_evaluations_insert" ON hr_evaluations;
CREATE POLICY "hr_evaluations_insert" ON hr_evaluations
  FOR INSERT TO authenticated
  WITH CHECK (user_has_permission(sector_id, 'performance', 'create'));

DROP POLICY IF EXISTS "hr_evaluations_update" ON hr_evaluations;
CREATE POLICY "hr_evaluations_update" ON hr_evaluations
  FOR UPDATE TO authenticated
  USING (user_has_permission(sector_id, 'performance', 'update'))
  WITH CHECK (user_has_permission(sector_id, 'performance', 'update'));

-- =============================================
-- RLS — hr_development_plans
-- =============================================
DROP POLICY IF EXISTS "hr_development_plans_select" ON hr_development_plans;
CREATE POLICY "hr_development_plans_select" ON hr_development_plans
  FOR SELECT TO authenticated
  USING (
    user_has_permission(sector_id, 'pdi', 'read')
    OR EXISTS (
      SELECT 1 FROM hr_employees e
      WHERE e.id = hr_development_plans.employee_id
        AND e.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "hr_development_plans_insert" ON hr_development_plans;
CREATE POLICY "hr_development_plans_insert" ON hr_development_plans
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid()
              AND user_has_permission(sector_id, 'pdi', 'create'));

DROP POLICY IF EXISTS "hr_development_plans_update" ON hr_development_plans;
CREATE POLICY "hr_development_plans_update" ON hr_development_plans
  FOR UPDATE TO authenticated
  USING (user_has_permission(sector_id, 'pdi', 'update'))
  WITH CHECK (user_has_permission(sector_id, 'pdi', 'update'));

-- =============================================
-- RLS — hr_development_actions (scoped via the parent plan)
-- =============================================
DROP POLICY IF EXISTS "hr_development_actions_select" ON hr_development_actions;
CREATE POLICY "hr_development_actions_select" ON hr_development_actions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM hr_development_plans p
      WHERE p.id = hr_development_actions.plan_id
        AND (
          user_has_permission(p.sector_id, 'pdi', 'read')
          OR EXISTS (
            SELECT 1 FROM hr_employees e
            WHERE e.id = p.employee_id AND e.user_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS "hr_development_actions_insert" ON hr_development_actions;
CREATE POLICY "hr_development_actions_insert" ON hr_development_actions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM hr_development_plans p
      WHERE p.id = plan_id
        AND user_has_permission(p.sector_id, 'pdi', 'update')
    )
  );

DROP POLICY IF EXISTS "hr_development_actions_update" ON hr_development_actions;
CREATE POLICY "hr_development_actions_update" ON hr_development_actions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM hr_development_plans p
      WHERE p.id = hr_development_actions.plan_id
        AND user_has_permission(p.sector_id, 'pdi', 'update')
    )
  );

DROP POLICY IF EXISTS "hr_development_actions_delete" ON hr_development_actions;
CREATE POLICY "hr_development_actions_delete" ON hr_development_actions
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM hr_development_plans p
      WHERE p.id = hr_development_actions.plan_id
        AND user_has_permission(p.sector_id, 'pdi', 'update')
    )
  );

-- =============================================
-- RPC: get_nine_box_grid — 9-box placement counts for a cycle
-- =============================================
CREATE OR REPLACE FUNCTION get_nine_box_grid(p_cycle_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sector_id uuid;
  result json;
BEGIN
  SELECT sector_id INTO v_sector_id FROM hr_review_cycles WHERE id = p_cycle_id;
  IF v_sector_id IS NULL THEN
    RETURN '[]'::json;
  END IF;
  IF NOT user_has_permission(v_sector_id, 'performance', 'read') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
  INTO result
  FROM (
    SELECT
      ev.id            AS evaluation_id,
      ev.employee_id,
      e.full_name      AS employee_name,
      e.position       AS employee_position,
      ev.performance_score,
      ev.potential_score,
      ev.overall_rating
    FROM hr_evaluations ev
    JOIN hr_employees e ON e.id = ev.employee_id
    WHERE ev.cycle_id = p_cycle_id
      AND ev.performance_score IS NOT NULL
      AND ev.potential_score IS NOT NULL
  ) t;

  RETURN result;
END;
$$;
