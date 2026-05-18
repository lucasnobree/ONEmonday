-- Migration 00112: Bank reconciliation — imported transactions + matching.
-- Phase 4 of the total-migration roadmap (docs/research/migration-architecture.md
-- §2.9 "Bank reconciliation — Gateway (Open Finance)"; migration-contabilidade.md
-- backlog #2).
--
-- `finance_bank_transactions` holds transactions pulled from a bank, by one of
-- two sources:
--   * an Open Finance aggregator (Pluggy, see the architecture plan) via the
--     BankingAdapter — the recommended path; or
--   * a manual OFX-file import — the fallback the audit requires when no
--     aggregator credential exists.
--
-- A transaction can be reconciled (matched) to a finance invoice OR a finance
-- expense. The match is stored on the transaction row itself.
--
-- RLS uses the existing `transaction` permission resource registered for the
-- finance module (migration 00070). Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS finance_bank_transactions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id      uuid NOT NULL REFERENCES sectors(id),
  -- How this transaction entered ONEmonday.
  source         text NOT NULL DEFAULT 'ofx'
                 CHECK (source IN ('ofx', 'pluggy', 'manual')),
  -- Provider-side / OFX FITID identifier — the dedup key for re-imports.
  external_id    text NOT NULL,
  -- Direction: credit = money in (matches an invoice); debit = money out
  -- (matches an expense).
  direction      text NOT NULL CHECK (direction IN ('credit', 'debit')),
  -- Transaction amount in integer minor units (cents). Always positive; the
  -- `direction` column carries the sign.
  amount_cents   bigint NOT NULL CHECK (amount_cents > 0),
  currency       text NOT NULL DEFAULT 'BRL',
  -- Value date of the transaction (date-only).
  posted_date    date NOT NULL,
  description    text,
  -- Optional bank/account label (free text — no bank-account entity yet).
  account_label  text,
  -- Reconciliation state:
  --   unmatched  — imported, not yet reconciled
  --   matched    — reconciled to an invoice or expense
  --   ignored    — explicitly marked as not relevant (bank fees, transfers)
  match_status   text NOT NULL DEFAULT 'unmatched'
                 CHECK (match_status IN ('unmatched', 'matched', 'ignored')),
  -- The reconciled invoice / expense. Exactly one is set when matched.
  matched_invoice_id uuid REFERENCES finance_invoices(id),
  matched_expense_id uuid REFERENCES finance_expenses(id),
  matched_by     uuid REFERENCES users(id),
  matched_at     timestamptz,
  created_by     uuid NOT NULL REFERENCES users(id),
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  -- A matched transaction points at exactly one domain row.
  CONSTRAINT chk_bank_tx_match CHECK (
    (match_status = 'matched'
       AND (matched_invoice_id IS NOT NULL) <> (matched_expense_id IS NOT NULL))
    OR
    (match_status <> 'matched'
       AND matched_invoice_id IS NULL AND matched_expense_id IS NULL)
  )
);

-- Dedup: a (source, external_id) is imported at most once per sector.
CREATE UNIQUE INDEX IF NOT EXISTS idx_finance_bank_transactions_dedup
  ON finance_bank_transactions (sector_id, source, external_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_finance_bank_transactions_sector
  ON finance_bank_transactions (sector_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_finance_bank_transactions_match_status
  ON finance_bank_transactions (match_status);
CREATE INDEX IF NOT EXISTS idx_finance_bank_transactions_posted_date
  ON finance_bank_transactions (posted_date);

DROP TRIGGER IF EXISTS trg_finance_bank_transactions_updated_at
  ON finance_bank_transactions;
CREATE TRIGGER trg_finance_bank_transactions_updated_at
  BEFORE UPDATE ON finance_bank_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE finance_bank_transactions ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS — finance_bank_transactions  (`transaction` resource)
-- =============================================
DROP POLICY IF EXISTS "finance_bank_transactions_select" ON finance_bank_transactions;
CREATE POLICY "finance_bank_transactions_select" ON finance_bank_transactions
  FOR SELECT TO authenticated
  USING (is_active = true AND user_has_sector_access(sector_id));

DROP POLICY IF EXISTS "finance_bank_transactions_insert" ON finance_bank_transactions;
CREATE POLICY "finance_bank_transactions_insert" ON finance_bank_transactions
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND
    user_has_permission(sector_id, 'transaction', 'create')
  );

DROP POLICY IF EXISTS "finance_bank_transactions_update" ON finance_bank_transactions;
CREATE POLICY "finance_bank_transactions_update" ON finance_bank_transactions
  FOR UPDATE TO authenticated
  USING (user_has_permission(sector_id, 'transaction', 'update'))
  WITH CHECK (user_has_permission(sector_id, 'transaction', 'update'));

DROP POLICY IF EXISTS "finance_bank_transactions_delete" ON finance_bank_transactions;
CREATE POLICY "finance_bank_transactions_delete" ON finance_bank_transactions
  FOR DELETE TO authenticated
  USING (user_has_permission(sector_id, 'transaction', 'delete'));
