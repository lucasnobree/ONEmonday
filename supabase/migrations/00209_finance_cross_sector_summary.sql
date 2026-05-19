-- Migration 00209: Finance dashboard — cross-sector aggregate mode
--
-- Nav phase 2b added an on-screen sector filter; when an admin picks "Todos"
-- (all sectors) the dashboard hook passed no sector and the KPI strip went
-- empty. This recreates `get_finance_summary` with an all-sectors mode:
--   * `p_sector_id` is now nullable. A concrete id behaves exactly as before
--     (per-sector access check via `user_has_sector_access`).
--   * `p_sector_id IS NULL` means "every sector" and is gated to global
--     admins (`is_global_admin()`); a non-admin asking for all sectors gets
--     an "Access denied" error rather than a cross-tenant leak.
--
-- SECURITY DEFINER with a pinned search_path (migration 00180 discipline).
-- Idempotent: CREATE OR REPLACE FUNCTION; safe to re-run.

CREATE OR REPLACE FUNCTION get_finance_summary(p_sector_id uuid DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  result json;
BEGIN
  -- Access boundary: a concrete sector needs per-sector access; the
  -- all-sectors aggregate (NULL) is admin-only.
  IF p_sector_id IS NULL THEN
    IF NOT is_global_admin() THEN
      RAISE EXCEPTION 'Access denied';
    END IF;
  ELSIF NOT user_has_sector_access(p_sector_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT json_build_object(
    'total_income_cents', COALESCE((
      SELECT SUM(amount_cents) FROM finance_invoices
      WHERE (p_sector_id IS NULL OR sector_id = p_sector_id)
      AND is_active = true AND status = 'paid'
    ), 0),
    'total_expense_cents', COALESCE((
      SELECT SUM(amount_cents) FROM finance_expenses
      WHERE (p_sector_id IS NULL OR sector_id = p_sector_id)
      AND is_active = true AND status = 'paid'
    ), 0),
    'outstanding_ar_cents', COALESCE((
      SELECT SUM(amount_cents) FROM finance_invoices
      WHERE (p_sector_id IS NULL OR sector_id = p_sector_id)
      AND is_active = true
      AND status IN ('sent', 'overdue')
    ), 0),
    'outstanding_ap_cents', COALESCE((
      SELECT SUM(amount_cents) FROM finance_expenses
      WHERE (p_sector_id IS NULL OR sector_id = p_sector_id)
      AND is_active = true AND status = 'pending'
    ), 0),
    'overdue_invoice_count', (
      SELECT COUNT(*) FROM finance_invoices
      WHERE (p_sector_id IS NULL OR sector_id = p_sector_id)
      AND is_active = true
      AND status IN ('sent', 'overdue') AND due_date < CURRENT_DATE
    ),
    'cash_flow', (
      SELECT COALESCE(json_agg(row_to_json(m) ORDER BY m.month), '[]'::json)
      FROM (
        SELECT
          to_char(g.month, 'YYYY-MM') AS month,
          COALESCE((
            SELECT SUM(i.amount_cents) FROM finance_invoices i
            WHERE (p_sector_id IS NULL OR i.sector_id = p_sector_id)
            AND i.is_active = true
            AND i.status = 'paid'
            AND date_trunc('month', i.paid_at) = g.month
          ), 0) AS income_cents,
          COALESCE((
            SELECT SUM(e.amount_cents) FROM finance_expenses e
            WHERE (p_sector_id IS NULL OR e.sector_id = p_sector_id)
            AND e.is_active = true
            AND e.status = 'paid'
            AND date_trunc('month', e.paid_at) = g.month
          ), 0) AS expense_cents
        FROM generate_series(
          date_trunc('month', CURRENT_DATE) - interval '5 months',
          date_trunc('month', CURRENT_DATE),
          interval '1 month'
        ) AS g(month)
      ) m
    )
  ) INTO result;

  RETURN result;
END;
$$;
