-- Migration 00190: HR survey participation tracking (Wave 5)
-- Adds a real employee-facing answering flow for engagement / climate surveys.
--
-- Anonymity guarantee (LGPD): a survey *response* (hr_survey_responses) must
-- never be traceable to the employee who wrote it. This migration therefore
-- splits two concerns into two tables that are NEVER joined:
--
--   * hr_survey_responses  — the anonymous answers (migration 00109). No FK to
--                            any employee/user row. Unchanged here.
--   * hr_survey_participants — records *that* an employee answered a survey, so
--                            a one-response-per-employee guard and participation
--                            counts are possible. Carries the employee id but
--                            NO reference to the response row.
--
-- Because the participation row and the response row share no key, knowing
-- "employee X participated" gives zero information about which response row is
-- theirs. The submit RPC writes both in one transaction but returns nothing
-- that links them.
--
-- Idempotent: safe to re-run.

-- =============================================
-- 1. hr_survey_participants — one row per (survey, employee)
-- =============================================
CREATE TABLE IF NOT EXISTS hr_survey_participants (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id    uuid NOT NULL REFERENCES hr_surveys(id) ON DELETE CASCADE,
  sector_id    uuid NOT NULL REFERENCES sectors(id),
  -- The employee who answered. There is NO column referencing
  -- hr_survey_responses: participation and the anonymous answers are kept
  -- structurally unlinkable.
  employee_id  uuid NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
  responded_at timestamptz NOT NULL DEFAULT now(),
  -- Enforces the one-response-per-employee guard at the schema level.
  UNIQUE (survey_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_hr_survey_participants_survey_id
  ON hr_survey_participants(survey_id);
CREATE INDEX IF NOT EXISTS idx_hr_survey_participants_employee_id
  ON hr_survey_participants(employee_id);

ALTER TABLE hr_survey_participants ENABLE ROW LEVEL SECURITY;

-- An employee may see their own participation rows (to know they already
-- answered); survey managers may see all rows for participation-rate reporting.
-- Knowing participation reveals nothing about response content.
DROP POLICY IF EXISTS "hr_survey_participants_select" ON hr_survey_participants;
CREATE POLICY "hr_survey_participants_select" ON hr_survey_participants
  FOR SELECT TO authenticated
  USING (
    user_has_permission(sector_id, 'survey', 'read')
    OR EXISTS (
      SELECT 1 FROM hr_employees e
      WHERE e.id = hr_survey_participants.employee_id
        AND e.user_id = auth.uid()
    )
  );

-- Writes go exclusively through submit_survey_response (SECURITY DEFINER); no
-- direct INSERT policy is granted, so a client cannot forge a participation
-- row or unlink it from the guard.

-- =============================================
-- 2. RPC: get_survey_employee — the hr_employee row for the caller in a sector
-- Used by the employee answering page to resolve "who am I" without exposing
-- the whole employee directory.
-- =============================================
CREATE OR REPLACE FUNCTION get_survey_employee(p_survey_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sector_id  uuid;
  v_employee   record;
  v_responded  boolean;
BEGIN
  SELECT sector_id INTO v_sector_id FROM hr_surveys WHERE id = p_survey_id;
  IF v_sector_id IS NULL THEN
    RETURN json_build_object('found', false);
  END IF;

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

  SELECT EXISTS (
    SELECT 1 FROM hr_survey_participants
    WHERE survey_id = p_survey_id AND employee_id = v_employee.id
  ) INTO v_responded;

  RETURN json_build_object(
    'found', true,
    'employee_id', v_employee.id,
    'employee_name', v_employee.full_name,
    'already_responded', v_responded
  );
END;
$$;

-- =============================================
-- 3. RPC: submit_survey_response — atomic anonymous submission + guard
-- Inserts the anonymous response, its answers and the participation row in a
-- single transaction. The one-response-per-employee guard is enforced by the
-- UNIQUE (survey_id, employee_id) constraint on hr_survey_participants.
--
-- p_answers is a json array of { question_id, score_value, text_value }.
-- =============================================
CREATE OR REPLACE FUNCTION submit_survey_response(
  p_survey_id   uuid,
  p_employee_id uuid,
  p_answers     json
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sector_id   uuid;
  v_status      text;
  v_response_id uuid;
  v_emp_sector  uuid;
  v_emp_user    uuid;
BEGIN
  SELECT sector_id, status INTO v_sector_id, v_status
  FROM hr_surveys WHERE id = p_survey_id;
  IF v_sector_id IS NULL THEN
    RETURN json_build_object('error', 'Pesquisa não encontrada');
  END IF;
  IF v_status <> 'open' THEN
    RETURN json_build_object('error', 'Esta pesquisa não está aberta para respostas');
  END IF;

  -- The caller must be the employee they claim to be, in the survey's sector.
  SELECT sector_id, user_id INTO v_emp_sector, v_emp_user
  FROM hr_employees WHERE id = p_employee_id;
  IF v_emp_user IS DISTINCT FROM auth.uid() OR v_emp_sector <> v_sector_id THEN
    RETURN json_build_object('error', 'Colaborador inválido para esta pesquisa');
  END IF;

  -- One-response-per-employee guard.
  IF EXISTS (
    SELECT 1 FROM hr_survey_participants
    WHERE survey_id = p_survey_id AND employee_id = p_employee_id
  ) THEN
    RETURN json_build_object('error', 'Você já respondeu esta pesquisa');
  END IF;

  -- Record participation first; the UNIQUE constraint makes a concurrent
  -- double-submit fail here rather than creating two anonymous responses.
  INSERT INTO hr_survey_participants (survey_id, sector_id, employee_id)
  VALUES (p_survey_id, v_sector_id, p_employee_id);

  -- The response row carries no identity — anonymity holds at the schema level.
  INSERT INTO hr_survey_responses (survey_id, sector_id)
  VALUES (p_survey_id, v_sector_id)
  RETURNING id INTO v_response_id;

  INSERT INTO hr_survey_answers (response_id, question_id, score_value, text_value)
  SELECT
    v_response_id,
    (a->>'question_id')::uuid,
    NULLIF(a->>'score_value', '')::int,
    NULLIF(a->>'text_value', '')
  FROM json_array_elements(p_answers) AS a
  -- Only accept answers for questions that belong to this survey.
  WHERE (a->>'question_id')::uuid IN (
    SELECT id FROM hr_survey_questions WHERE survey_id = p_survey_id
  );

  -- Deliberately return no link between v_response_id and p_employee_id.
  RETURN json_build_object('success', true);
EXCEPTION
  WHEN unique_violation THEN
    RETURN json_build_object('error', 'Você já respondeu esta pesquisa');
END;
$$;

-- =============================================
-- 4. RPC: get_survey_participation — eligible audience + response counts
-- Gives survey managers a participation rate without ever exposing identities.
-- =============================================
CREATE OR REPLACE FUNCTION get_survey_participation(p_survey_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sector_id  uuid;
  v_eligible   int;
  v_responded  int;
BEGIN
  SELECT sector_id INTO v_sector_id FROM hr_surveys WHERE id = p_survey_id;
  IF v_sector_id IS NULL THEN
    RETURN json_build_object('eligible', 0, 'responded', 0);
  END IF;
  IF NOT user_has_permission(v_sector_id, 'survey', 'read') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Eligible audience = active employees of the sector with a linked user.
  SELECT count(*) INTO v_eligible
  FROM hr_employees
  WHERE sector_id = v_sector_id
    AND status <> 'terminated'
    AND user_id IS NOT NULL;

  SELECT count(*) INTO v_responded
  FROM hr_survey_participants
  WHERE survey_id = p_survey_id;

  RETURN json_build_object('eligible', v_eligible, 'responded', v_responded);
END;
$$;
