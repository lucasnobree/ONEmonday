-- Migration 00102: Integration layer — inbound webhook event log.
-- Phase 1 of the total-migration roadmap (docs/research/migration-architecture.md
-- §1.2c "Inbound webhooks").
--
-- Every inbound webhook (from Teams, WhatsApp, and — in later phases — fiscal /
-- banking / payment gateways) is recorded here BEFORE the domain row is
-- touched. The (provider, external_id) unique index gives replay-safe
-- idempotency: a redelivered webhook is detected and skipped.
--
-- Inbound webhook routes run with no user session, so RLS here is restrictive:
-- only global admins may read the log (it can carry PII payloads). Writes
-- happen via the service role from app/api/webhooks/* and bypass RLS.
--
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS webhook_events (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Provider slug — matches an integration adapter ('teams', 'whatsapp', ...).
  provider       text NOT NULL,
  -- The provider's own event identifier — the idempotency key.
  external_id    text NOT NULL,
  -- Optional event-type discriminator from the provider payload.
  event_type     text,
  -- Raw inbound payload, stored verbatim for audit / debugging.
  payload        jsonb NOT NULL DEFAULT '{}',
  -- Lifecycle: received -> processed | failed | skipped (duplicate replay).
  status         text NOT NULL DEFAULT 'received'
                 CHECK (status IN ('received', 'processed', 'failed', 'skipped')),
  -- Verification result of the provider signature/HMAC check.
  signature_ok   boolean NOT NULL DEFAULT false,
  error          text,
  processed_at   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Idempotency: a provider event id is unique per provider. A redelivery hits
-- this constraint and is treated as a duplicate.
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_events_idempotency
  ON webhook_events (provider, external_id);

CREATE INDEX IF NOT EXISTS idx_webhook_events_status
  ON webhook_events (status);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at
  ON webhook_events (created_at DESC);

ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- Read-only, global-admin-only. Inserts/updates come from the service role
-- (webhook routes) which bypasses RLS entirely.
DROP POLICY IF EXISTS "webhook_events_select" ON webhook_events;
CREATE POLICY "webhook_events_select" ON webhook_events
  FOR SELECT TO authenticated
  USING (is_global_admin());
