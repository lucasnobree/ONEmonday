-- Migration 00090: Marketing module (Marketing)
-- Campaigns with budget/results, an editorial content calendar, audience
-- segments, and a KPI summary RPC.
-- Monetary amounts are stored as integer minor units (cents) in bigint
-- columns named *_cents — never floats / numeric (mirrors Finance).
-- Idempotent: safe to re-run.

-- =============================================
-- Module registration & enablement
-- =============================================
INSERT INTO modules (slug, name, description, icon, status, category)
VALUES (
  'marketing',
  'Marketing',
  'Campanhas, calendario editorial, audiencias e metricas de marketing',
  'Megaphone',
  'active',
  'hub'
)
ON CONFLICT (slug) DO UPDATE
  SET status = 'active',
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      icon = EXCLUDED.icon,
      category = EXCLUDED.category;

-- Enable Marketing for every existing sector.
INSERT INTO sector_modules (sector_id, module_id, is_enabled)
SELECT s.id, m.id, true
FROM sectors s
CROSS JOIN modules m
WHERE m.slug = 'marketing'
ON CONFLICT (sector_id, module_id) DO UPDATE SET is_enabled = true;

-- Register Marketing permissions.
INSERT INTO permissions (module_id, resource, action)
SELECT m.id, r, a
FROM modules m,
     unnest(ARRAY['campaign', 'content_item', 'audience_segment']) AS r,
     unnest(ARRAY['create', 'read', 'update', 'delete', 'manage']) AS a
WHERE m.slug = 'marketing'
ON CONFLICT (module_id, resource, action) DO NOTHING;

-- Grant all Marketing permissions to admin and manager roles.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
JOIN modules m ON p.module_id = m.id
WHERE r.slug IN ('admin', 'manager')
AND m.slug = 'marketing'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Grant create/read/update to analyst role.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
JOIN modules m ON p.module_id = m.id
WHERE r.slug = 'analyst'
AND p.action IN ('create', 'read', 'update')
AND m.slug = 'marketing'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Grant read-only to intern role.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
JOIN modules m ON p.module_id = m.id
WHERE r.slug = 'intern'
AND p.action = 'read'
AND m.slug = 'marketing'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- =============================================
-- marketing_campaigns — marketing campaign records
-- =============================================
CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id           uuid NOT NULL REFERENCES sectors(id),
  name                text NOT NULL,
  description         text,
  channel             text NOT NULL DEFAULT 'email'
                      CHECK (channel IN ('email', 'social', 'paid_ads',
                                         'content', 'event', 'seo', 'other')),
  status              text NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'scheduled', 'active',
                                        'paused', 'completed', 'cancelled')),
  -- Planned budget and actual spend, integer minor units (cents). Never negative.
  budget_cents        bigint NOT NULL DEFAULT 0 CHECK (budget_cents >= 0),
  spend_cents         bigint NOT NULL DEFAULT 0 CHECK (spend_cents >= 0),
  currency            text NOT NULL DEFAULT 'BRL',
  -- Result metrics, captured as the campaign runs. Never negative.
  impressions         bigint NOT NULL DEFAULT 0 CHECK (impressions >= 0),
  leads               bigint NOT NULL DEFAULT 0 CHECK (leads >= 0),
  conversions         bigint NOT NULL DEFAULT 0 CHECK (conversions >= 0),
  start_date          date NOT NULL DEFAULT CURRENT_DATE,
  end_date            date,
  created_by          uuid NOT NULL REFERENCES users(id),
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date IS NULL OR end_date >= start_date)
);

