-- =============================================
-- CRM Module Tables
-- =============================================

-- =============================================
-- crm_companies — Empresas/Contas
-- =============================================
CREATE TABLE crm_companies (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id   uuid NOT NULL REFERENCES sectors(id),
  name        text NOT NULL,
  domain      text,
  industry    text,
  size        text CHECK (size IN ('micro', 'small', 'medium', 'large', 'enterprise')),
  phone       text,
  email       text,
  address     text,
  city        text,
  state       text,
  notes       text,
  owner_id    uuid REFERENCES users(id),
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
CREATE TRIGGER trg_crm_companies_updated_at BEFORE UPDATE ON crm_companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- crm_contacts — Contatos
-- =============================================
CREATE TABLE crm_contacts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id   uuid NOT NULL REFERENCES sectors(id),
  company_id  uuid REFERENCES crm_companies(id),
  full_name   text NOT NULL,
  email       text,
  phone       text,
  position    text,
  is_primary  boolean DEFAULT false,
  owner_id    uuid REFERENCES users(id),
  notes       text,
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
CREATE TRIGGER trg_crm_contacts_updated_at BEFORE UPDATE ON crm_contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- crm_deals — Deals/Oportunidades vinculados 1:1 com card
-- =============================================
CREATE TABLE crm_deals (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id             uuid UNIQUE NOT NULL REFERENCES cards(id),
  sector_id           uuid NOT NULL REFERENCES sectors(id),
  company_id          uuid REFERENCES crm_companies(id),
  contact_id          uuid REFERENCES crm_contacts(id),
  value               numeric(15,2),
  currency            text DEFAULT 'BRL',
  expected_close_date date,
  actual_close_date   date,
  lost_reason         text,
  win_probability     int CHECK (win_probability >= 0 AND win_probability <= 100),
  source              text,
  is_active           boolean DEFAULT true,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);
CREATE TRIGGER trg_crm_deals_updated_at BEFORE UPDATE ON crm_deals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- crm_activities — Registro de atividades
-- =============================================
CREATE TABLE crm_activities (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id     uuid NOT NULL REFERENCES sectors(id),
  deal_id       uuid REFERENCES crm_deals(id),
  contact_id    uuid REFERENCES crm_contacts(id),
  company_id    uuid REFERENCES crm_companies(id),
  type          text NOT NULL CHECK (type IN ('call', 'email', 'meeting', 'note', 'task')),
  subject       text NOT NULL,
  description   text,
  scheduled_at  timestamptz,
  completed_at  timestamptz,
  duration_min  int,
  performed_by  uuid NOT NULL REFERENCES users(id),
  is_active     boolean DEFAULT true,
  created_at    timestamptz DEFAULT now()
);

-- =============================================
-- crm_proposals — Propostas comerciais
-- =============================================
CREATE TABLE crm_proposals (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id     uuid NOT NULL REFERENCES crm_deals(id),
  sector_id   uuid NOT NULL REFERENCES sectors(id),
  title       text NOT NULL,
  content     text,
  value       numeric(15,2),
  status      text DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired')),
  sent_at     timestamptz,
  expires_at  timestamptz,
  created_by  uuid NOT NULL REFERENCES users(id),
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
CREATE TRIGGER trg_crm_proposals_updated_at BEFORE UPDATE ON crm_proposals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- Enable RLS on all CRM tables
-- =============================================
ALTER TABLE crm_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_proposals ENABLE ROW LEVEL SECURITY;

-- =============================================
-- Indexes
-- =============================================
CREATE INDEX idx_crm_companies_sector_id ON crm_companies(sector_id);
CREATE INDEX idx_crm_contacts_sector_id ON crm_contacts(sector_id);
CREATE INDEX idx_crm_contacts_company_id ON crm_contacts(company_id);
CREATE INDEX idx_crm_deals_sector_id ON crm_deals(sector_id);
CREATE INDEX idx_crm_deals_card_id ON crm_deals(card_id);
CREATE INDEX idx_crm_deals_company_id ON crm_deals(company_id);
CREATE INDEX idx_crm_deals_contact_id ON crm_deals(contact_id);
CREATE INDEX idx_crm_activities_sector_id ON crm_activities(sector_id);
CREATE INDEX idx_crm_activities_deal_id ON crm_activities(deal_id);
CREATE INDEX idx_crm_activities_contact_id ON crm_activities(contact_id);
CREATE INDEX idx_crm_activities_company_id ON crm_activities(company_id);
CREATE INDEX idx_crm_proposals_sector_id ON crm_proposals(sector_id);
CREATE INDEX idx_crm_proposals_deal_id ON crm_proposals(deal_id);

-- =============================================
-- RLS Policies — crm_companies
-- =============================================
CREATE POLICY "crm_companies_select" ON crm_companies
  FOR SELECT TO authenticated
  USING (is_active = true AND user_has_sector_access(sector_id));

CREATE POLICY "crm_companies_insert" ON crm_companies
  FOR INSERT TO authenticated
  WITH CHECK (user_has_permission(sector_id, 'crm_company', 'create'));

CREATE POLICY "crm_companies_update" ON crm_companies
  FOR UPDATE TO authenticated
  USING (user_has_permission(sector_id, 'crm_company', 'update'))
  WITH CHECK (user_has_permission(sector_id, 'crm_company', 'update'));

CREATE POLICY "crm_companies_delete" ON crm_companies
  FOR DELETE TO authenticated
  USING (user_has_permission(sector_id, 'crm_company', 'delete'));

-- =============================================
-- RLS Policies — crm_contacts
-- =============================================
CREATE POLICY "crm_contacts_select" ON crm_contacts
  FOR SELECT TO authenticated
  USING (is_active = true AND user_has_sector_access(sector_id));

CREATE POLICY "crm_contacts_insert" ON crm_contacts
  FOR INSERT TO authenticated
  WITH CHECK (user_has_permission(sector_id, 'crm_contact', 'create'));

CREATE POLICY "crm_contacts_update" ON crm_contacts
  FOR UPDATE TO authenticated
  USING (user_has_permission(sector_id, 'crm_contact', 'update'))
  WITH CHECK (user_has_permission(sector_id, 'crm_contact', 'update'));

CREATE POLICY "crm_contacts_delete" ON crm_contacts
  FOR DELETE TO authenticated
  USING (user_has_permission(sector_id, 'crm_contact', 'delete'));

-- =============================================
-- RLS Policies — crm_deals
-- =============================================
CREATE POLICY "crm_deals_select" ON crm_deals
  FOR SELECT TO authenticated
  USING (is_active = true AND user_has_sector_access(sector_id));

CREATE POLICY "crm_deals_insert" ON crm_deals
  FOR INSERT TO authenticated
  WITH CHECK (user_has_permission(sector_id, 'crm_deal', 'create'));

CREATE POLICY "crm_deals_update" ON crm_deals
  FOR UPDATE TO authenticated
  USING (user_has_permission(sector_id, 'crm_deal', 'update'))
  WITH CHECK (user_has_permission(sector_id, 'crm_deal', 'update'));

CREATE POLICY "crm_deals_delete" ON crm_deals
  FOR DELETE TO authenticated
  USING (user_has_permission(sector_id, 'crm_deal', 'delete'));

-- =============================================
-- RLS Policies — crm_activities
-- =============================================
CREATE POLICY "crm_activities_select" ON crm_activities
  FOR SELECT TO authenticated
  USING (is_active = true AND user_has_sector_access(sector_id));

CREATE POLICY "crm_activities_insert" ON crm_activities
  FOR INSERT TO authenticated
  WITH CHECK (
    performed_by = auth.uid() AND
    user_has_permission(sector_id, 'crm_activity', 'create')
  );

CREATE POLICY "crm_activities_update" ON crm_activities
  FOR UPDATE TO authenticated
  USING (
    (performed_by = auth.uid()) OR
    user_has_permission(sector_id, 'crm_activity', 'update')
  );

CREATE POLICY "crm_activities_delete" ON crm_activities
  FOR DELETE TO authenticated
  USING (user_has_permission(sector_id, 'crm_activity', 'delete'));

-- =============================================
-- RLS Policies — crm_proposals
-- =============================================
CREATE POLICY "crm_proposals_select" ON crm_proposals
  FOR SELECT TO authenticated
  USING (is_active = true AND user_has_sector_access(sector_id));

CREATE POLICY "crm_proposals_insert" ON crm_proposals
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND
    user_has_permission(sector_id, 'crm_proposal', 'create')
  );

CREATE POLICY "crm_proposals_update" ON crm_proposals
  FOR UPDATE TO authenticated
  USING (user_has_permission(sector_id, 'crm_proposal', 'update'))
  WITH CHECK (user_has_permission(sector_id, 'crm_proposal', 'update'));

CREATE POLICY "crm_proposals_delete" ON crm_proposals
  FOR DELETE TO authenticated
  USING (user_has_permission(sector_id, 'crm_proposal', 'delete'));

-- =============================================
-- RPC: get_crm_pipeline_stats
-- =============================================
CREATE OR REPLACE FUNCTION get_crm_pipeline_stats(p_sector_id uuid)
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  IF NOT user_has_sector_access(p_sector_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT json_build_object(
    'total_pipeline_value', COALESCE(
      (SELECT SUM(d.value) FROM crm_deals d
       WHERE d.sector_id = p_sector_id AND d.is_active = true
       AND d.actual_close_date IS NULL), 0
    ),
    'deals_open', (
      SELECT COUNT(*) FROM crm_deals d
      WHERE d.sector_id = p_sector_id AND d.is_active = true
      AND d.actual_close_date IS NULL
    ),
    'deals_won_month', (
      SELECT COUNT(*) FROM crm_deals d
      JOIN cards c ON c.id = d.card_id
      JOIN board_columns bc ON bc.id = c.column_id
      WHERE d.sector_id = p_sector_id AND d.is_active = true
      AND d.actual_close_date IS NOT NULL AND d.lost_reason IS NULL
      AND d.actual_close_date >= date_trunc('month', CURRENT_DATE)
    ),
    'deals_lost_month', (
      SELECT COUNT(*) FROM crm_deals d
      WHERE d.sector_id = p_sector_id AND d.is_active = true
      AND d.actual_close_date IS NOT NULL AND d.lost_reason IS NOT NULL
      AND d.actual_close_date >= date_trunc('month', CURRENT_DATE)
    ),
    'avg_deal_value', COALESCE(
      (SELECT AVG(d.value) FROM crm_deals d
       WHERE d.sector_id = p_sector_id AND d.is_active = true
       AND d.value IS NOT NULL), 0
    ),
    'conversion_rate', COALESCE(
      (SELECT
        CASE
          WHEN COUNT(*) = 0 THEN 0
          ELSE ROUND(
            COUNT(*) FILTER (WHERE d.actual_close_date IS NOT NULL AND d.lost_reason IS NULL)::numeric
            / COUNT(*)::numeric * 100, 2
          )
        END
       FROM crm_deals d
       WHERE d.sector_id = p_sector_id AND d.is_active = true
       AND d.actual_close_date IS NOT NULL
      ), 0)
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- RPC: get_crm_dashboard_stats
-- =============================================
CREATE OR REPLACE FUNCTION get_crm_dashboard_stats(p_sector_id uuid)
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  IF NOT user_has_sector_access(p_sector_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT json_build_object(
    'total_companies', (
      SELECT COUNT(*) FROM crm_companies
      WHERE sector_id = p_sector_id AND is_active = true
    ),
    'total_contacts', (
      SELECT COUNT(*) FROM crm_contacts
      WHERE sector_id = p_sector_id AND is_active = true
    ),
    'total_deals', (
      SELECT COUNT(*) FROM crm_deals
      WHERE sector_id = p_sector_id AND is_active = true
    ),
    'total_pipeline_value', COALESCE(
      (SELECT SUM(value) FROM crm_deals
       WHERE sector_id = p_sector_id AND is_active = true
       AND actual_close_date IS NULL), 0
    ),
    'deals_won_total', (
      SELECT COUNT(*) FROM crm_deals
      WHERE sector_id = p_sector_id AND is_active = true
      AND actual_close_date IS NOT NULL AND lost_reason IS NULL
    ),
    'deals_won_value', COALESCE(
      (SELECT SUM(value) FROM crm_deals
       WHERE sector_id = p_sector_id AND is_active = true
       AND actual_close_date IS NOT NULL AND lost_reason IS NULL), 0
    ),
    'activities_this_month', (
      SELECT COUNT(*) FROM crm_activities
      WHERE sector_id = p_sector_id AND is_active = true
      AND created_at >= date_trunc('month', CURRENT_DATE)
    ),
    'proposals_pending', (
      SELECT COUNT(*) FROM crm_proposals
      WHERE sector_id = p_sector_id AND is_active = true
      AND status IN ('draft', 'sent', 'viewed')
    ),
    'proposals_accepted', (
      SELECT COUNT(*) FROM crm_proposals
      WHERE sector_id = p_sector_id AND is_active = true
      AND status = 'accepted'
    ),
    'avg_deal_cycle_days', COALESCE(
      (SELECT AVG(EXTRACT(DAY FROM (d.actual_close_date::timestamp - d.created_at)))
       FROM crm_deals d
       WHERE d.sector_id = p_sector_id AND d.is_active = true
       AND d.actual_close_date IS NOT NULL), 0
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
