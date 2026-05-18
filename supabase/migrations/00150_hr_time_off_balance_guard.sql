-- Migration 00150: HR time-off balance guard
-- Audit defect: negative time-off balances are shown but never prevented — a
-- request that exceeds the available balance can be created and approved.
--
-- This adds a SECURITY DEFINER RPC that returns the available balance for a
-- single employee + policy + year, so server actions (requestTimeOff /
-- approveTimeOff) can authoritatively check a request before it is written or
-- approved. The math mirrors get_employee_time_off_balance (migration 00015):
--   available = total_days - SUM(days_count) of approved+pending requests.
--
-- An optional p_exclude_request_id lets the approval path exclude the very
-- request being approved from the "pending" sum, so a request is not counted
-- against itself.
--
-- Idempotent: CREATE OR REPLACE FUNCTION.
CREATE OR REPLACE FUNCTION get_time_off_available_days(
  p_employee_id        uuid,
  p_policy_id          uuid,
  p_year               integer,
  p_exclude_request_id uuid DEFAULT NULL
)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    COALESCE(
      (SELECT b.total_days FROM hr_time_off_balances b
       WHERE b.employee_id = p_employee_id
         AND b.policy_id = p_policy_id
         AND b.year = p_year),
      0
    )::numeric
    - COALESCE(
        (SELECT SUM(r.days_count)::numeric FROM hr_time_off_requests r
         WHERE r.employee_id = p_employee_id
           AND r.policy_id = p_policy_id
           AND r.status IN ('approved', 'pending')
           AND EXTRACT(YEAR FROM r.start_date) = p_year
           AND (p_exclude_request_id IS NULL OR r.id <> p_exclude_request_id)),
        0
      )
  -- Authorize: the caller must share a sector with the policy.
  WHERE EXISTS (
    SELECT 1 FROM hr_time_off_policies p
    WHERE p.id = p_policy_id
      AND p.sector_id IN (
        SELECT sector_id FROM user_sector_roles WHERE user_id = auth.uid()
      )
  );
$$;
