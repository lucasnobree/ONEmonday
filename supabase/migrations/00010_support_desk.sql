-- =============================================
-- Support Desk module tables
-- =============================================

-- SLA Rules (must come before support_tickets)
CREATE TABLE sla_rules (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id           uuid NOT NULL REFERENCES sectors(id),
  name                text NOT NULL,
  priority            text NOT NULL CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  category            text,
  response_time_hours int NOT NULL,
  resolve_time_hours  int NOT NULL,
  business_hours_only boolean DEFAULT true,
  is_active           boolean DEFAULT true,
  created_at          timestamptz DEFAULT now(),
  UNIQUE(sector_id, priority, category)
);

-- Support Tickets (1:1 with cards)
CREATE TABLE support_tickets (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id               uuid UNIQUE NOT NULL REFERENCES cards(id),
  sector_id             uuid NOT NULL REFERENCES sectors(id),
  category              text NOT NULL,
  subcategory           text,
  channel               text CHECK (channel IN ('internal', 'email', 'chat', 'phone')),
  requester_id          uuid REFERENCES users(id),
  requester_email       text,
  sla_rule_id           uuid REFERENCES sla_rules(id),
  first_response_at     timestamptz,
  resolved_at           timestamptz,
  sla_response_due_at   timestamptz,
  sla_resolve_due_at    timestamptz,
  sla_response_breached boolean DEFAULT false,
  sla_resolve_breached  boolean DEFAULT false,
  csat_rating           int CHECK (csat_rating >= 1 AND csat_rating <= 5),
  csat_comment          text,
  csat_submitted_at     timestamptz,
  is_active             boolean DEFAULT true,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);
CREATE TRIGGER trg_support_tickets_updated_at BEFORE UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Knowledge Base Articles
CREATE TABLE kb_articles (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id     uuid NOT NULL REFERENCES sectors(id),
  title         text NOT NULL,
  content       text,
  category      text,
  tags          text[],
  author_id     uuid NOT NULL REFERENCES users(id),
  is_published  boolean DEFAULT false,
  view_count    int DEFAULT 0,
  is_active     boolean DEFAULT true,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);
CREATE TRIGGER trg_kb_articles_updated_at BEFORE UPDATE ON kb_articles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Canned Responses
CREATE TABLE canned_responses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id   uuid NOT NULL REFERENCES sectors(id),
  title       text NOT NULL,
  content     text NOT NULL,
  category    text,
  shortcut    text,
  created_by  uuid NOT NULL REFERENCES users(id),
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

-- =============================================
-- Indexes
-- =============================================
CREATE INDEX idx_support_tickets_sector_id ON support_tickets(sector_id);
CREATE INDEX idx_support_tickets_card_id ON support_tickets(card_id);
CREATE INDEX idx_support_tickets_sla_response_due ON support_tickets(sla_response_due_at);
CREATE INDEX idx_support_tickets_sla_resolve_due ON support_tickets(sla_resolve_due_at);
CREATE INDEX idx_support_tickets_requester_id ON support_tickets(requester_id);
CREATE INDEX idx_sla_rules_sector_id ON sla_rules(sector_id);
CREATE INDEX idx_kb_articles_sector_id ON kb_articles(sector_id);
CREATE INDEX idx_kb_articles_category ON kb_articles(sector_id, category);
CREATE INDEX idx_canned_responses_sector_id ON canned_responses(sector_id);

-- =============================================
-- Enable RLS
-- =============================================
ALTER TABLE sla_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE canned_responses ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS Policies: sla_rules
-- =============================================
CREATE POLICY "sla_rules_select" ON sla_rules
  FOR SELECT TO authenticated
  USING (user_has_sector_access(sector_id));

CREATE POLICY "sla_rules_insert" ON sla_rules
  FOR INSERT TO authenticated
  WITH CHECK (
    is_global_admin() OR
    EXISTS (
      SELECT 1 FROM user_sector_roles usr
      JOIN role_permissions rp ON rp.role_id = usr.role_id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE usr.user_id = auth.uid()
      AND usr.sector_id = sla_rules.sector_id
      AND p.resource = 'sla_rule' AND p.action = 'create'
    )
  );

