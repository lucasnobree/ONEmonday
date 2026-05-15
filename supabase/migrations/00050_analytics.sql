-- Migration 00050: Analytics module
-- Cross-module metric dashboards and saved reports. Aggregates boards/cards,
-- CRM, Support and HR data into sector-scoped analytics.
-- Idempotent: safe to re-run.

-- =============================================
-- Module registration & enablement
-- =============================================
-- The `analytics` module row may already exist as a `coming_soon` placeholder;
-- promote it to `active`.
INSERT INTO modules (slug, name, description, icon, status, category)
VALUES (
  'analytics',
  'Analytics',
  'Dashboards de metricas, KPIs e relatorios salvos entre modulos',
  'BarChart3',
  'active',
  'hub'
)
ON CONFLICT (slug) DO UPDATE
  SET status = 'active',
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      icon = EXCLUDED.icon,
      category = EXCLUDED.category;

-- Enable Analytics for every existing sector.
INSERT INTO sector_modules (sector_id, module_id, is_enabled)
SELECT s.id, m.id, true
FROM sectors s
CROSS JOIN modules m
WHERE m.slug = 'analytics'
ON CONFLICT (sector_id, module_id) DO UPDATE SET is_enabled = true;

-- Register Analytics permissions. `report` covers saved reports;
-- `dashboard` is already a core resource so it is not redeclared here.
INSERT INTO permissions (module_id, resource, action)
SELECT m.id, r, a
FROM modules m,
     unnest(ARRAY['analytics_report']) AS r,
     unnest(ARRAY['create', 'read', 'update', 'delete', 'manage']) AS a
WHERE m.slug = 'analytics'
ON CONFLICT (module_id, resource, action) DO NOTHING;

-- Grant all Analytics permissions to admin and manager roles.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
JOIN modules m ON p.module_id = m.id
WHERE r.slug IN ('admin', 'manager')
AND m.slug = 'analytics'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Grant create/read/update to analyst role.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
JOIN modules m ON p.module_id = m.id
WHERE r.slug = 'analyst'
AND p.action IN ('create', 'read', 'update')
AND m.slug = 'analytics'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Grant read-only to intern role.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
JOIN modules m ON p.module_id = m.id
WHERE r.slug = 'intern'
AND p.action = 'read'
AND m.slug = 'analytics'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- =============================================
-- analytics_reports — Saved, sector-scoped chart definitions
-- A report names a metric, picks a chart type and grouping. The metric/chart
-- keys are validated by the app (lib/analytics/metrics.ts) and re-checked by
-- the CHECK constraints below so the DB rejects unknown values directly.
-- =============================================
CREATE TABLE IF NOT EXISTS analytics_reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id   uuid NOT NULL REFERENCES sectors(id),
  name        text NOT NULL,
  description text,
  -- Logical metric key, e.g. 'cards_completed', 'deals_won_value'.
  metric      text NOT NULL,
  -- Chart presentation.
  chart_type  text NOT NULL DEFAULT 'bar'
              CHECK (chart_type IN ('bar', 'line', 'pie', 'kpi')),
  -- Time bucket / breakdown dimension for the series.
  group_by    text NOT NULL DEFAULT 'month'
              CHECK (group_by IN ('day', 'week', 'month', 'status', 'priority')),
  -- Rolling window in days the report covers (0 = all-time).
  date_range_days int NOT NULL DEFAULT 30
              CHECK (date_range_days >= 0 AND date_range_days <= 3650),
  created_by  uuid NOT NULL REFERENCES users(id),
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_analytics_reports_updated_at ON analytics_reports;
CREATE TRIGGER trg_analytics_reports_updated_at BEFORE UPDATE ON analytics_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_analytics_reports_sector_id
  ON analytics_reports(sector_id);

-- =============================================
-- Enable RLS
-- =============================================
ALTER TABLE analytics_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "analytics_reports_select" ON analytics_reports;
CREATE POLICY "analytics_reports_select" ON analytics_reports
  FOR SELECT TO authenticated
  USING (is_active = true AND user_has_sector_access(sector_id));

DROP POLICY IF EXISTS "analytics_reports_insert" ON analytics_reports;
CREATE POLICY "analytics_reports_insert" ON analytics_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND
    user_has_permission(sector_id, 'analytics_report', 'create')
  );

DROP POLICY IF EXISTS "analytics_reports_update" ON analytics_reports;
CREATE POLICY "analytics_reports_update" ON analytics_reports
  FOR UPDATE TO authenticated
  USING (user_has_permission(sector_id, 'analytics_report', 'update'))
  WITH CHECK (user_has_permission(sector_id, 'analytics_report', 'update'));

DROP POLICY IF EXISTS "analytics_reports_delete" ON analytics_reports;
CREATE POLICY "analytics_reports_delete" ON analytics_reports
  FOR DELETE TO authenticated
  USING (user_has_permission(sector_id, 'analytics_report', 'delete'));

-- =============================================
-- RPC: get_analytics_overview
-- Cross-module KPI snapshot for a sector over a rolling window, with
-- period-over-period deltas against the immediately preceding equal window.
-- Enforces sector access. All counts are integers; monetary values are
-- integer cents (CRM deal value is numeric major units -> *100).
-- =============================================
CREATE OR REPLACE FUNCTION get_analytics_overview(
  p_sector_id uuid,
  p_range_days int DEFAULT 30
)
RETURNS json AS $$
DECLARE
  result json;
  v_days int;
  v_cur_start timestamptz;
  v_prev_start timestamptz;
