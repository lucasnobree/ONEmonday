-- Migration 00149: HR headcount & turnover analytics
-- Adds a SECURITY DEFINER RPC the dashboard calls to render a headcount /
-- turnover widget. Mirrors get_expiring_hr_documents (migration 00030):
-- SECURITY DEFINER with an explicit user_sector_roles membership check so a
-- caller can only ever read analytics for a sector they belong to.
--
-- Idempotent: CREATE OR REPLACE FUNCTION.

-- Headcount & turnover metrics for the trailing N months of a sector.
--
--  * current_headcount  — active, non-terminated employees right now
--  * hires_in_window    — employees whose hire_date falls in the window
--  * exits_in_window    — employees whose termination_date falls in the window
--  * turnover_rate      — exits / average headcount, as a 0-100 percentage,
--                         where average headcount = (start + end) / 2.
--                         A standard period-turnover formula; returns 0 when
--                         the average is 0 to avoid a divide-by-zero.
--  * net_change         — hires minus exits in the window
--  * window_months      — echoes the requested window for the caller
CREATE OR REPLACE FUNCTION get_hr_headcount_analytics(
  p_sector_id    uuid,
  p_window_months integer DEFAULT 12
)
RETURNS TABLE (
  current_headcount integer,
  hires_in_window   integer,
  exits_in_window   integer,
  turnover_rate     numeric,
  net_change        integer,
  window_months     integer
) LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_window_start date := CURRENT_DATE - (GREATEST(p_window_months, 1) || ' months')::interval;
  v_current      integer;
  v_hires        integer;
  v_exits        integer;
  v_start_count  integer;
  v_avg          numeric;
BEGIN
  -- Authorize: caller must belong to the sector (or be a global admin).
  IF NOT (
    EXISTS (SELECT 1 FROM user_sector_roles usr
            WHERE usr.user_id = auth.uid() AND usr.sector_id = p_sector_id)
    OR EXISTS (SELECT 1 FROM users u
               WHERE u.id = auth.uid() AND u.is_global_admin = true)
  ) THEN
    RETURN;
  END IF;

  SELECT count(*) INTO v_current
  FROM hr_employees e
  WHERE e.sector_id = p_sector_id
    AND e.status <> 'terminated'
    AND e.is_active = true;

  SELECT count(*) INTO v_hires
  FROM hr_employees e
  WHERE e.sector_id = p_sector_id
    AND e.hire_date >= v_window_start
    AND e.hire_date <= CURRENT_DATE;

  SELECT count(*) INTO v_exits
  FROM hr_employees e
  WHERE e.sector_id = p_sector_id
    AND e.status = 'terminated'
    AND e.termination_date IS NOT NULL
    AND e.termination_date >= v_window_start
    AND e.termination_date <= CURRENT_DATE;

  -- Headcount at the start of the window = people who were already hired by
  -- then and had not yet left by then.
  SELECT count(*) INTO v_start_count
  FROM hr_employees e
  WHERE e.sector_id = p_sector_id
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