CREATE POLICY "sla_rules_update" ON sla_rules
  FOR UPDATE TO authenticated
  USING (
    is_global_admin() OR
    EXISTS (
      SELECT 1 FROM user_sector_roles usr
      JOIN role_permissions rp ON rp.role_id = usr.role_id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE usr.user_id = auth.uid()
      AND usr.sector_id = sla_rules.sector_id
      AND p.resource = 'sla_rule' AND p.action = 'update'
    )
  );

CREATE POLICY "sla_rules_delete" ON sla_rules
  FOR DELETE TO authenticated
  USING (
    is_global_admin() OR
    EXISTS (
      SELECT 1 FROM user_sector_roles usr
      JOIN role_permissions rp ON rp.role_id = usr.role_id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE usr.user_id = auth.uid()
      AND usr.sector_id = sla_rules.sector_id
      AND p.resource = 'sla_rule' AND p.action = 'delete'
    )
  );

-- =============================================
-- RLS Policies: support_tickets
-- =============================================
CREATE POLICY "support_tickets_select" ON support_tickets
  FOR SELECT TO authenticated
  USING (is_active = true AND user_has_sector_access(sector_id));

CREATE POLICY "support_tickets_insert" ON support_tickets
  FOR INSERT TO authenticated
  WITH CHECK (
    is_global_admin() OR
    EXISTS (
      SELECT 1 FROM user_sector_roles usr
      JOIN role_permissions rp ON rp.role_id = usr.role_id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE usr.user_id = auth.uid()
      AND usr.sector_id = support_tickets.sector_id
      AND p.resource = 'support_ticket' AND p.action = 'create'
    )
  );

CREATE POLICY "support_tickets_update" ON support_tickets
  FOR UPDATE TO authenticated
  USING (
    is_global_admin() OR
    EXISTS (
      SELECT 1 FROM user_sector_roles usr
      JOIN role_permissions rp ON rp.role_id = usr.role_id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE usr.user_id = auth.uid()
      AND usr.sector_id = support_tickets.sector_id
      AND p.resource = 'support_ticket' AND p.action = 'update'
    )
  );

-- =============================================
-- RLS Policies: kb_articles
-- =============================================
CREATE POLICY "kb_articles_select" ON kb_articles
  FOR SELECT TO authenticated
  USING (
    is_active = true AND (
      (is_published = true AND user_has_sector_access(sector_id))
      OR is_global_admin()
      OR EXISTS (
        SELECT 1 FROM user_sector_roles usr
        JOIN role_permissions rp ON rp.role_id = usr.role_id
        JOIN permissions p ON p.id = rp.permission_id
        WHERE usr.user_id = auth.uid()
        AND usr.sector_id = kb_articles.sector_id
        AND p.resource = 'kb_article' AND p.action = 'create'
      )
    )
  );

CREATE POLICY "kb_articles_insert" ON kb_articles
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid() AND (
      is_global_admin() OR
      EXISTS (
        SELECT 1 FROM user_sector_roles usr
        JOIN role_permissions rp ON rp.role_id = usr.role_id
        JOIN permissions p ON p.id = rp.permission_id
        WHERE usr.user_id = auth.uid()
        AND usr.sector_id = kb_articles.sector_id
        AND p.resource = 'kb_article' AND p.action = 'create'
      )
    )
  );

CREATE POLICY "kb_articles_update" ON kb_articles
  FOR UPDATE TO authenticated
  USING (
    is_global_admin() OR
    (author_id = auth.uid()) OR
    EXISTS (
      SELECT 1 FROM user_sector_roles usr
      JOIN role_permissions rp ON rp.role_id = usr.role_id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE usr.user_id = auth.uid()
      AND usr.sector_id = kb_articles.sector_id
      AND p.resource = 'kb_article' AND p.action = 'update'
    )
  );

