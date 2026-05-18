-- =============================================
-- Migration 00200: Legal — status-change history
-- Implements the deferred Legal Wave 4 backlog item C1/K2: contract and matter
-- statuses advanced only by manually re-picking a dropdown, with no record of
-- who moved a record, when, or from which status. Ironclad's Workflow Designer
-- and DocuSign CLM routing are built on exactly this audit trail.
--
-- Adds a single `legal_status_history` table that records every status
-- transition for both contracts and matters. An entity_type discriminator
-- keeps it one table instead of two near-identical ones; entity_id is the
-- contract or matter id (no FK — the discriminator picks the parent table).
--
-- A `note` column carries the optional reason a transition was made — used by
-- the lightweight contract approval step (reject reason). The submit/approve/
-- reject actions are modelled as ordinary status transitions over the existing
-- contract statuses (draft -> in_review -> approved / draft) so no new status
-- enum value is needed.
--
-- Every new table gets RLS; the table is sector-scoped via a denormalised
-- sector_id. Idempotent: safe to run more than once.
-- =============================================

-- ---------------------------------------------
-- 1. legal_status_history — one row per status transition
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS legal_status_history (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Which kind of record this transition belongs to.
  entity_type  text NOT NULL CHECK (entity_type IN ('contract', 'matter')),
  -- The contract or matter id. No FK: the discriminator selects the parent.
  entity_id    uuid NOT NULL,
  -- Denormalised sector_id for straightforward RLS without a join.
  sector_id    uuid NOT NULL REFERENCES sectors(id),
  -- The status before the transition; NULL for the first (creation) entry.
  from_status  text,
  -- The status after the transition.
  to_status    text NOT NULL,
  -- Optional free-form note, e.g. a contract-approval rejection reason.
  note         text,
  -- Who performed the transition.
  changed_by   uuid NOT NULL REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legal_status_history_entity
  ON legal_status_history(entity_type, entity_id, created_at);
CREATE INDEX IF NOT EXISTS idx_legal_status_history_sector_id
  ON legal_status_history(sector_id);

-- ---------------------------------------------
-- 2. RLS — sector-scoped
-- ---------------------------------------------
ALTER TABLE legal_status_history ENABLE ROW LEVEL SECURITY;

-- Anyone with sector access can read the history of records in their sector.
DROP POLICY IF EXISTS "legal_status_history_select" ON legal_status_history;
CREATE POLICY "legal_status_history_select" ON legal_status_history
  FOR SELECT TO authenticated
  USING (user_has_sector_access(sector_id));

-- A history row may only be written by the user performing the transition,
-- and only when they hold update rights on the relevant resource. The
-- `contract` and `legal_matter` resources are the ones whose status changes.
DROP POLICY IF EXISTS "legal_status_history_insert" ON legal_status_history;
CREATE POLICY "legal_status_history_insert" ON legal_status_history
  FOR INSERT TO authenticated
  WITH CHECK (
    changed_by = auth.uid()
    AND (
      (entity_type = 'contract'
        AND user_has_permission(sector_id, 'contract', 'update'))
      OR (entity_type = 'matter'
        AND user_has_permission(sector_id, 'legal_matter', 'update'))
    )
  );

-- History is append-only: no UPDATE / DELETE policies (an audit trail must not
-- be editable). RLS denies both by default once enabled.
