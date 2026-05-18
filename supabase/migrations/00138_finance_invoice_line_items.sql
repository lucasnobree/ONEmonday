-- Migration 00138: Invoice line items (Faturas — itens).
-- Deferred Finance backlog item I2: an invoice currently has a single
-- `amount_cents` + free-text description. Real invoices itemize as multiple
-- lines (description, quantity, unit price). This table stores the lines; the
-- invoice's `amount_cents` is kept in sync as the sum of its lines by the
-- server action layer.
--
-- All monetary amounts are integer minor units (cents) in bigint columns.
-- Quantity is stored in thousandths (milli-units) so fractional quantities
-- (e.g. 1.5 h, 0.25 un) stay exact integers — never floats.
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS finance_invoice_line_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The invoice this line belongs to. Cascades on invoice hard-delete; the
  -- app uses soft-delete (is_active) so a cascade rarely fires in practice.
  invoice_id      uuid NOT NULL REFERENCES finance_invoices(id) ON DELETE CASCADE,
  -- Denormalized sector for straightforward RLS without a join.
  sector_id       uuid NOT NULL REFERENCES sectors(id),
  description     text NOT NULL,
  -- Quantity in integer milli-units (1000 = 1.000). Always positive.
  quantity_milli  bigint NOT NULL DEFAULT 1000 CHECK (quantity_milli > 0),
  -- Unit price in integer cents. Never negative.
  unit_price_cents bigint NOT NULL CHECK (unit_price_cents >= 0),
  -- Line total in integer cents = round(quantity_milli * unit_price_cents / 1000).
  -- Persisted (not generated) so the app controls the rounding rule.
  line_total_cents bigint NOT NULL CHECK (line_total_cents >= 0),
  -- Display / sort order within the invoice (0-based).
  position        integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_finance_invoice_line_items_updated_at
  ON finance_invoice_line_items;
CREATE TRIGGER trg_finance_invoice_line_items_updated_at
  BEFORE UPDATE ON finance_invoice_line_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_finance_invoice_line_items_invoice
  ON finance_invoice_line_items (invoice_id);
CREATE INDEX IF NOT EXISTS idx_finance_invoice_line_items_sector
  ON finance_invoice_line_items (sector_id);

ALTER TABLE finance_invoice_line_items ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS — finance_invoice_line_items  (`invoice` resource)
-- A line item inherits the access rules of the invoice it belongs to.
-- =============================================
DROP POLICY IF EXISTS "finance_invoice_line_items_select"
  ON finance_invoice_line_items;
CREATE POLICY "finance_invoice_line_items_select" ON finance_invoice_line_items
  FOR SELECT TO authenticated
  USING (user_has_sector_access(sector_id));

DROP POLICY IF EXISTS "finance_invoice_line_items_insert"
  ON finance_invoice_line_items;
CREATE POLICY "finance_invoice_line_items_insert" ON finance_invoice_line_items
  FOR INSERT TO authenticated
  WITH CHECK (user_has_permission(sector_id, 'invoice', 'update'));

DROP POLICY IF EXISTS "finance_invoice_line_items_update"
  ON finance_invoice_line_items;
CREATE POLICY "finance_invoice_line_items_update" ON finance_invoice_line_items
  FOR UPDATE TO authenticated
  USING (user_has_permission(sector_id, 'invoice', 'update'))
  WITH CHECK (user_has_permission(sector_id, 'invoice', 'update'));

DROP POLICY IF EXISTS "finance_invoice_line_items_delete"
  ON finance_invoice_line_items;
CREATE POLICY "finance_invoice_line_items_delete" ON finance_invoice_line_items
  FOR DELETE TO authenticated
  USING (user_has_permission(sector_id, 'invoice', 'update'));
