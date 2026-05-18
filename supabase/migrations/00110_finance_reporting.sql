-- Migration 00110: Finance reporting — internal financial management.
-- Phase 4 of the total-migration roadmap (docs/research/migration-architecture.md
-- §2.9 "Internal financial management — Native"; migration-contabilidade.md
-- backlog #3, #5, #7, #14).
--
-- Adds:
--   * `finance_expenses.due_date` — payables can now be scheduled, which is the
--     prerequisite for an AP (accounts-payable) aging report (audit finding E7).
--   * `get_finance_dre`  — a management DRE / P&L grouped by category over a
--     period. NOT the official Demonstração de Resultado filed with the books —
--     that stays with the accountant (migration-contabilidade.md §5.2).
--   * `get_finance_aging` — AR/AP aging snapshot bucketed 0-30/31-60/61-90/90+.
--
-- All amounts are integer cents. Idempotent: safe to re-run.

-- =============================================
-- finance_expenses.due_date — schedulable payables
-- =============================================
-- Nullable so existing rows stay valid; defaults to expense_date for new rows
-- where the form does not yet send one. AP aging treats a NULL due_date as
-- equal to expense_date (see get_finance_aging below).
ALTER TABLE finance_expenses
  ADD COLUMN IF NOT EXISTS due_date date;

CREATE INDEX IF NOT EXISTS idx_finance_expenses_due_date
  ON finance_expenses(due_date);

-- =============================================
-- RPC: get_finance_dre
-- Management P&L for a sector over [p_from, p_to] (inclusive, date-only).
-- Revenue = paid invoices by paid_at; cost = paid expenses by category.
-- Returns integer cents. Cash-basis (recognises paid items) to match the
-- existing get_finance_summary semantics.
-- =============================================
CREATE OR REPLACE FUNCTION get_finance_dre(
  p_sector_id uuid,
  p_from date,
  p_to date
)
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  IF NOT user_has_sector_access(p_sector_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT json_build_object(
    'revenue_cents', COALESCE((
      SELECT SUM(amount_cents) FROM finance_invoices
      WHERE sector_id = p_sector_id AND is_active = true AND status = 'paid'
        AND paid_at IS NOT NULL
        AND (paid_at AT TIME ZONE 'UTC')::date BETWEEN p_from AND p_to
    ), 0),
    'expense_total_cents', COALESCE((
      SELECT SUM(amount_cents) FROM finance_expenses
      WHERE sector_id = p_sector_id AND is_active = true AND status = 'paid'
        AND paid_at IS NOT NULL
        AND (paid_at AT TIME ZONE 'UTC')::date BETWEEN p_from AND p_to
    ), 0),
    'expense_by_category', (
      SELECT COALESCE(json_agg(row_to_json(c) ORDER BY c.category), '[]'::json)
      FROM (
        SELECT category, SUM(amount_cents) AS amount_cents
        FROM finance_expenses
        WHERE sector_id = p_sector_id AND is_active = true AND status = 'paid'
          AND paid_at IS NOT NULL
          AND (paid_at AT TIME ZONE 'UTC')::date BETWEEN p_from AND p_to
        GROUP BY category
      ) c
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- RPC: get_finance_aging
-- AR/AP aging snapshot as of p_as_of. Returns one row per open invoice /
-- expense with the days overdue, so the app can bucket client-side and drill
-- down per customer/vendor. Open AR = sent/overdue; open AP = pending.
-- =============================================
CREATE OR REPLACE FUNCTION get_finance_aging(
  p_sector_id uuid,
  p_as_of date DEFAULT CURRENT_DATE
)
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  IF NOT user_has_sector_access(p_sector_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT json_build_object(
    'as_of', p_as_of,
    'receivables', (
      SELECT COALESCE(json_agg(row_to_json(r) ORDER BY r.due_date), '[]'::json)
      FROM (
        SELECT
          id,
          number,
          customer_name AS party_name,
          amount_cents,
          due_date,
          (p_as_of - due_date) AS days_overdue
        FROM finance_invoices
        WHERE sector_id = p_sector_id AND is_active = true
          AND status IN ('sent', 'overdue')
      ) r
    ),
    'payables', (
      SELECT COALESCE(json_agg(row_to_json(p) ORDER BY p.due_date), '[]'::json)
      FROM (
        SELECT
          id,
          vendor_name AS party_name,
          amount_cents,
          COALESCE(due_date, expense_date) AS due_date,
          (p_as_of - COALESCE(due_date, expense_date)) AS days_overdue
        FROM finance_expenses
        WHERE sector_id = p_sector_id AND is_active = true
          AND status = 'pending'
      ) p
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
