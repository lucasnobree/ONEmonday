-- Migration 00212: Legal dashboard — cross-sector aggregate mode
--
-- See migration 00209 for the rationale. Recreates `get_legal_dashboard_stats`
-- with a nullable `p_sector_id`: NULL means "every sector" and is gated to
-- global admins; a concrete id keeps the existing per-sector access check.
--
-- SECURITY DEFINER with a pinned search_path. Idempotent.

CREATE OR REPLACE FUNCTION get_legal_dashboard_stats(p_sector_id uuid DEFAULT NULL)
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
  -- SECURITY DEFINER bypasses RLS, so the scope must be checked explicitly.
  IF p_sector_id IS NULL THEN
    IF NOT is_global_admin() THEN
      RAISE EXCEPTION 'Access denied';
    END IF;
  ELSIF NOT user_has_sector_access(p_sector_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT count(*) INTO v_active_contracts
  FROM legal_contracts
  WHERE (p_sector_id IS NULL OR sector_id = p_sector_id)
    AND status = 'active' AND is_active = true;

  SELECT count(*) INTO v_expiring_30
  FROM legal_contracts
  WHERE (p_sector_id IS NULL OR sector_id = p_sector_id)
    AND is_active = true
    AND status IN ('active', 'approved')
    AND expiry_date IS NOT NULL
    AND expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + interval '30 days';

  SELECT count(*) INTO v_open_matters
  FROM legal_matters
  WHERE (p_sector_id IS NULL OR sector_id = p_sector_id)
    AND is_active = true
    AND status IN ('open', 'in_progress', 'blocked');

  SELECT count(*) INTO v_draft_contracts
  FROM legal_contracts
  WHERE (p_sector_id IS NULL OR sector_id = p_sector_id)
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
