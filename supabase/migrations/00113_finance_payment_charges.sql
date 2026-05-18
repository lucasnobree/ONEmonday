-- Migration 00113: Payment charges — boleto / PIX issuance tracking.
-- Phase 4 of the total-migration roadmap (docs/research/migration-architecture.md
-- §2.9 "Boletos / PIX — Gateway (PSP)").
--
-- ONEmonday does not issue boletos or PIX charges itself — that is a regulated
-- activity requiring a bank or licensed PSP. A PSP (Asaas, see the architecture
-- plan) issues the charge; this table tracks the request and the PSP's
-- asynchronous payment confirmation, reported back via webhook.
--
-- A charge belongs to one finance invoice (it is a way to collect that AR).
-- RLS uses the existing `invoice` permission resource. Idempotent: safe to
-- re-run.

CREATE TABLE IF NOT EXISTS finance_payment_charges (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id      uuid NOT NULL REFERENCES sectors(id),
  -- The invoice this charge collects.
  invoice_id     uuid NOT NULL REFERENCES finance_invoices(id),
  -- PSP provider slug (must match a registered PaymentAdapter).
  provider       text NOT NULL DEFAULT 'asaas',
  -- Billing method requested from the PSP.
  billing_type   text NOT NULL DEFAULT 'pix'
                 CHECK (billing_type IN ('pix', 'boleto', 'undefined')),
  -- Idempotency key sent to the PSP so a retry never double-charges.
  reference      text NOT NULL,
  -- Charge amount in integer minor units (cents).
  amount_cents   bigint NOT NULL CHECK (amount_cents > 0),
  currency       text NOT NULL DEFAULT 'BRL',
  due_date       date NOT NULL,
  -- Charge lifecycle:
  --   draft     — created in ONEmonday, not yet sent to the PSP
  --   pending   — PSP issued the charge, awaiting payment
  --   received  — PSP confirmed payment (terminal, success)
  --   overdue   — past due, still unpaid
  --   cancelled — the charge was cancelled before payment
  --   error     — a transport / configuration failure
  status         text NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft', 'pending', 'received',
                                   'overdue', 'cancelled', 'error')),
  -- PSP-side identifier of the charge.
  provider_ref   text,
  -- The boleto digitable line / PIX copy-paste payload, when issued.
  boleto_line    text,
  pix_payload    text,
  -- URL to the hosted invoice / boleto PDF at the PSP.
  invoice_url    text,
  status_reason  text,
  last_payload   jsonb NOT NULL DEFAULT '{}',
  created_by     uuid NOT NULL REFERENCES users(id),
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- One charge reference is globally unique — it is the PSP idempotency key.
CREATE UNIQUE INDEX IF NOT EXISTS idx_finance_payment_charges_reference
  ON finance_payment_charges (provider, reference);

CREATE INDEX IF NOT EXISTS idx_finance_payment_charges_sector
  ON finance_payment_charges (sector_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_finance_payment_charges_invoice
  ON finance_payment_charges (invoice_id);
CREATE INDEX IF NOT EXISTS idx_finance_payment_charges_status
  ON finance_payment_charges (status);

DROP TRIGGER IF EXISTS trg_finance_payment_charges_updated_at
  ON finance_payment_charges;
CREATE TRIGGER trg_finance_payment_charges_updated_at
  BEFORE UPDATE ON finance_payment_charges
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE finance_payment_charges ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS — finance_payment_charges  (`invoice` resource)
-- =============================================
DROP POLICY IF EXISTS "finance_payment_charges_select" ON finance_payment_charges;
CREATE POLICY "finance_payment_charges_select" ON finance_payment_charges
  FOR SELECT TO authenticated
  USING (is_active = true AND user_has_sector_access(sector_id));

DROP POLICY IF EXISTS "finance_payment_charges_insert" ON finance_payment_charges;
CREATE POLICY "finance_payment_charges_insert" ON finance_payment_charges
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND
    user_has_permission(sector_id, 'invoice', 'update')
  );

DROP POLICY IF EXISTS "finance_payment_charges_update" ON finance_payment_charges;
CREATE POLICY "finance_payment_charges_update" ON finance_payment_charges
  FOR UPDATE TO authenticated
  USING (user_has_permission(sector_id, 'invoice', 'update'))
  WITH CHECK (user_has_permission(sector_id, 'invoice', 'update'));

DROP POLICY IF EXISTS "finance_payment_charges_delete" ON finance_payment_charges;
CREATE POLICY "finance_payment_charges_delete" ON finance_payment_charges
  FOR DELETE TO authenticated
  USING (user_has_permission(sector_id, 'invoice', 'delete'));
