-- =============================================
-- Migration 00020: CRM Deal Health
-- Adds deal rotting (staleness) tracking and a
-- structured closed-lost reason taxonomy.
-- Idempotent: safe to re-run.
-- =============================================

-- ---------------------------------------------
-- Deal rotting: track when a deal last changed stage.
-- A deal "rots" when it sits in a stage longer than
-- the stage's configured rotting_days threshold.
-- ---------------------------------------------
ALTER TABLE crm_deals
  ADD COLUMN IF NOT EXISTS last_stage_change_at timestamptz NOT NULL DEFAULT now();

-- Backfill: existing deals start their rotting clock at creation time.
UPDATE crm_deals
  SET last_stage_change_at = created_at
  WHERE last_stage_change_at IS NULL OR last_stage_change_at = now();

-- Per-stage rotting threshold (days). 0 = rotting disabled for the stage.
ALTER TABLE crm_pipeline_stage_defaults
  ADD COLUMN IF NOT EXISTS rotting_days integer NOT NULL DEFAULT 0
    CHECK (rotting_days >= 0);

-- ---------------------------------------------
-- Structured closed-lost reason taxonomy.
-- Enforced enum so win/loss analytics is possible;
-- the existing free-text lost_reason stays as the note.
-- ---------------------------------------------
ALTER TABLE crm_deals
  ADD COLUMN IF NOT EXISTS lost_reason_category text
    CHECK (
      lost_reason_category IS NULL
      OR lost_reason_category IN (
        'price',          -- preco / orcamento
        'competitor',     -- perdido para concorrente
        'timing',         -- momento / timing
        'no_budget',      -- sem verba
        'no_decision',    -- nao houve decisao
        'product_fit',    -- produto nao atende
        'no_response',    -- cliente parou de responder
        'other'           -- outro
      )
    );

CREATE INDEX IF NOT EXISTS idx_crm_deals_lost_reason_category
  ON crm_deals(lost_reason_category);

-- ---------------------------------------------
-- Deal stage history: audit trail of every stage move,
-- enabling time-in-stage analytics.
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS crm_deal_stage_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id         uuid NOT NULL REFERENCES crm_deals(id) ON DELETE CASCADE,
  sector_id       uuid NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
  from_stage_name text,
  to_stage_name   text NOT NULL,
  changed_by      uuid NOT NULL REFERENCES users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_deal_stage_history_deal_id
  ON crm_deal_stage_history(deal_id);
CREATE INDEX IF NOT EXISTS idx_crm_deal_stage_history_sector_id
  ON crm_deal_stage_history(sector_id);

ALTER TABLE crm_deal_stage_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deal_stage_history_select" ON crm_deal_stage_history;
CREATE POLICY "deal_stage_history_select" ON crm_deal_stage_history
  FOR SELECT TO authenticated
  USING (
    sector_id IN (
      SELECT sector_id FROM user_sector_roles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "deal_stage_history_insert" ON crm_deal_stage_history;
CREATE POLICY "deal_stage_history_insert" ON crm_deal_stage_history
  FOR INSERT TO authenticated
  WITH CHECK (
    changed_by = auth.uid()
    AND sector_id IN (
      SELECT sector_id FROM user_sector_roles WHERE user_id = auth.uid()
    )
  );

-- History is an immutable audit log: no UPDATE/DELETE policies are granted,
-- so RLS denies those operations to non-privileged roles by default.