DROP TRIGGER IF EXISTS trg_marketing_campaigns_updated_at ON marketing_campaigns;
CREATE TRIGGER trg_marketing_campaigns_updated_at BEFORE UPDATE ON marketing_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- marketing_audience_segments — reusable audience definitions
-- =============================================
CREATE TABLE IF NOT EXISTS marketing_audience_segments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id       uuid NOT NULL REFERENCES sectors(id),
  name            text NOT NULL,
  description     text,
  channel         text NOT NULL DEFAULT 'email'
                  CHECK (channel IN ('email', 'social', 'paid_ads',
                                     'content', 'event', 'seo', 'other')),
  -- Estimated reachable audience size. Never negative.
  estimated_size  bigint NOT NULL DEFAULT 0 CHECK (estimated_size >= 0),
  created_by      uuid NOT NULL REFERENCES users(id),
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_marketing_segments_updated_at ON marketing_audience_segments;
CREATE TRIGGER trg_marketing_segments_updated_at BEFORE UPDATE ON marketing_audience_segments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- marketing_content_items — editorial / content calendar entries
-- =============================================
CREATE TABLE IF NOT EXISTS marketing_content_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id       uuid NOT NULL REFERENCES sectors(id),
  -- Optional link to the campaign this content belongs to.
  campaign_id     uuid REFERENCES marketing_campaigns(id) ON DELETE SET NULL,
  title           text NOT NULL,
  notes           text,
  channel         text NOT NULL DEFAULT 'social'
                  CHECK (channel IN ('email', 'social', 'paid_ads',
                                     'content', 'event', 'seo', 'other')),
  status          text NOT NULL DEFAULT 'idea'
                  CHECK (status IN ('idea', 'draft', 'scheduled',
                                    'published', 'cancelled')),
  scheduled_date  date NOT NULL DEFAULT CURRENT_DATE,
  created_by      uuid NOT NULL REFERENCES users(id),
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_marketing_content_updated_at ON marketing_content_items;
CREATE TRIGGER trg_marketing_content_updated_at BEFORE UPDATE ON marketing_content_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- Indexes
-- =============================================
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_sector_id ON marketing_campaigns(sector_id);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_status ON marketing_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_channel ON marketing_campaigns(channel);
CREATE INDEX IF NOT EXISTS idx_marketing_segments_sector_id ON marketing_audience_segments(sector_id);
CREATE INDEX IF NOT EXISTS idx_marketing_content_sector_id ON marketing_content_items(sector_id);
CREATE INDEX IF NOT EXISTS idx_marketing_content_scheduled ON marketing_content_items(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_marketing_content_campaign ON marketing_content_items(campaign_id);

-- =============================================
-- Enable RLS on all Marketing tables
-- =============================================
ALTER TABLE marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_audience_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_content_items ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS Policies — marketing_campaigns
-- =============================================
DROP POLICY IF EXISTS "marketing_campaigns_select" ON marketing_campaigns;
CREATE POLICY "marketing_campaigns_select" ON marketing_campaigns
  FOR SELECT TO authenticated
  USING (is_active = true AND user_has_sector_access(sector_id));

DROP POLICY IF EXISTS "marketing_campaigns_insert" ON marketing_campaigns;
CREATE POLICY "marketing_campaigns_insert" ON marketing_campaigns
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND
    user_has_permission(sector_id, 'campaign', 'create')
  );

DROP POLICY IF EXISTS "marketing_campaigns_update" ON marketing_campaigns;
CREATE POLICY "marketing_campaigns_update" ON marketing_campaigns
  FOR UPDATE TO authenticated
  USING (user_has_permission(sector_id, 'campaign', 'update'))
  WITH CHECK (user_has_permission(sector_id, 'campaign', 'update'));

DROP POLICY IF EXISTS "marketing_campaigns_delete" ON marketing_campaigns;
CREATE POLICY "marketing_campaigns_delete" ON marketing_campaigns
  FOR DELETE TO authenticated
  USING (user_has_permission(sector_id, 'campaign', 'delete'));

-- =============================================
-- RLS Policies — marketing_audience_segments
-- =============================================
DROP POLICY IF EXISTS "marketing_segments_select" ON marketing_audience_segments;
CREATE POLICY "marketing_segments_select" ON marketing_audience_segments
  FOR SELECT TO authenticated
  USING (is_active = true AND user_has_sector_access(sector_id));