-- =============================================
-- RLS Policies: canned_responses
-- =============================================
CREATE POLICY "canned_responses_select" ON canned_responses
  FOR SELECT TO authenticated
  USING (is_active = true AND user_has_sector_access(sector_id));

CREATE POLICY "canned_responses_insert" ON canned_responses
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND (
      is_global_admin() OR
      EXISTS (
        SELECT 1 FROM user_sector_roles usr
        JOIN role_permissions rp ON rp.role_id = usr.role_id
        JOIN permissions p ON p.id = rp.permission_id
        WHERE usr.user_id = auth.uid()
        AND usr.sector_id = canned_responses.sector_id
        AND p.resource = 'canned_response' AND p.action = 'create'
      )
    )
  );

CREATE POLICY "canned_responses_update" ON canned_responses
  FOR UPDATE TO authenticated
  USING (
    is_global_admin() OR
    (created_by = auth.uid()) OR
    EXISTS (
      SELECT 1 FROM user_sector_roles usr
      JOIN role_permissions rp ON rp.role_id = usr.role_id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE usr.user_id = auth.uid()
      AND usr.sector_id = canned_responses.sector_id
      AND p.resource = 'canned_response' AND p.action = 'update'
    )
  );

CREATE POLICY "canned_responses_delete" ON canned_responses
  FOR DELETE TO authenticated
  USING (
    is_global_admin() OR
    EXISTS (
      SELECT 1 FROM user_sector_roles usr
      JOIN role_permissions rp ON rp.role_id = usr.role_id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE usr.user_id = auth.uid()
      AND usr.sector_id = canned_responses.sector_id
      AND p.resource = 'canned_response' AND p.action = 'delete'
    )
  );

-- =============================================
-- RPC: Support Dashboard Stats
-- =============================================
CREATE OR REPLACE FUNCTION get_support_dashboard_stats(p_sector_id uuid)
RETURNS TABLE (
  total_open        bigint,
  total_resolved_today bigint,
  sla_compliance_pct numeric,
  avg_csat          numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    -- Total open: tickets without resolved_at
    (SELECT count(*)
     FROM support_tickets st
     JOIN cards c ON c.id = st.card_id
     WHERE st.sector_id = p_sector_id
     AND st.is_active = true
     AND st.resolved_at IS NULL
     AND c.is_active = true
    ) AS total_open,

    -- Resolved today
    (SELECT count(*)
     FROM support_tickets st
     WHERE st.sector_id = p_sector_id
     AND st.is_active = true
     AND st.resolved_at >= date_trunc('day', now())
    ) AS total_resolved_today,

    -- SLA compliance: % of resolved tickets that did NOT breach either SLA
    (SELECT
      CASE
        WHEN count(*) = 0 THEN 100.0
        ELSE round(
          100.0 * count(*) FILTER (
            WHERE st.sla_response_breached = false
            AND st.sla_resolve_breached = false
          ) / count(*), 1
        )
      END
     FROM support_tickets st
     WHERE st.sector_id = p_sector_id
     AND st.is_active = true
     AND st.resolved_at IS NOT NULL
    ) AS sla_compliance_pct,

    -- Average CSAT
    (SELECT round(avg(st.csat_rating)::numeric, 2)
     FROM support_tickets st
     WHERE st.sector_id = p_sector_id
     AND st.is_active = true
     AND st.csat_rating IS NOT NULL
    ) AS avg_csat;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- Seed: Default SLA rules for Desenvolvimento sector
-- =============================================
INSERT INTO sla_rules (sector_id, name, priority, response_time_hours, resolve_time_hours, business_hours_only) VALUES
  ('3826e880-b077-4930-a676-7c5b96d10f63', 'Critical SLA', 'critical', 1, 4, false),
  ('3826e880-b077-4930-a676-7c5b96d10f63', 'High SLA',     'high',     2, 8, true),
  ('3826e880-b077-4930-a676-7c5b96d10f63', 'Medium SLA',   'medium',   4, 24, true),
  ('3826e880-b077-4930-a676-7c5b96d10f63', 'Low SLA',      'low',      8, 48, true);
