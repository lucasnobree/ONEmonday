-- =============================================
-- Migration 00104: CRM Deal Ownership
-- Phase 2 of the total-migration roadmap (docs/research/migration-architecture.md
-- §2.6/§2.7, migration-comercial.md backlog #2).
--
-- Adds an explicit `owner_id` to `crm_deals` — the salesperson a deal is
-- assigned to. Until now the dashboard "Top Performers" ranking and the
-- pipeline card avatar faked an owner from `cards.created_by`; creator != owner.
-- `crm_companies` and `crm_contacts` already carry `owner_id` (migration 00011),
-- so this brings deals to parity.
--
-- Idempotent: safe to re-run.
-- =============================================

-- Owner of the deal — the responsible salesperson. Nullable so legacy deals
-- and quick-created deals can be unassigned and triaged later.
ALTER TABLE crm_deals
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES users(id);

-- Backfill: seed the owner from the deal's card creator so existing deals are
-- not all "unassigned" on first load. Only touches rows still null.
UPDATE crm_deals d
  SET owner_id = c.created_by
  FROM cards c
  WHERE c.id = d.card_id
    AND d.owner_id IS NULL
    AND c.created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_deals_owner_id ON crm_deals(owner_id);
