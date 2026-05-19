-- Migration 00213: Dev-Tools dashboard — cross-sector aggregate mode
--
-- See migration 00209 for the rationale. Recreates
-- `get_dev_tools_dashboard_stats` with a nullable `p_sector_id`: NULL means
-- "every sector" and is gated to global admins; a concrete id is checked with
-- `user_has_sector_access`.
--
-- This also closes a pre-existing gap: the original function (00060) did no
-- access check at all and relied on SECURITY DEFINER bypassing RLS — any
-- authenticated user could read another sector's incident counts by guessing
-- a sector id. The per-sector path now enforces `user_has_sector_access`.
--
-- SECURITY DEFINER with a pinned search_path. Idempotent.

CREATE OR REPLACE FUNCTION get_dev_tools_dashboard_stats(p_sector_id uuid DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_open_incidents     int;
  v_sev1_open          int;
  v_services_down      int;
  v_deploys_7d         int;
  v_active_flags       int;
BEGIN
  IF p_sector_id IS NULL THEN
    IF NOT is_global_admin() THEN
      RAISE EXCEPTION 'Access denied';
    END IF;
  ELSIF NOT user_has_sector_access(p_sector_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT count(*) INTO v_open_incidents
  FROM dev_incidents
  WHERE (p_sector_id IS NULL OR sector_id = p_sector_id)
    AND is_active = true AND status <> 'resolved';

  SELECT count(*) INTO v_sev1_open
  FROM dev_incidents
  WHERE (p_sector_id IS NULL OR sector_id = p_sector_id)
    AND is_active = true
    AND status <> 'resolved'
    AND severity = 'sev1';

  SELECT count(*) INTO v_services_down
  FROM dev_services
  WHERE (p_sector_id IS NULL OR sector_id = p_sector_id)
    AND is_active = true
    AND health IN ('partial_outage', 'major_outage');

  SELECT count(*) INTO v_deploys_7d
  FROM dev_deployments
  WHERE (p_sector_id IS NULL OR sector_id = p_sector_id)
    AND deployed_at >= now() - interval '7 days';

  SELECT count(*) INTO v_active_flags
  FROM dev_feature_flags
  WHERE (p_sector_id IS NULL OR sector_id = p_sector_id)
    AND is_active = true
    AND is_enabled = true;

  RETURN json_build_object(
    'open_incidents', v_open_incidents,
    'sev1_open',      v_sev1_open,
    'services_down',  v_services_down,
    'deploys_7d',     v_deploys_7d,
    'active_flags',   v_active_flags
  );
END;
$$;
