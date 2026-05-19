-- Migration 00215: HR dashboards — cross-sector aggregate mode
--
-- See migration 00209 for the rationale. Recreates the two HR dashboard RPCs
-- with a nullable `p_sector_id`: NULL means "every sector".
--
--   * get_hr_headcount_analytics — the all-sectors aggregate is admin-only;
--     a non-admin asking for "all" gets an empty result (the function's
--     existing fail-closed style is to RETURN with no rows). A concrete id
--     keeps the per-sector role/admin check unchanged.
--   * get_expiring_hr_documents — rewritten from a plain SQL function to a
--     plpgsql one so the all-sectors path can be admin-gated. The per-sector
--     path keeps the original `user_sector_roles` membership filter.
--
-- SECURITY DEFINER with a pinned search_path. Idempotent.

CREATE OR REPLACE FUNCTION get_hr_headcount_analytics(
  p_sector_id     uuid DEFAULT NULL,
  p_window_months integer DEFAULT 12
)
RETURNS TABLE (
  current_headcount integer,
  hires_in_window   integer,
  exits_in_window   integer,
  turnover_rate     numeric,
  net_change        integer,
  window_months     integer
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_window_start date := CURRENT_DATE - (GREATEST(p_window_months, 1) || ' months')::interval;
  v_current      integer;
  v_hires        integer;
  v_exits        integer;
  v_start_count  integer;
  v_avg          numeric;
BEGIN
  -- Authorize: a concrete sector needs sector membership or global admin;
  -- the all-sectors aggregate (NULL) is admin-only. Fail closed by returning
  -- no rows (the caller renders the empty metric set).
  IF p_sector_id IS NULL THEN
    IF NOT is_global_admin() THEN
      RETURN;
    END IF;
  ELSIF NOT (
    EXISTS (SELECT 1 FROM user_sector_roles usr
            WHERE usr.user_id = auth.uid() AND usr.sector_id = p_sector_id)
    OR is_global_admin()
  ) THEN
    RETURN;
  END IF;

  SELECT count(*) INTO v_current
  FROM hr_employees e
  WHERE (p_sector_id IS NULL OR e.sector_id = p_sector_id)
    AND e.status <> 'terminated'
    AND e.is_active = true;

  SELECT count(*) INTO v_hires
  FROM hr_employees e
  WHERE (p_sector_id IS NULL OR e.sector_id = p_sector_id)
    AND e.hire_date >= v_window_start
    AND e.hire_date <= CURRENT_DATE;

  SELECT count(*) INTO v_exits
  FROM hr_employees e
  WHERE (p_sector_id IS NULL OR e.sector_id = p_sector_id)
    AND e.status = 'terminated'
    AND e.termination_date IS NOT NULL
    AND e.termination_date >= v_window_start
    AND e.termination_date <= CURRENT_DATE;

  -- Headcount at the start of the window = people who were already hired by
  -- then and had not yet left by then.
  SELECT count(*) INTO v_start_count
  FROM hr_employees e
  WHERE (p_sector_id IS NULL OR e.sector_id = p_sector_id)
    AND e.hire_date < v_window_start
    AND (
      e.termination_date IS NULL
      OR e.termination_date >= v_window_start
    );

  v_avg := (v_start_count + v_current)::numeric / 2;

  current_headcount := v_current;
  hires_in_window   := v_hires;
  exits_in_window   := v_exits;
  turnover_rate     := CASE
                         WHEN v_avg > 0
                           THEN round((v_exits::numeric / v_avg) * 100, 1)
                         ELSE 0
                       END;
  net_change        := v_hires - v_exits;
  window_months     := GREATEST(p_window_months, 1);
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION get_expiring_hr_documents(
  p_sector_id   uuid DEFAULT NULL,
  p_within_days integer DEFAULT 30
)
RETURNS TABLE (
  id uuid,
  employee_id uuid,
  employee_name text,
  name text,
  category text,
  expiry_date date,
  days_until_expiry integer
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- The all-sectors aggregate (NULL) is admin-only; fail closed with an
  -- empty list for a non-admin caller.
  IF p_sector_id IS NULL AND NOT is_global_admin() THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    d.id,
    d.employee_id,
    e.full_name,
    d.name,
    d.category,
    d.expiry_date,
    (d.expiry_date - CURRENT_DATE)::integer
  FROM hr_employee_documents d
  JOIN hr_employees e ON e.id = d.employee_id
  WHERE (p_sector_id IS NULL OR d.sector_id = p_sector_id)
    AND d.expiry_date IS NOT NULL
    AND d.expiry_date <= CURRENT_DATE + (p_within_days || ' days')::interval
    -- Per-sector path: keep the sector-membership filter. The all-sectors
    -- path is already admin-gated above, so skip the per-row filter then.
    AND (
      p_sector_id IS NULL
      OR d.sector_id IN (
        SELECT sector_id FROM user_sector_roles WHERE user_id = auth.uid()
      )
    )
  ORDER BY d.expiry_date ASC;
END;
$$;
