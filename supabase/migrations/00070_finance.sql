-- Migration 00070: Finance module (Financeiro)
-- Invoices (AR), expenses (AP), budgets, and a cash-flow summary RPC.
-- All monetary amounts are stored as integer minor units (cents) in bigint
-- columns named *_cents — never floats / numeric.
-- Idempotent: safe to re-run.

-- =============================================
-- Module registration & enablement
-- =============================================
INSERT INTO modules (slug, name, description, icon, status, category)
VALUES (
  'finance',
  'Financeiro',
  'Contas a pagar e receber, orcamentos e fluxo de caixa',
  'DollarSign',
  'active',
  'hub'
)
ON CONFLICT (slug) DO UPDATE
  SET status = 'active',
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      icon = EXCLUDED.icon,
      category = EXCLUDED.category;

-- Enable Finance for every existing sector.
INSERT INTO sector_modules (sector_id, module_id, is_enabled)
SELECT s.id, m.id, true
FROM sectors s
CROSS JOIN modules m
WHERE m.slug = 'finance'
ON CONFLICT (sector_id, module_id) DO UPDATE SET is_enabled = true;

-- Register Finance permissions.
INSERT INTO permissions (module_id, resource, action)
SELECT m.id, r, a
FROM modules m,
     unnest(ARRAY['invoice', 'expense', 'budget', 'transaction']) AS r,
     unnest(ARRAY['create', 'read', 'update', 'delete', 'manage']) AS a
WHERE m.slug = 'finance'
ON CONFLICT (module_id, resource, action) DO NOTHING;

-- Grant all Finance permissions to admin and manager roles.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
JOIN modules m ON p.module_id = m.id
WHERE r.slug IN ('admin', 'manager')
AND m.slug = 'finance'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Grant create/read/update to analyst role.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
JOIN modules m ON p.module_id = m.id
WHERE r.slug = 'analyst'
AND p.action IN ('create', 'read', 'update')
AND m.slug = 'finance'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Grant read-only to intern role.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
JOIN modules m ON p.module_id = m.id
WHERE r.slug = 'intern'
AND p.action = 'read'
AND m.slug = 'finance'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- =============================================
-- finance_invoices — Accounts receivable
-- =============================================
CREATE TABLE IF NOT EXISTS finance_invoices (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id     uuid NOT NULL REFERENCES sectors(id),
  number        text NOT NULL,
  customer_name text NOT NULL,
  description   text,
  -- Monetary amount in integer minor units (cents). Never negative.
  amount_cents  bigint NOT NULL CHECK (amount_cents >= 0),
  currency      text NOT NULL DEFAULT 'BRL',
  status        text NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'void')),
  issue_date    date NOT NULL DEFAULT CURRENT_DATE,
  due_date      date NOT NULL,
  paid_at       timestamptz,
  created_by    uuid NOT NULL REFERENCES users(id),
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_finance_invoices_updated_at ON finance_invoices;
CREATE TRIGGER trg_finance_invoices_updated_at BEFORE UPDATE ON finance_invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- finance_expenses — Accounts payable
-- =============================================
CREATE TABLE IF NOT EXISTS finance_expenses (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id      uuid NOT NULL REFERENCES sectors(id),
  vendor_name    text NOT NULL,
  description    text,
  category       text NOT NULL DEFAULT 'other'
                 CHECK (category IN ('payroll', 'software', 'travel', 'office',
                                     'marketing', 'services', 'taxes', 'other')),
  -- Monetary amount in integer minor units (cents). Never negative.
  amount_cents   bigint NOT NULL CHECK (amount_cents >= 0),
  currency       text NOT NULL DEFAULT 'BRL',
  status         text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'paid', 'void')),
  expense_date   date NOT NULL DEFAULT CURRENT_DATE,
  paid_at        timestamptz,
  created_by     uuid NOT NULL REFERENCES users(id),
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_finance_expenses_updated_at ON finance_expenses;
CREATE TRIGGER trg_finance_expenses_updated_at BEFORE UPDATE ON finance_expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- finance_budgets — Per-category monthly budgets
-- =============================================
CREATE TABLE IF NOT EXISTS finance_budgets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id     uuid NOT NULL REFERENCES sectors(id),
  category      text NOT NULL
                CHECK (category IN ('payroll', 'software', 'travel', 'office',
                                    'marketing', 'services', 'taxes', 'other')),
  -- First day of the budgeted month (e.g. 2026-05-01).
  period_month  date NOT NULL,
  -- Planned amount for the period in integer minor units (cents).
  amount_cents  bigint NOT NULL CHECK (amount_cents >= 0),
  currency      text NOT NULL DEFAULT 'BRL',
  created_by    uuid NOT NULL REFERENCES users(id),
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  -- One budget row per category per month per sector.
  UNIQUE (sector_id, category, period_month)
);

DROP TRIGGER IF EXISTS trg_finance_budgets_updated_at ON finance_budgets;
CREATE TRIGGER trg_finance_budgets_updated_at BEFORE UPDATE ON finance_budgets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- Indexes
-- =============================================
CREATE INDEX IF NOT EXISTS idx_finance_invoices_sector_id ON finance_invoices(sector_id);
CREATE INDEX IF NOT EXISTS idx_finance_invoices_status ON finance_invoices(status);
CREATE INDEX IF NOT EXISTS idx_finance_invoices_due_date ON finance_invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_finance_expenses_sector_id ON finance_expenses(sector_id);
CREATE INDEX IF NOT EXISTS idx_finance_expenses_status ON finance_expenses(status);
CREATE INDEX IF NOT EXISTS idx_finance_expenses_category ON finance_expenses(category);
CREATE INDEX IF NOT EXISTS idx_finance_budgets_sector_id ON finance_budgets(sector_id);