DROP POLICY IF EXISTS "marketing_segments_insert" ON marketing_audience_segments;
CREATE POLICY "marketing_segments_insert" ON marketing_audience_segments
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND
    user_has_permission(sector_id, 'audience_segment', 'create')
  );

DROP POLICY IF EXISTS "marketing_segments_update" ON marketing_audience_segments;
CREATE POLICY "marketing_segments_update" ON marketing_audience_segments
  FOR UPDATE TO authenticated
  USING (user_has_permission(sector_id, 'audience_segment', 'update'))
  WITH CHECK (user_has_permission(sector_id, 'audience_segment', 'update'));

DROP POLICY IF EXISTS "marketing_segments_delete" ON marketing_audience_segments;
CREATE POLICY "marketing_segments_delete" ON marketing_audience_segments
  FOR DELETE TO authenticated
  USING (user_has_permission(sector_id, 'audience_segment', 'delete'));

-- =============================================
-- RLS Policies — marketing_content_items
-- =============================================
DROP POLICY IF EXISTS "marketing_content_select" ON marketing_content_items;
CREATE POLICY "marketing_content_select" ON marketing_content_items
  FOR SELECT TO authenticated
  USING (is_active = true AND user_has_sector_access(sector_id));

DROP POLICY IF EXISTS "marketing_content_insert" ON marketing_content_items;
CREATE POLICY "marketing_content_insert" ON marketing_content_items
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND
    user_has_permission(sector_id, 'content_item', 'create')
  );

DROP POLICY IF EXISTS "marketing_content_update" ON marketing_content_items;
CREATE POLICY "marketing_content_update" ON marketing_content_items
  FOR UPDATE TO authenticated
  USING (user_has_permission(sector_id, 'content_item', 'update'))
  WITH CHECK (user_has_permission(sector_id, 'content_item', 'update'));

DROP POLICY IF EXISTS "marketing_content_delete" ON marketing_content_items;
CREATE POLICY "marketing_content_delete" ON marketing_content_items
  FOR DELETE TO authenticated
  USING (user_has_permission(sector_id, 'content_item', 'delete'));

-- =============================================
-- RPC: get_marketing_summary
-- KPI totals + per-channel spend / leads breakdown for a sector.
-- Monetary amounts returned as integer cents.
-- =============================================
CREATE OR REPLACE FUNCTION get_marketing_summary(p_sector_id uuid)
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  IF NOT user_has_sector_access(p_sector_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT json_build_object(
    'active_campaigns', (
      SELECT COUNT(*) FROM marketing_campaigns
      WHERE sector_id = p_sector_id AND is_active = true
      AND status = 'active'
    ),
    'total_campaigns', (
      SELECT COUNT(*) FROM marketing_campaigns
      WHERE sector_id = p_sector_id AND is_active = true
    ),
    'total_budget_cents', COALESCE((
      SELECT SUM(budget_cents) FROM marketing_campaigns
      WHERE sector_id = p_sector_id AND is_active = true
    ), 0),
    'total_spend_cents', COALESCE((
      SELECT SUM(spend_cents) FROM marketing_campaigns
      WHERE sector_id = p_sector_id AND is_active = true
    ), 0),
    'total_leads', COALESCE((
      SELECT SUM(leads) FROM marketing_campaigns
      WHERE sector_id = p_sector_id AND is_active = true
    ), 0),
    'total_conversions', COALESCE((
      SELECT SUM(conversions) FROM marketing_campaigns
      WHERE sector_id = p_sector_id AND is_active = true
    ), 0),
    'total_impressions', COALESCE((
      SELECT SUM(impressions) FROM marketing_campaigns
      WHERE sector_id = p_sector_id AND is_active = true
    ), 0),
    'by_channel', (
      SELECT COALESCE(json_agg(row_to_json(c) ORDER BY c.channel), '[]'::json)
      FROM (
        SELECT
          channel,
          SUM(spend_cents) AS spend_cents,
          SUM(leads) AS leads,
          SUM(conversions) AS conversions
        FROM marketing_campaigns
        WHERE sector_id = p_sector_id AND is_active = true
        GROUP BY channel
      ) c
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
