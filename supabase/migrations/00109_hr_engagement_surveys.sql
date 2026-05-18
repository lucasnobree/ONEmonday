-- Migration 00109: HR engagement / climate surveys (Phase 3)
-- Climate surveys with eNPS-style scoring and aggregate results. Replaces the
-- Sólides "Pesquisa de clima / engajamento" module (migration-rh.md backlog #7).
--
-- Responses are intentionally NOT linked to a user/employee row: climate
-- surveys must be anonymous to be honest. Aggregate results only.
--
-- Idempotent: safe to re-run.

-- =============================================
-- 1. Register HR engagement permission
-- =============================================
INSERT INTO permissions (module_id, resource, action)
SELECT m.id, 'survey', a
FROM modules m,
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
  AND p.resource = 'survey'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
JOIN modules m ON p.module_id = m.id
WHERE r.slug = 'analyst'
  AND m.slug = 'hr'
  AND p.resource = 'survey'
  AND p.action IN ('create', 'read', 'update')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
JOIN modules m ON p.module_id = m.id
WHERE r.slug = 'intern'
  AND m.slug = 'hr'
  AND p.resource = 'survey'
  AND p.action = 'read'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- =============================================
-- 2. hr_surveys — a climate / engagement survey
-- =============================================
CREATE TABLE IF NOT EXISTS hr_surveys (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id    uuid NOT NULL REFERENCES sectors(id),
  title        text NOT NULL,
  description  text,
  status       text NOT NULL DEFAULT 'draft'
               CHECK (status IN ('draft', 'open', 'closed')),
  -- 'enps' surveys carry the standard 0-10 recommendation question;
  -- 'climate' surveys are general 1-5 question batteries.
  survey_type  text NOT NULL DEFAULT 'climate'
               CHECK (survey_type IN ('climate', 'enps')),
  opens_at     date,
  closes_at    date,
  created_by   uuid NOT NULL REFERENCES users(id),
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_hr_surveys_updated_at ON hr_surveys;
CREATE TRIGGER trg_hr_surveys_updated_at BEFORE UPDATE ON hr_surveys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- 3. hr_survey_questions — questions inside a survey
-- =============================================
CREATE TABLE IF NOT EXISTS hr_survey_questions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id     uuid NOT NULL REFERENCES hr_surveys(id) ON DELETE CASCADE,
  prompt        text NOT NULL,
  -- 'score' = 1-5 scale, 'enps' = 0-10 scale, 'text' = free comment.
  question_type text NOT NULL DEFAULT 'score'
                CHECK (question_type IN ('score', 'enps', 'text')),
  position      int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- =============================================
-- 4. hr_survey_responses — one anonymous submission
-- =============================================
CREATE TABLE IF NOT EXISTS hr_survey_responses (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id    uuid NOT NULL REFERENCES hr_surveys(id) ON DELETE CASCADE,
  sector_id    uuid NOT NULL REFERENCES sectors(id),
  submitted_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================
-- 5. hr_survey_answers — answers within a response
-- =============================================
CREATE TABLE IF NOT EXISTS hr_survey_answers (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id  uuid NOT NULL REFERENCES hr_survey_responses(id) ON DELETE CASCADE,
  question_id  uuid NOT NULL REFERENCES hr_survey_questions(id) ON DELETE CASCADE,
  -- score/enps answers populate score_value; text answers populate text_value.
  score_value  int CHECK (score_value IS NULL
                          OR (score_value >= 0 AND score_value <= 10)),
  text_value   text
);

-- =============================================
-- Indexes
-- =============================================
CREATE INDEX IF NOT EXISTS idx_hr_surveys_sector_id ON hr_surveys(sector_id);
CREATE INDEX IF NOT EXISTS idx_hr_surveys_status ON hr_surveys(status);
CREATE INDEX IF NOT EXISTS idx_hr_survey_questions_survey_id ON hr_survey_questions(survey_id);
CREATE INDEX IF NOT EXISTS idx_hr_survey_responses_survey_id ON hr_survey_responses(survey_id);
CREATE INDEX IF NOT EXISTS idx_hr_survey_answers_response_id ON hr_survey_answers(response_id);
CREATE INDEX IF NOT EXISTS idx_hr_survey_answers_question_id ON hr_survey_answers(question_id);

-- =============================================
-- Enable RLS
-- =============================================
ALTER TABLE hr_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_survey_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_survey_answers ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS — hr_surveys
-- =============================================
DROP POLICY IF EXISTS "hr_surveys_select" ON hr_surveys;
CREATE POLICY "hr_surveys_select" ON hr_surveys
  FOR SELECT TO authenticated
  USING (user_has_sector_access(sector_id));

DROP POLICY IF EXISTS "hr_surveys_insert" ON hr_surveys;
CREATE POLICY "hr_surveys_insert" ON hr_surveys
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid()
              AND user_has_permission(sector_id, 'survey', 'create'));

DROP POLICY IF EXISTS "hr_surveys_update" ON hr_surveys;
CREATE POLICY "hr_surveys_update" ON hr_surveys
  FOR UPDATE TO authenticated
  USING (user_has_permission(sector_id, 'survey', 'update'))
  WITH CHECK (user_has_permission(sector_id, 'survey', 'update'));

-- =============================================
-- RLS — hr_survey_questions (scoped via parent survey)
-- =============================================
DROP POLICY IF EXISTS "hr_survey_questions_select" ON hr_survey_questions;
CREATE POLICY "hr_survey_questions_select" ON hr_survey_questions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM hr_surveys s
      WHERE s.id = hr_survey_questions.survey_id
        AND user_has_sector_access(s.sector_id)
    )
  );

