-- =============================================
-- Migration 00201: Legal — matter comment / activity thread
-- Implements the deferred Legal Wave 4 backlog item M1: a matter detail sheet
-- showed a static description only. A legal request is a back-and-forth
-- between the requester and the legal team — without a thread, a matter is a
-- form, not a workflow.
--
-- Adds `legal_matter_comments`: one row per comment, attached to a matter,
-- sector-scoped. Comments are user-authored text; an author may edit or delete
-- their own comment, and a manager may moderate (delete) any comment in the
-- sector.
--
-- Every new table gets RLS. Idempotent: safe to run more than once.
-- =============================================

-- ---------------------------------------------
-- 1. legal_matter_comments — thread entries on a matter
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS legal_matter_comments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id    uuid NOT NULL REFERENCES legal_matters(id) ON DELETE CASCADE,
  -- Denormalised sector_id for straightforward RLS without a join.
  sector_id    uuid NOT NULL REFERENCES sectors(id),
  body         text NOT NULL CHECK (length(btrim(body)) > 0),
  author_id    uuid NOT NULL REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legal_matter_comments_matter_id
  ON legal_matter_comments(matter_id, created_at);
CREATE INDEX IF NOT EXISTS idx_legal_matter_comments_sector_id
  ON legal_matter_comments(sector_id);

-- Keep `updated_at` fresh on edit (reuses the shared trigger function).
DROP TRIGGER IF EXISTS trg_legal_matter_comments_updated_at
  ON legal_matter_comments;
CREATE TRIGGER trg_legal_matter_comments_updated_at
  BEFORE UPDATE ON legal_matter_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------
-- 2. RLS — sector-scoped
-- ---------------------------------------------
ALTER TABLE legal_matter_comments ENABLE ROW LEVEL SECURITY;

-- Anyone with sector access reads the thread.
DROP POLICY IF EXISTS "legal_matter_comments_select" ON legal_matter_comments;
CREATE POLICY "legal_matter_comments_select" ON legal_matter_comments
  FOR SELECT TO authenticated
  USING (user_has_sector_access(sector_id));

-- Posting a comment needs `legal_matter` update rights and the author must be
-- the current user — commenting is part of working a matter.
DROP POLICY IF EXISTS "legal_matter_comments_insert" ON legal_matter_comments;
CREATE POLICY "legal_matter_comments_insert" ON legal_matter_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND user_has_permission(sector_id, 'legal_matter', 'update')
  );

-- A user may edit only their own comment.
DROP POLICY IF EXISTS "legal_matter_comments_update" ON legal_matter_comments;
CREATE POLICY "legal_matter_comments_update" ON legal_matter_comments
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

-- A user may delete their own comment; a manager/admin (holding the
-- `legal_matter` delete capability) may moderate any comment in the sector.
DROP POLICY IF EXISTS "legal_matter_comments_delete" ON legal_matter_comments;
CREATE POLICY "legal_matter_comments_delete" ON legal_matter_comments
  FOR DELETE TO authenticated
  USING (
    author_id = auth.uid()
    OR user_has_permission(sector_id, 'legal_matter', 'delete')
  );