BEGIN
  IF NOT user_has_sector_access(p_sector_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Clamp the window to a sane range (1..3650 days).
  v_days := GREATEST(1, LEAST(COALESCE(p_range_days, 30), 3650));
  v_cur_start  := now() - make_interval(days => v_days);
  v_prev_start := now() - make_interval(days => v_days * 2);

  SELECT json_build_object(
    'range_days', v_days,
    -- Boards / cards: completed cards.
    'cards_completed_current', COALESCE((
      SELECT count(*) FROM cards
      WHERE sector_id = p_sector_id AND is_active = true
      AND completed_at >= v_cur_start
    ), 0),
    'cards_completed_previous', COALESCE((
      SELECT count(*) FROM cards
      WHERE sector_id = p_sector_id AND is_active = true
      AND completed_at >= v_prev_start AND completed_at < v_cur_start
    ), 0),
    'cards_open', COALESCE((
      SELECT count(*) FROM cards
      WHERE sector_id = p_sector_id AND is_active = true
      AND completed_at IS NULL
    ), 0),
    -- CRM: won deal value (numeric major units -> integer cents).
    'deals_won_value_cents_current', COALESCE((
      SELECT round(SUM(value) * 100) FROM crm_deals
      WHERE sector_id = p_sector_id AND is_active = true
      AND actual_close_date IS NOT NULL AND lost_reason IS NULL
      AND actual_close_date >= v_cur_start::date
    ), 0),
    'deals_won_value_cents_previous', COALESCE((
      SELECT round(SUM(value) * 100) FROM crm_deals
      WHERE sector_id = p_sector_id AND is_active = true
      AND actual_close_date IS NOT NULL AND lost_reason IS NULL
      AND actual_close_date >= v_prev_start::date
      AND actual_close_date < v_cur_start::date
    ), 0),
    'deals_open', COALESCE((
      SELECT count(*) FROM crm_deals
      WHERE sector_id = p_sector_id AND is_active = true
      AND actual_close_date IS NULL
    ), 0),
    -- Support: resolved tickets + SLA breaches.
    'tickets_resolved_current', COALESCE((
      SELECT count(*) FROM support_tickets
      WHERE sector_id = p_sector_id AND is_active = true
      AND resolved_at >= v_cur_start
    ), 0),
    'tickets_resolved_previous', COALESCE((
      SELECT count(*) FROM support_tickets
      WHERE sector_id = p_sector_id AND is_active = true
      AND resolved_at >= v_prev_start AND resolved_at < v_cur_start
    ), 0),
    'tickets_open', COALESCE((
      SELECT count(*) FROM support_tickets
      WHERE sector_id = p_sector_id AND is_active = true
      AND resolved_at IS NULL
    ), 0),
    'sla_breaches_current', COALESCE((
      SELECT count(*) FROM support_tickets
      WHERE sector_id = p_sector_id AND is_active = true
      AND created_at >= v_cur_start
      AND (sla_response_breached = true OR sla_resolve_breached = true)
    ), 0),
    -- HR: active headcount (point-in-time, no period delta).
    'headcount_active', COALESCE((
      SELECT count(*) FROM hr_employees
      WHERE sector_id = p_sector_id AND is_active = true
      AND status = 'active'
    ), 0)
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- RPC: get_analytics_trend
-- A monthly time-series for one metric over a rolling window. Used to render
-- saved-report line/bar charts. Enforces sector access.
-- =============================================
CREATE OR REPLACE FUNCTION get_analytics_trend(
  p_sector_id uuid,
  p_metric    text,
  p_range_days int DEFAULT 180
)
RETURNS json AS $$
DECLARE
  result json;
  v_days int;
  v_months int;
BEGIN
  IF NOT user_has_sector_access(p_sector_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  v_days := GREATEST(28, LEAST(COALESCE(p_range_days, 180), 3650));
  -- Number of whole months to cover (at least 1).
  v_months := GREATEST(1, (v_days / 30)) - 1;

  SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.bucket), '[]'::json)
  INTO result
  FROM (
    SELECT
      to_char(g.month, 'YYYY-MM') AS bucket,
      CASE p_metric
        WHEN 'cards_completed' THEN COALESCE((
          SELECT count(*) FROM cards c
          WHERE c.sector_id = p_sector_id AND c.is_active = true
          AND date_trunc('month', c.completed_at) = g.month
        ), 0)
        WHEN 'deals_won_value_cents' THEN COALESCE((
          SELECT round(SUM(d.value) * 100) FROM crm_deals d
          WHERE d.sector_id = p_sector_id AND d.is_active = true
          AND d.lost_reason IS NULL
          AND date_trunc('month', d.actual_close_date) = g.month
        ), 0)
        WHEN 'tickets_resolved' THEN COALESCE((
          SELECT count(*) FROM support_tickets s
          WHERE s.sector_id = p_sector_id AND s.is_active = true
          AND date_trunc('month', s.resolved_at) = g.month
        ), 0)
        ELSE 0
      END AS value
    FROM generate_series(
      date_trunc('month', CURRENT_DATE) - make_interval(months => v_months),
      date_trunc('month', CURRENT_DATE),
      interval '1 month'
    ) AS g(month)
  ) t;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
