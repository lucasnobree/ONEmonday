-- Migration 00107: HR recruitment pipeline (Phase 3)
-- Turns the read-only recruitment board into a working ATS pipeline.
--
-- The HR module shipped `hr_candidates` (migration 00012) but the application
-- code (lib/actions/hr/candidates.ts, hooks/hr/use-candidates.ts,
-- hooks/hr/use-job-openings.ts) already expects a stage-based pipeline with
-- `hr_candidates.stage` / `created_by` and `hr_job_openings.created_by` /
-- `closed_at` columns that were never added. This migration reconciles the
-- schema with that code and adds candidate interview notes.
--
-- Idempotent: safe to re-run.

-- =============================================
-- 1. hr_job_openings — columns the app already reads
-- =============================================
ALTER TABLE hr_job_openings
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users(id);
ALTER TABLE hr_job_openings
  ADD COLUMN IF NOT EXISTS closed_at timestamptz;

-- hiring_manager_id was NOT NULL but the create form / Zod schema treat it as
-- optional. Relax it so a vaga can be created without naming a manager.
ALTER TABLE hr_job_openings
  ALTER COLUMN hiring_manager_id DROP NOT NULL;

-- =============================================
-- 2. hr_candidates — pipeline stage + ownership
-- =============================================
-- card_id is optional (a candidate can exist without a kanban card on a board).
ALTER TABLE hr_candidates
  ALTER COLUMN card_id DROP NOT NULL;

ALTER TABLE hr_candidates
  ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'applied';

ALTER TABLE hr_candidates
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users(id);

ALTER TABLE hr_candidates
  ADD COLUMN IF NOT EXISTS stage_changed_at timestamptz NOT NULL DEFAULT now();

-- Pipeline stages, ordered. Drop-then-add so the CHECK is idempotent.
ALTER TABLE hr_candidates
  DROP CONSTRAINT IF EXISTS hr_candidates_stage_check;
ALTER TABLE hr_candidates
  ADD CONSTRAINT hr_candidates_stage_check
  CHECK (stage IN ('applied', 'screening', 'interview', 'offer', 'hired', 'rejected'));

CREATE INDEX IF NOT EXISTS idx_hr_candidates_stage ON hr_candidates(stage);

-- =============================================
-- 3. hr_candidate_notes — interview notes / scorecards
-- =============================================
CREATE TABLE IF NOT EXISTS hr_candidate_notes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id  uuid NOT NULL REFERENCES hr_candidates(id) ON DELETE CASCADE,
  sector_id     uuid NOT NULL REFERENCES sectors(id),
  author_id     uuid NOT NULL REFERENCES users(id),
  -- Optional 1-5 scorecard rating attached to the note.
  rating        int CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
  body          text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_candidate_notes_candidate_id
  ON hr_candidate_notes(candidate_id);
CREATE INDEX IF NOT EXISTS idx_hr_candidate_notes_sector_id
  ON hr_candidate_notes(sector_id);

ALTER TABLE hr_candidate_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hr_candidate_notes_select" ON hr_candidate_notes;
CREATE POLICY "hr_candidate_notes_select" ON hr_candidate_notes
  FOR SELECT TO authenticated
  USING (user_has_permission(sector_id, 'candidate', 'read'));

DROP POLICY IF EXISTS "hr_candidate_notes_insert" ON hr_candidate_notes;
CREATE POLICY "hr_candidate_notes_insert" ON hr_candidate_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND user_has_permission(sector_id, 'candidate', 'update')
  );

DROP POLICY IF EXISTS "hr_candidate_notes_delete" ON hr_candidate_notes;
CREATE POLICY "hr_candidate_notes_delete" ON hr_candidate_notes
  FOR DELETE TO authenticated
  USING (user_has_permission(sector_id, 'candidate', 'manage'));

-- =============================================
-- 4. RLS realignment for recruitment tables
-- =============================================
-- Migration 00012 wrote the hr_candidates / hr_job_openings INSERT/UPDATE
-- policies against a `hr_recruitment` resource that was never registered in
-- `permissions` (migration 00009 seeds `job_opening` and `candidate`). The
-- effect today is that only global admins can write recruitment data. Realign
-- the policies onto the real, seeded permission resources so permissioned
-- HR users can actually run the pipeline.

DROP POLICY IF EXISTS "hr_job_openings_insert" ON hr_job_openings;
CREATE POLICY "hr_job_openings_insert" ON hr_job_openings
  FOR INSERT TO authenticated
  WITH CHECK (user_has_permission(sector_id, 'job_opening', 'create'));

DROP POLICY IF EXISTS "hr_job_openings_update" ON hr_job_openings;
CREATE POLICY "hr_job_openings_update" ON hr_job_openings
  FOR UPDATE TO authenticated
  USING (user_has_permission(sector_id, 'job_opening', 'update'))
  WITH CHECK (user_has_permission(sector_id, 'job_opening', 'update'));

DROP POLICY IF EXISTS "hr_candidates_insert" ON hr_candidates;
CREATE POLICY "hr_candidates_insert" ON hr_candidates
  FOR INSERT TO authenticated
  WITH CHECK (user_has_permission(sector_id, 'candidate', 'create'));

DROP POLICY IF EXISTS "hr_candidates_update" ON hr_candidates;
CREATE POLICY "hr_candidates_update" ON hr_candidates
  FOR UPDATE TO authenticated
  USING (user_has_permission(sector_id, 'candidate', 'update'))
  WITH CHECK (user_has_permission(sector_id, 'candidate', 'update'));

DROP POLICY IF EXISTS "hr_candidates_delete" ON hr_candidates;
CREATE POLICY "hr_candidates_delete" ON hr_candidates
  FOR DELETE TO authenticated
  USING (user_has_permission(sector_id, 'candidate', 'manage'));