DROP POLICY IF EXISTS "hr_survey_questions_insert" ON hr_survey_questions;
CREATE POLICY "hr_survey_questions_insert" ON hr_survey_questions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM hr_surveys s
      WHERE s.id = survey_id
        AND user_has_permission(s.sector_id, 'survey', 'update')
    )
  );

DROP POLICY IF EXISTS "hr_survey_questions_delete" ON hr_survey_questions;
CREATE POLICY "hr_survey_questions_delete" ON hr_survey_questions
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM hr_surveys s
      WHERE s.id = hr_survey_questions.survey_id
        AND user_has_permission(s.sector_id, 'survey', 'update')
    )
  );

-- =============================================
-- RLS — hr_survey_responses
-- Any sector member may submit a response to an open survey. Reads are
-- restricted to survey managers; responses are anonymous so individual rows
-- carry no identity, but limiting reads keeps aggregation server-side.
-- =============================================
DROP POLICY IF EXISTS "hr_survey_responses_select" ON hr_survey_responses;
CREATE POLICY "hr_survey_responses_select" ON hr_survey_responses
  FOR SELECT TO authenticated
  USING (user_has_permission(sector_id, 'survey', 'read'));

DROP POLICY IF EXISTS "hr_survey_responses_insert" ON hr_survey_responses;
CREATE POLICY "hr_survey_responses_insert" ON hr_survey_responses
  FOR INSERT TO authenticated
  WITH CHECK (
    user_has_sector_access(sector_id)
    AND EXISTS (
      SELECT 1 FROM hr_surveys s
      WHERE s.id = survey_id
        AND s.sector_id = hr_survey_responses.sector_id
        AND s.status = 'open'
    )
  );

-- =============================================
-- RLS — hr_survey_answers (scoped via parent response)
-- =============================================
DROP POLICY IF EXISTS "hr_survey_answers_select" ON hr_survey_answers;
CREATE POLICY "hr_survey_answers_select" ON hr_survey_answers
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM hr_survey_responses r
      WHERE r.id = hr_survey_answers.response_id
        AND user_has_permission(r.sector_id, 'survey', 'read')
    )
  );

DROP POLICY IF EXISTS "hr_survey_answers_insert" ON hr_survey_answers;
CREATE POLICY "hr_survey_answers_insert" ON hr_survey_answers
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM hr_survey_responses r
      JOIN hr_surveys s ON s.id = r.survey_id
      WHERE r.id = response_id
        AND user_has_sector_access(r.sector_id)
        AND s.status = 'open'
    )
  );

-- =============================================
-- RPC: get_survey_results — aggregate results for a survey
-- eNPS = % promoters (9-10) - % detractors (0-6).
-- =============================================
CREATE OR REPLACE FUNCTION get_survey_results(p_survey_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sector_id uuid;
  v_response_count int;
  v_questions json;
  v_enps numeric;
BEGIN
  SELECT sector_id INTO v_sector_id FROM hr_surveys WHERE id = p_survey_id;
  IF v_sector_id IS NULL THEN
    RETURN json_build_object('response_count', 0, 'questions', '[]'::json, 'enps', NULL);
  END IF;
  IF NOT user_has_permission(v_sector_id, 'survey', 'read') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT count(*) INTO v_response_count
  FROM hr_survey_responses WHERE survey_id = p_survey_id;

  -- eNPS over every enps-type answer in the survey.
  SELECT CASE WHEN count(*) = 0 THEN NULL ELSE
    round(
      (count(*) FILTER (WHERE a.score_value >= 9)::numeric
        - count(*) FILTER (WHERE a.score_value <= 6)::numeric)
      * 100.0 / count(*)
    , 1)
  END
  INTO v_enps
  FROM hr_survey_answers a
  JOIN hr_survey_questions q ON q.id = a.question_id
  WHERE q.survey_id = p_survey_id
    AND q.question_type = 'enps'
    AND a.score_value IS NOT NULL;

  SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.position), '[]'::json)
  INTO v_questions
  FROM (
    SELECT
      q.id,
      q.prompt,
      q.question_type,
      q.position,
      count(a.id) FILTER (WHERE a.score_value IS NOT NULL) AS answer_count,
      round(avg(a.score_value) FILTER (WHERE a.score_value IS NOT NULL), 2) AS average_score
    FROM hr_survey_questions q
    LEFT JOIN hr_survey_answers a ON a.question_id = q.id
    WHERE q.survey_id = p_survey_id
    GROUP BY q.id, q.prompt, q.question_type, q.position
  ) t;

  RETURN json_build_object(
    'response_count', v_response_count,
    'enps', v_enps,
    'questions', v_questions
  );
END;
$$;
