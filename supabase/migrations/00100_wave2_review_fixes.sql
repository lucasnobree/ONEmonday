-- =============================================
-- Migration 00100: Wave 2 senior-review fixes
-- Replaces two RPCs flagged in pre-merge review:
--   * get_analytics_trend  — bucket math collapsed a default (30-day) report
--     to a single point; now derives whole months from the window and never
--     produces fewer than 3 buckets.
--   * get_legal_dashboard_stats — SECURITY DEFINER function that never
--     checked sector access (cross-tenant leak); now guards like the Finance
--     RPC, and both functions pin search_path.
-- Idempotent: CREATE OR REPLACE, safe to re-run.
-- =============================================

-- ---------------------------------------------
-- Analytics: monthly metric trend
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION get_analytics_trend(
  p_sector_id uuid,
  p_metric    text,
  p_range_days int DEFAULT 180
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  result json;
  v_days int;
  v_months int;
BEGIN
  IF NOT user_has_sector_access(p_sector_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  v_days := GREATEST(28, LEAST(COALESCE(p_range_days, 180), 3650));
  -- Whole months the window spans; clamped to >= 3 so a trend chart always
  -- has enough points to be meaningful (a 30-day report no longer collapses
  -- to a single bucket).
  v_months := GREATEST(3, CEIL(v_days::numeric / 30)::int);

  SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.bucket), '[]'::json)
  INTO result
  FROM (
    SELECT
      to_char(g.month, 'YYYY-MM') AS bucket,
      CASE p_metric
        WHEN 'cards_completed' THEN COALESCE((
          SELECT count(*) FROM cards c
          WHERE c.sector_id = p_sector_id AND c.is_active = true
          AND c.completed_at IS NOT NULL
          AND date_trunc('month', c.completed_at) = g.month
        ), 0)
        WHEN 'deals_won_value_cents' THEN COALESCE((
          SELECT round(SUM(d.value) * 100) FROM crm_deals d
          WHERE d.sector_id = p_sector_id AND d.is_active = true
          AND d.lost_reason IS NULL
          AND d.actual_close_date IS NOT NULL
          AND date_trunc('month', d.actual_close_date) = g.month
        ), 0)
        WHEN 'tickets_resolved' THEN COALESCE((
          SELECT count(*) FROM support_tickets s
          WHERE s.sector_id = p_sector_id AND s.is_active = true
          AND s.resolved_at IS NOT NULL
          AND date_trunc('month', s.resolved_at) = g.month
        ), 0)
        ELSE 0
      END AS value
    FROM generate_series(
      date_trunc('month', CURRENT_DATE)
        - make_interval(months => v_months - 1),
      date_trunc('month', CURRENT_DATE),
      interval '1 month'
    ) AS g(month)
  ) t;

  RETURN result;
END;
$$;

-- ---------------------------------------------
-- Legal: dashboard stats
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION get_legal_dashboard_stats(p_sector_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_active_contracts   int;
  v_expiring_30        int;
  v_open_matters       int;
  v_draft_contracts    int;
BEGIN
  -- SECURITY DEFINER bypasses RLS, so the sector must be checked explicitly.
  IF NOT user_has_sector_access(p_sector_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT count(*) INTO v_active_contracts
  FROM legal_contracts
  WHERE sector_id = p_sector_id AND status = 'active' AND is_active = true;

  SELECT count(*) INTO v_expiring_30
  FROM legal_contracts
  WHERE sector_id = p_sector_id
    AND is_active = true
    AND status IN ('active', 'approved')
    AND expiry_date IS NOT NULL
    AND expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + interval '30 days';

  SELECT count(*) INTO v_open_matters
  FROM legal_matters
  WHERE sector_id = p_sector_id
    AND is_active = true
    AND status IN ('open', 'in_progress', 'blocked');

  SELECT count(*) INTO v_draft_contracts
  FROM legal_contracts
  WHERE sector_id = p_sector_id
    AND is_active = true
    AND status IN ('draft', 'in_review');

  RETURN json_build_object(
    'active_contracts', v_active_contracts,
    'expiring_30',      v_expiring_30,
    'open_matters',     v_open_matters,
    'draft_contracts',  v_draft_contracts
  );
END;
$$;
