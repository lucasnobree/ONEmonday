-- Migration 00191: HR performance self-assessment (Wave 5)
-- Adds an employee self-assessment step to a review cycle. Performance review
-- was previously pure top-down (manager-only hr_evaluations); this lets the
-- employee reflect on the same 9-box axes before the manager review, reducing
-- bias and giving the employee a voice.
--
-- Peer / 360-degree feedback is deliberately left out of scope for this wave.
--
-- Idempotent: safe to re-run.

-- =============================================
-- 1. hr_self_assessments — one self-assessment per (cycle, employee)
-- =============================================
CREATE TABLE IF NOT EXISTS hr_self_assessments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id          uuid NOT NULL REFERENCES hr_review_cycles(id) ON DELETE CASCADE,
  sector_id         uuid NOT NULL REFERENCES sectors(id),
  employee_id       uuid NOT NULL REFERENCES hr_employees(id),
  status            text NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'submitted')),
  -- Same 1-3 9-box axes as hr_evaluations, filled by the employee themselves.
  performance_score int CHECK (performance_score IS NULL
                               OR (performance_score >= 1 AND performance_score <= 3)),
  potential_score   int CHECK (potential_score IS NULL
                               OR (potential_score >= 1 AND potential_score <= 3)),
  overall_rating    int CHECK (overall_rating IS NULL
                               OR (overall_rating >= 1 AND overall_rating <= 5)),
  achievements      text,
  challenges        text,
  goals             text,
  submitted_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cycle_id, employee_id)
);

DROP TRIGGER IF EXISTS trg_hr_self_assessments_updated_at ON hr_self_assessments;
CREATE TRIGGER trg_hr_self_assessments_updated_at BEFORE UPDATE ON hr_self_assessments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_hr_self_assessments_cycle_id
  ON hr_self_assessments(cycle_id);
CREATE INDEX IF NOT EXISTS idx_hr_self_assessments_employee_id
  ON hr_self_assessments(employee_id);

ALTER TABLE hr_self_assessments ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS — hr_self_assessments
-- The employee owns their self-assessment (read + write while a draft);
-- performance managers may read every self-assessment in their sector to
-- inform the manager review.
-- =============================================
DROP POLICY IF EXISTS "hr_self_assessments_select" ON hr_self_assessments;
CREATE POLICY "hr_self_assessments_select" ON hr_self_assessments
  FOR SELECT TO authenticated
  USING (
    user_has_permission(sector_id, 'performance', 'read')
    OR EXISTS (
      SELECT 1 FROM hr_employees e
      WHERE e.id = hr_self_assessments.employee_id
        AND e.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "hr_self_assessments_insert" ON hr_self_assessments;
CREATE POLICY "hr_self_assessments_insert" ON hr_self_assessments
  FOR INSERT TO authenticated
  WITH CHECK (
    -- The row must belong to the calling employee, in an active cycle.
    EXISTS (
      SELECT 1 FROM hr_employees e
      WHERE e.id = employee_id
        AND e.user_id = auth.uid()
        AND e.sector_id = hr_self_assessments.sector_id
    )
    AND EXISTS (
      SELECT 1 FROM hr_review_cycles c
      WHERE c.id = cycle_id
        AND c.sector_id = hr_self_assessments.sector_id
        AND c.status = 'active'
    )
  );

DROP POLICY IF EXISTS "hr_self_assessments_update" ON hr_self_assessments;
CREATE POLICY "hr_self_assessments_update" ON hr_self_assessments
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM hr_employees e
      WHERE e.id = hr_self_assessments.employee_id
        AND e.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM hr_employees e
      WHERE e.id = hr_self_assessments.employee_id
        AND e.user_id = auth.uid()
    )
  );

-- =============================================
-- RPC: get_self_assessment_context — cycle + caller's employee row + existing
-- self-assessment, for the employee-facing self-assessment page.
-- =============================================
CREATE OR REPLACE FUNCTION get_self_assessment_context(p_cycle_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sector_id  uuid;
  v_cycle      record;
  v_employee   record;
  v_assessment json;
BEGIN
  SELECT id, sector_id, name, status, start_date, end_date
  INTO v_cycle FROM hr_review_cycles WHERE id = p_cycle_id;
  IF v_cycle.id IS NULL THEN
    RETURN json_build_object('found', false);
  END IF;
  v_sector_id := v_cycle.sector_id;

  IF NOT user_has_sector_access(v_sector_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT id, full_name INTO v_employee
  FROM hr_employees
  WHERE sector_id = v_sector_id
    AND user_id = auth.uid()
    AND status <> 'terminated'
  LIMIT 1;

  IF v_employee.id IS NULL THEN
    RETURN json_build_object('found', false);
  END IF;

  SELECT row_to_json(sa) INTO v_assessment
  FROM hr_self_assessments sa
  WHERE sa.cycle_id = p_cycle_id AND sa.employee_id = v_employee.id;

  RETURN json_build_object(
    'found', true,
    'cycle', row_to_json(v_cycle),
    'employee_id', v_employee.id,
    'employee_name', v_employee.full_name,
    'assessment', v_assessment
  );
END;
$$;
