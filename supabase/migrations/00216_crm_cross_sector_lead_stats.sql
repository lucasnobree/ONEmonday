-- Migration 00216: CRM lead dashboards — cross-sector aggregate mode
--
-- See migration 00209 for the rationale. Recreates the two CRM lead-inbox
-- RPCs with a nullable `p_sector_id`: NULL means "every sector" and is gated
-- to global admins; a concrete id keeps the existing per-sector access check.
--
--   * get_crm_lead_stats — plain count aggregation, trivially cross-sector.
--   * get_crm_lead_aging — each sector has its own `crm_lead_sla_hours`.
--     Under the all-sectors aggregate there is no single SLA window, so
--     `sla_hours` is reported as 0 and `overdue` is summed by joining each
--     lead to *its own* sector's SLA. The per-sector path is unchanged.
--
-- SECURITY DEFINER with a pinned search_path. Idempotent.

CREATE OR REPLACE FUNCTION get_crm_lead_stats(p_sector_id uuid DEFAULT NULL)
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
    'total', (
      SELECT COUNT(*) FROM crm_leads
      WHERE (p_sector_id IS NULL OR sector_id = p_sector_id) AND is_active = true
    ),
    'new', (
      SELECT COUNT(*) FROM crm_leads
      WHERE (p_sector_id IS NULL OR sector_id = p_sector_id)
        AND is_active = true AND status = 'new'
    ),
    'working', (
      SELECT COUNT(*) FROM crm_leads
      WHERE (p_sector_id IS NULL OR sector_id = p_sector_id)
        AND is_active = true AND status = 'working'
    ),
    'qualified', (
      SELECT COUNT(*) FROM crm_leads
      WHERE (p_sector_id IS NULL OR sector_id = p_sector_id)
        AND is_active = true AND status = 'qualified'
    ),
    'discarded', (
      SELECT COUNT(*) FROM crm_leads
      WHERE (p_sector_id IS NULL OR sector_id = p_sector_id)
        AND is_active = true AND status = 'discarded'
    ),
    'avg_score', COALESCE((
      SELECT ROUND(AVG(score), 1) FROM crm_leads
      WHERE (p_sector_id IS NULL OR sector_id = p_sector_id) AND is_active = true
    ), 0)
  ) INTO result;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION get_crm_lead_aging(p_sector_id uuid DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sla_hours int;
  result json;
BEGIN
  IF p_sector_id IS NULL THEN
    IF NOT is_global_admin() THEN
      RAISE EXCEPTION 'Access denied';
    END IF;
  ELSIF NOT user_has_sector_access(p_sector_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF p_sector_id IS NOT NULL THEN
    SELECT crm_lead_sla_hours INTO v_sla_hours
    FROM sectors WHERE id = p_sector_id;
  END IF;

  SELECT json_build_object(
    -- A single SLA window only makes sense for one sector; the all-sectors
    -- aggregate reports 0 (the aging indicator's "off" value).
    'sla_hours', COALESCE(v_sla_hours, 0),
    'untouched', (
      SELECT COUNT(*) FROM crm_leads
      WHERE (p_sector_id IS NULL OR sector_id = p_sector_id)
        AND is_active = true
        AND status = 'new'
    ),
    'overdue', (
      SELECT COUNT(*)
      FROM crm_leads l
      JOIN sectors s ON s.id = l.sector_id
      WHERE (p_sector_id IS NULL OR l.sector_id = p_sector_id)
        AND l.is_active = true
        AND l.status = 'new'
        AND COALESCE(s.crm_lead_sla_hours, 0) > 0
        AND l.created_at < now() - make_interval(hours => s.crm_lead_sla_hours)
    )
  ) INTO result;

  RETURN result;
END;
$$;
