-- Migration 00014: CRM Proposal Items, Pipeline Stage Defaults, Probability Lock

-- Proposal line items
CREATE TABLE crm_proposal_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES crm_proposals(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  position integer NOT NULL DEFAULT 0
);

ALTER TABLE crm_proposal_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proposal_items_select" ON crm_proposal_items
  FOR SELECT TO authenticated
  USING (
    proposal_id IN (
      SELECT id FROM crm_proposals
      WHERE sector_id IN (SELECT sector_id FROM user_sector_roles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "proposal_items_insert" ON crm_proposal_items
  FOR INSERT TO authenticated
  WITH CHECK (
    proposal_id IN (
      SELECT id FROM crm_proposals
      WHERE sector_id IN (SELECT sector_id FROM user_sector_roles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "proposal_items_update" ON crm_proposal_items
  FOR UPDATE TO authenticated
  USING (
    proposal_id IN (
      SELECT id FROM crm_proposals
      WHERE sector_id IN (SELECT sector_id FROM user_sector_roles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "proposal_items_delete" ON crm_proposal_items
  FOR DELETE TO authenticated
  USING (
    proposal_id IN (
      SELECT id FROM crm_proposals
      WHERE sector_id IN (SELECT sector_id FROM user_sector_roles WHERE user_id = auth.uid())
    )
  );

-- Pipeline stage defaults for probability automation
CREATE TABLE crm_pipeline_stage_defaults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id uuid NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
  stage_name text NOT NULL,
  default_probability integer NOT NULL DEFAULT 0 CHECK (default_probability BETWEEN 0 AND 100),
  position integer NOT NULL DEFAULT 0,
  UNIQUE(sector_id, stage_name)
);

ALTER TABLE crm_pipeline_stage_defaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stage_defaults_select" ON crm_pipeline_stage_defaults
  FOR SELECT TO authenticated
  USING (sector_id IN (SELECT sector_id FROM user_sector_roles WHERE user_id = auth.uid()));

CREATE POLICY "stage_defaults_insert" ON crm_pipeline_stage_defaults
  FOR INSERT TO authenticated
  WITH CHECK (sector_id IN (SELECT sector_id FROM user_sector_roles WHERE user_id = auth.uid()));

CREATE POLICY "stage_defaults_update" ON crm_pipeline_stage_defaults
  FOR UPDATE TO authenticated
  USING (sector_id IN (SELECT sector_id FROM user_sector_roles WHERE user_id = auth.uid()));

CREATE POLICY "stage_defaults_delete" ON crm_pipeline_stage_defaults
  FOR DELETE TO authenticated
  USING (sector_id IN (SELECT sector_id FROM user_sector_roles WHERE user_id = auth.uid()));

-- Add probability lock to deals
ALTER TABLE crm_deals ADD COLUMN probability_locked boolean NOT NULL DEFAULT false;
