-- Migration 00211: Analytics overview — cross-sector aggregate mode
--
-- See migration 00209 for the rationale. Recreates `get_analytics_overview`
-- with a nullable `p_sector_id`: NULL means "every sector" and is gated to
-- global admins; a concrete id keeps the existing per-sector access check.
--
-- SECURITY DEFINER with a pinned search_path. Idempotent.

CREATE OR REPLACE FUNCTION get_analytics_overview(
  p_sector_id uuid DEFAULT NULL,
  p_range_days int DEFAULT 30
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  result json;
  v_days int;
  v_cur_start timestamptz;
  v_prev_start timestamptz;
BEGIN
  IF p_sector_id IS NULL THEN
    IF NOT is_global_admin() THEN
      RAISE EXCEPTION 'Access denied';
    END IF;
  ELSIF NOT user_has_sector_access(p_sector_id) THEN
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
      WHERE (p_sector_id IS NULL OR sector_id = p_sector_id) AND is_active = true
      AND completed_at >= v_cur_start
    ), 0),
    'cards_completed_previous', COALESCE((
      SELECT count(*) FROM cards
      WHERE (p_sector_id IS NULL OR sector_id = p_sector_id) AND is_active = true
      AND completed_at >= v_prev_start AND completed_at < v_cur_start
    ), 0),
    'cards_open', COALESCE((
      SELECT count(*) FROM cards
      WHERE (p_sector_id IS NULL OR sector_id = p_sector_id) AND is_active = true
      AND completed_at IS NULL
    ), 0),
    -- CRM: won deal value (numeric major units -> integer cents).
    'deals_won_value_cents_current', COALESCE((
      SELECT round(SUM(value) * 100) FROM crm_deals
      WHERE (p_sector_id IS NULL OR sector_id = p_sector_id) AND is_active = true
      AND actual_close_date IS NOT NULL AND lost_reason IS NULL
      AND actual_close_date >= v_cur_start::date
    ), 0),
    'deals_won_value_cents_previous', COALESCE((
      SELECT round(SUM(value) * 100) FROM crm_deals
      WHERE (p_sector_id IS NULL OR sector_id = p_sector_id) AND is_active = true
      AND actual_close_date IS NOT NULL AND lost_reason IS NULL
      AND actual_close_date >= v_prev_start::date
      AND actual_close_date < v_cur_start::date
    ), 0),
    'deals_open', COALESCE((
      SELECT count(*) FROM crm_deals
      WHERE (p_sector_id IS NULL OR sector_id = p_sector_id) AND is_active = true
      AND actual_close_date IS NULL
    ), 0),
    -- Support: resolved tickets + SLA breaches.
    'tickets_resolved_current', COALESCE((
      SELECT count(*) FROM support_tickets
      WHERE (p_sector_id IS NULL OR sector_id = p_sector_id) AND is_active = true
      AND resolved_at >= v_cur_start
    ), 0),
    'tickets_resolved_previous', COALESCE((
      SELECT count(*) FROM support_tickets
      WHERE (p_sector_id IS NULL OR sector_id = p_sector_id) AND is_active = true
      AND resolved_at >= v_prev_start AND resolved_at < v_cur_start
    ), 0),
    'tickets_open', COALESCE((
      SELECT count(*) FROM support_tickets
      WHERE (p_sector_id IS NULL OR sector_id = p_sector_id) AND is_active = true
      AND resolved_at IS NULL
    ), 0),
    'sla_breaches_current', COALESCE((
      SELECT count(*) FROM support_tickets
      WHERE (p_sector_id IS NULL OR sector_id = p_sector_id) AND is_active = true
      AND created_at >= v_cur_start
      AND (sla_response_breached = true OR sla_resolve_breached = true)
    ), 0),
    -- HR: active headcount (point-in-time, no period delta).
    'headcount_active', COALESCE((
      SELECT count(*) FROM hr_employees
      WHERE (p_sector_id IS NULL OR sector_id = p_sector_id) AND is_active = true
      AND status = 'active'
    ), 0)
  ) INTO result;

  RETURN result;
END;
$$;
