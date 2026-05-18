-- Migration 00111: Fiscal documents — NF-e / NFS-e emission tracking.
-- Phase 4 of the total-migration roadmap (docs/research/migration-architecture.md
-- §1.2b, §2.9 "Fiscal emission — Gateway").
--
-- ONEmonday does NOT emit fiscal documents itself — emission is a regulated
-- capability that requires SEFAZ/prefeitura webservices and an A1 digital
-- certificate. A fiscal gateway (Focus NFe, see the architecture plan) does the
-- actual emission; this table tracks the request, the gateway's protocol, and
-- the asynchronous SEFAZ authorisation result reported back via webhook.
--
-- Fiscal/legal liability never moves to ONEmonday — the company + accountant
-- remain responsible (migration-architecture.md §3, §6).
--
-- One fiscal document is linked to one finance invoice. RLS mirrors the
-- finance_invoices `invoice` permission resource. Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS finance_fiscal_documents (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id      uuid NOT NULL REFERENCES sectors(id),
  -- The ONEmonday invoice this fiscal document was requested for.
  invoice_id     uuid NOT NULL REFERENCES finance_invoices(id),
  -- Document kind. NFS-e = serviços; NF-e = produtos.
  doc_type       text NOT NULL DEFAULT 'nfse'
                 CHECK (doc_type IN ('nfe', 'nfse')),
  -- Fiscal gateway provider slug (must match a registered FiscalAdapter).
  provider       text NOT NULL DEFAULT 'focus_nfe',
  -- Idempotency key sent to the gateway so a retry never double-emits.
  reference      text NOT NULL,
  -- Emission lifecycle:
  --   draft      — created in ONEmonday, not yet sent to the gateway
  --   processing — gateway accepted the request, SEFAZ authorisation pending
  --   authorized — SEFAZ authorised the document (terminal, success)
  --   rejected   — SEFAZ rejected the document (terminal, failure)
  --   cancelled  — an authorised document was subsequently cancelled
  --   error      — a transport / configuration failure (no-op mode lands here
  --                only when explicitly requested; unconfigured stays draft)
  status         text NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft', 'processing', 'authorized',
                                   'rejected', 'cancelled', 'error')),
  -- Gateway-side identifier of the document.
  provider_ref   text,
  -- SEFAZ/prefeitura protocol number once authorised.
  protocol       text,
  -- Access key (chave de acesso) of an authorised NF-e/NFS-e.
  access_key     text,
  -- URLs to the authorised PDF (DANFE) and XML, custodied by the gateway.
  pdf_url        text,
  xml_url        text,
  -- Human-readable rejection / error reason when status is rejected/error.
  status_reason  text,
  -- Last raw gateway payload, for audit / debugging.
  last_payload   jsonb NOT NULL DEFAULT '{}',
  created_by     uuid NOT NULL REFERENCES users(id),
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- One emission reference is globally unique — it is the gateway idempotency key.
CREATE UNIQUE INDEX IF NOT EXISTS idx_finance_fiscal_documents_reference
  ON finance_fiscal_documents (provider, reference);

CREATE INDEX IF NOT EXISTS idx_finance_fiscal_documents_sector
  ON finance_fiscal_documents (sector_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_finance_fiscal_documents_invoice
  ON finance_fiscal_documents (invoice_id);
CREATE INDEX IF NOT EXISTS idx_finance_fiscal_documents_status
  ON finance_fiscal_documents (status);

DROP TRIGGER IF EXISTS trg_finance_fiscal_documents_updated_at
  ON finance_fiscal_documents;
CREATE TRIGGER trg_finance_fiscal_documents_updated_at
  BEFORE UPDATE ON finance_fiscal_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE finance_fiscal_documents ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS — finance_fiscal_documents
-- Gated by the existing `invoice` permission resource: a fiscal document is an
-- emission of an invoice. Webhook routes use the service role (RLS bypassed).
-- =============================================
DROP POLICY IF EXISTS "finance_fiscal_documents_select" ON finance_fiscal_documents;
CREATE POLICY "finance_fiscal_documents_select" ON finance_fiscal_documents
  FOR SELECT TO authenticated
  USING (is_active = true AND user_has_sector_access(sector_id));

DROP POLICY IF EXISTS "finance_fiscal_documents_insert" ON finance_fiscal_documents;
CREATE POLICY "finance_fiscal_documents_insert" ON finance_fiscal_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND
    user_has_permission(sector_id, 'invoice', 'update')
  );

DROP POLICY IF EXISTS "finance_fiscal_documents_update" ON finance_fiscal_documents;
CREATE POLICY "finance_fiscal_documents_update" ON finance_fiscal_documents
  FOR UPDATE TO authenticated
  USING (user_has_permission(sector_id, 'invoice', 'update'))
  WITH CHECK (user_has_permission(sector_id, 'invoice', 'update'));

DROP POLICY IF EXISTS "finance_fiscal_documents_delete" ON finance_fiscal_documents;
CREATE POLICY "finance_fiscal_documents_delete" ON finance_fiscal_documents
  FOR DELETE TO authenticated
  USING (user_has_permission(sector_id, 'invoice', 'delete'));
