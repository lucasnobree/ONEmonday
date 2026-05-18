-- =============================================
-- Migration 00126: CRM Communication (WhatsApp + email logging)
-- Phase 2 / RD Station CRM sub-phase of the total-migration roadmap
-- (docs/research/migration-architecture.md §2.1/§2.7, migration-comercial.md
-- backlog #9/#10).
--
-- "WhatsApp inside the deal" and "email logging" are the last two RD Station
-- CRM gaps. Rather than a new table, this extends `crm_activities` — the
-- existing append-only deal/contact timeline already models call/email/meeting/
-- note/task entries. A WhatsApp message or a logged email IS an activity; it
-- just needs a channel and a direction so the timeline can render a real
-- conversation thread (inbound vs outbound) and de-duplicate webhook deliveries.
--
-- Adds:
--   * `channel`      — how the activity happened (whatsapp / email / manual...).
--   * `direction`    — inbound (received) vs outbound (sent); NULL for non-comm
--                      activities (notes, tasks, meetings).
--   * `external_ref` — the provider's own message id (WhatsApp Cloud API
--                      `wamid`). UNIQUE so an inbound-webhook redelivery does
--                      not double-log the same received message.
--   * `occurred_at`  — when the communication actually happened at the provider
--                      (a received WhatsApp message carries its own timestamp);
--                      defaults to `created_at` for everything else.
--
-- No new table; the `crm_activities` RLS policies (migration 00011 / 00105)
-- already cover every column added here. Idempotent: safe to re-run.
-- =============================================

-- The medium the activity happened over. 'manual' is the default — it keeps
-- every pre-existing call/email/meeting/note/task row semantically unchanged
-- (they were all hand-logged). 'whatsapp' / 'email' mark real communication.
ALTER TABLE crm_activities
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'manual'
    CHECK (channel IN ('manual', 'whatsapp', 'email', 'phone'));

-- Direction of a communication activity. NULL = not a directed communication
-- (a note, a meeting, an internal task). 'outbound' = the company sent it;
-- 'inbound' = the contact sent it (e.g. a received WhatsApp reply).
ALTER TABLE crm_activities
  ADD COLUMN IF NOT EXISTS direction text
    CHECK (direction IS NULL OR direction IN ('inbound', 'outbound'));

-- The provider's own immutable message id (WhatsApp Cloud API `wamid.*`).
-- Used as the idempotency key when the inbound webhook fans a received message
-- into the timeline: a Meta webhook redelivery carries the same id, so a
-- partial unique index drops the duplicate insert silently.
ALTER TABLE crm_activities
  ADD COLUMN IF NOT EXISTS external_ref text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_activities_external_ref
  ON crm_activities (external_ref)
  WHERE external_ref IS NOT NULL;

-- When the communication actually occurred at the provider. A received
-- WhatsApp message carries Meta's own epoch timestamp; an outbound message or
-- a manually-logged email occurred "now". The timeline orders by this so an
-- out-of-order webhook delivery still threads correctly.
ALTER TABLE crm_activities
  ADD COLUMN IF NOT EXISTS occurred_at timestamptz NOT NULL DEFAULT now();

-- Backfill: existing rows "occurred" when they were created.
UPDATE crm_activities
  SET occurred_at = created_at
  WHERE occurred_at IS NULL OR occurred_at = created_at IS NOT TRUE;

-- The deal timeline and the per-contact conversation view both filter on
-- (deal_id / contact_id) and order by occurred_at — index the comm path.
CREATE INDEX IF NOT EXISTS idx_crm_activities_deal_channel
  ON crm_activities (deal_id, occurred_at)
  WHERE channel <> 'manual';

CREATE INDEX IF NOT EXISTS idx_crm_activities_contact_channel
  ON crm_activities (contact_id, occurred_at)
  WHERE channel <> 'manual';

-- An INBOUND communication (a received WhatsApp message) has no internal
-- "performer" — it was logged by the webhook with no user session. Make
-- `performed_by` nullable and add a CHECK so it may only be NULL for an
-- inbound row; every user-driven activity still requires a performer.
ALTER TABLE crm_activities
  ALTER COLUMN performed_by DROP NOT NULL;

ALTER TABLE crm_activities
  DROP CONSTRAINT IF EXISTS chk_crm_activities_performed_by;
ALTER TABLE crm_activities
  ADD CONSTRAINT chk_crm_activities_performed_by
  CHECK (performed_by IS NOT NULL OR direction = 'inbound');

-- The inbound-WhatsApp webhook runs with the service-role client and inserts
-- received messages directly. The existing INSERT policy (migration 00011)
-- requires `performed_by = auth.uid()`, which an inbound row cannot satisfy.
-- Widen INSERT to also accept an inbound communication row (NULL performer,
-- direction = 'inbound'); the service-role client bypasses RLS anyway, but
-- this keeps the policy semantically correct and future-proof.
DROP POLICY IF EXISTS "crm_activities_insert" ON crm_activities;
CREATE POLICY "crm_activities_insert" ON crm_activities
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      performed_by = auth.uid()
      AND user_has_permission(sector_id, 'crm_activity', 'create')
    )
    OR (
      performed_by IS NULL
      AND direction = 'inbound'
      AND user_has_permission(sector_id, 'crm_activity', 'create')
    )
  );
