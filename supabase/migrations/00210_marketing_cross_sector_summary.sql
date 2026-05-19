-- Migration 00210: Marketing dashboard — cross-sector aggregate mode
--
-- See migration 00209 for the rationale. Recreates `get_marketing_summary`
-- with a nullable `p_sector_id`: NULL means "every sector" and is gated to
-- global admins; a concrete id keeps the existing per-sector access check.
--
-- SECURITY DEFINER with a pinned search_path. Idempotent.

CREATE OR REPLACE FUNCTION get_marketing_summary(p_sector_id uuid DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  result json;
BEGIN
  IF p_sector_id IS NULL THEN
    IF NOT is_global_admin() THEN
      RAISE EXCEPTION 'Access denied';
    END IF;
  ELSIF NOT user_has_sector_access(p_sector_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT json_build_object(
    'active_campaigns', (
      SELECT COUNT(*) FROM marketing_campaigns
      WHERE (p_sector_id IS NULL OR sector_id = p_sector_id)
      AND is_active = true
      AND status = 'active'
    ),
    'total_campaigns', (
      SELECT COUNT(*) FROM marketing_campaigns
      WHERE (p_sector_id IS NULL OR sector_id = p_sector_id)
      AND is_active = true
    ),
    'total_budget_cents', COALESCE((
      SELECT SUM(budget_cents) FROM marketing_campaigns
      WHERE (p_sector_id IS NULL OR sector_id = p_sector_id)
      AND is_active = true
    ), 0),
    'total_spend_cents', COALESCE((
      SELECT SUM(spend_cents) FROM marketing_campaigns
      WHERE (p_sector_id IS NULL OR sector_id = p_sector_id)
      AND is_active = true
    ), 0),
    'total_leads', COALESCE((
      SELECT SUM(leads) FROM marketing_campaigns
      WHERE (p_sector_id IS NULL OR sector_id = p_sector_id)
      AND is_active = true
    ), 0),
    'total_conversions', COALESCE((
      SELECT SUM(conversions) FROM marketing_campaigns
      WHERE (p_sector_id IS NULL OR sector_id = p_sector_id)
      AND is_active = true
    ), 0),
    'total_impressions', COALESCE((
      SELECT SUM(impressions) FROM marketing_campaigns
      WHERE (p_sector_id IS NULL OR sector_id = p_sector_id)
      AND is_active = true
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
        WHERE (p_sector_id IS NULL OR sector_id = p_sector_id)
        AND is_active = true
        GROUP BY channel
      ) c
    )
  ) INTO result;

  RETURN result;
END;
$$;
