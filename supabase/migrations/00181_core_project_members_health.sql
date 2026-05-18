-- =============================================
-- Migration 00181: Core — project members + health note
-- Implements the deferred Core Wave 4 backlog (docs/research/
-- ux-audit-core-wave4.md item #6 "Project detail: members strip + status
-- note"). The project detail page today is a flat linked-card list with no
-- roster and no qualitative status; this migration adds:
--   * `projects.health` — a coarse RYG health signal independent of the
--     lifecycle `status` (a project can be `active` but `at_risk`).
--   * `projects.status_note` — a free-text "where things stand" summary the
--     detail page surfaces.
--   * `project_members` — an explicit membership join so the detail page can
--     render a members strip. Membership is informational (it does NOT grant
--     access — sector RLS still governs that) so RLS mirrors the project's
--     own sector visibility.
--
-- Idempotent: safe to run more than once.
-- =============================================

-- ---------------------------------------------
-- 1. Health + status note on projects
-- ---------------------------------------------
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS health text NOT NULL DEFAULT 'on_track';

-- Constrain `health` to the known RYG set. Added separately so a re-run on a
-- DB that already has the column (without the constraint) still applies it.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'projects_health_check'
  ) THEN
    ALTER TABLE projects
      ADD CONSTRAINT projects_health_check
      CHECK (health IN ('on_track', 'at_risk', 'off_track'));
  END IF;
END $$;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS status_note text;

-- ---------------------------------------------
-- 2. project_members — explicit, informational membership roster
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS project_members (
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id),
  -- Coarse role on the project; purely descriptive (no permission impact).
  role        text NOT NULL DEFAULT 'member'
              CHECK (role IN ('lead', 'member')),
  added_by    uuid REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_user_id
  ON project_members(user_id);

-- ---------------------------------------------
-- 3. RLS — membership is visible to / managed by users with the matching
--    project capability in any of the project's sectors.
-- ---------------------------------------------
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_members_select" ON project_members;
CREATE POLICY "project_members_select" ON project_members
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_sectors ps
      WHERE ps.project_id = project_members.project_id
      AND user_has_sector_access(ps.sector_id)
    )
  );

DROP POLICY IF EXISTS "project_members_insert" ON project_members;
CREATE POLICY "project_members_insert" ON project_members
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_sectors ps
      WHERE ps.project_id = project_members.project_id
      AND user_has_permission(ps.sector_id, 'project', 'update')
    )
  );

DROP POLICY IF EXISTS "project_members_delete" ON project_members;
CREATE POLICY "project_members_delete" ON project_members
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_sectors ps
      WHERE ps.project_id = project_members.project_id
      AND user_has_permission(ps.sector_id, 'project', 'update')
    )
  );