-- =============================================
-- Enable RLS on all Finance tables
-- =============================================
ALTER TABLE finance_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_budgets ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS Policies — finance_invoices
-- =============================================
DROP POLICY IF EXISTS "finance_invoices_select" ON finance_invoices;
CREATE POLICY "finance_invoices_select" ON finance_invoices
  FOR SELECT TO authenticated
  USING (is_active = true AND user_has_sector_access(sector_id));

DROP POLICY IF EXISTS "finance_invoices_insert" ON finance_invoices;
CREATE POLICY "finance_invoices_insert" ON finance_invoices
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND
    user_has_permission(sector_id, 'invoice', 'create')
  );

DROP POLICY IF EXISTS "finance_invoices_update" ON finance_invoices;
CREATE POLICY "finance_invoices_update" ON finance_invoices
  FOR UPDATE TO authenticated
  USING (user_has_permission(sector_id, 'invoice', 'update'))
  WITH CHECK (user_has_permission(sector_id, 'invoice', 'update'));

DROP POLICY IF EXISTS "finance_invoices_delete" ON finance_invoices;
CREATE POLICY "finance_invoices_delete" ON finance_invoices
  FOR DELETE TO authenticated
  USING (user_has_permission(sector_id, 'invoice', 'delete'));

-- =============================================
-- RLS Policies — finance_expenses
-- =============================================
DROP POLICY IF EXISTS "finance_expenses_select" ON finance_expenses;
CREATE POLICY "finance_expenses_select" ON finance_expenses
  FOR SELECT TO authenticated
  USING (is_active = true AND user_has_sector_access(sector_id));

DROP POLICY IF EXISTS "finance_expenses_insert" ON finance_expenses;
CREATE POLICY "finance_expenses_insert" ON finance_expenses
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND
    user_has_permission(sector_id, 'expense', 'create')
  );

DROP POLICY IF EXISTS "finance_expenses_update" ON finance_expenses;
CREATE POLICY "finance_expenses_update" ON finance_expenses
  FOR UPDATE TO authenticated
  USING (user_has_permission(sector_id, 'expense', 'update'))
  WITH CHECK (user_has_permission(sector_id, 'expense', 'update'));

DROP POLICY IF EXISTS "finance_expenses_delete" ON finance_expenses;
CREATE POLICY "finance_expenses_delete" ON finance_expenses
  FOR DELETE TO authenticated
  USING (user_has_permission(sector_id, 'expense', 'delete'));

-- =============================================
-- RLS Policies — finance_budgets
-- =============================================
DROP POLICY IF EXISTS "finance_budgets_select" ON finance_budgets;
CREATE POLICY "finance_budgets_select" ON finance_budgets
  FOR SELECT TO authenticated
  USING (is_active = true AND user_has_sector_access(sector_id));

DROP POLICY IF EXISTS "finance_budgets_insert" ON finance_budgets;
CREATE POLICY "finance_budgets_insert" ON finance_budgets
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND
    user_has_permission(sector_id, 'budget', 'create')
  );

DROP POLICY IF EXISTS "finance_budgets_update" ON finance_budgets;
CREATE POLICY "finance_budgets_update" ON finance_budgets
  FOR UPDATE TO authenticated
  USING (user_has_permission(sector_id, 'budget', 'update'))
  WITH CHECK (user_has_permission(sector_id, 'budget', 'update'));

DROP POLICY IF EXISTS "finance_budgets_delete" ON finance_budgets;
CREATE POLICY "finance_budgets_delete" ON finance_budgets
  FOR DELETE TO authenticated
  USING (user_has_permission(sector_id, 'budget', 'delete'));

-- =============================================
-- RPC: get_finance_summary
-- Cash-flow KPIs + 6-month inflow/outflow series for a sector.
-- All amounts returned as integer cents.
-- =============================================
CREATE OR REPLACE FUNCTION get_finance_summary(p_sector_id uuid)
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  IF NOT user_has_sector_access(p_sector_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT json_build_object(
    'total_income_cents', COALESCE((
      SELECT SUM(amount_cents) FROM finance_invoices
      WHERE sector_id = p_sector_id AND is_active = true AND status = 'paid'
    ), 0),
    'total_expense_cents', COALESCE((
      SELECT SUM(amount_cents) FROM finance_expenses
      WHERE sector_id = p_sector_id AND is_active = true AND status = 'paid'
    ), 0),
    'outstanding_ar_cents', COALESCE((
      SELECT SUM(amount_cents) FROM finance_invoices
      WHERE sector_id = p_sector_id AND is_active = true
      AND status IN ('sent', 'overdue')
    ), 0),
    'outstanding_ap_cents', COALESCE((
      SELECT SUM(amount_cents) FROM finance_expenses
      WHERE sector_id = p_sector_id AND is_active = true AND status = 'pending'
    ), 0),
    'overdue_invoice_count', (
      SELECT COUNT(*) FROM finance_invoices
      WHERE sector_id = p_sector_id AND is_active = true
      AND status IN ('sent', 'overdue') AND due_date < CURRENT_DATE
    ),
    'cash_flow', (
      SELECT COALESCE(json_agg(row_to_json(m) ORDER BY m.month), '[]'::json)
      FROM (
        SELECT
          to_char(g.month, 'YYYY-MM') AS month,
          COALESCE((
            SELECT SUM(i.amount_cents) FROM finance_invoices i
            WHERE i.sector_id = p_sector_id AND i.is_active = true
            AND i.status = 'paid'
            AND date_trunc('month', i.paid_at) = g.month
          ), 0) AS income_cents,
          COALESCE((
            SELECT SUM(e.amount_cents) FROM finance_expenses e
            WHERE e.sector_id = p_sector_id AND e.is_active = true
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
