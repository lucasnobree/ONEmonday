-- =============================================
-- Migration 00136: CRM Email Communication (send-from-deal + inbound logging)
-- Phase 2 / RD Station CRM sub-phase of the total-migration roadmap
-- (docs/research/migration-architecture.md §2.7/§2.8,
-- migration-comercial.md backlog #9 "email integration").
--
-- The Phase-2 communication migration 00126 already added `channel` /
-- `direction` / `external_ref` / `occurred_at` to `crm_activities` and made
-- `performed_by` nullable for inbound rows. WhatsApp send/receive logging rides
-- on those columns; an email message — sent from the deal through the Resend
-- ESP, or received via the inbound-email webhook — is the same shape: a
-- `crm_activities` row with `channel = 'email'` and a `direction`.
--
-- This migration therefore adds NO new column. It adds:
--   * `idx_crm_activities_email_thread` — the deal/contact email-thread read
--     path used by the "Comunicação" panel (channel = 'email', by occurred_at).
--   * a comment recording that the inbound-email webhook reuses the existing
--     `external_ref` UNIQUE index (idx_crm_activities_external_ref, 00126) as
--     its idempotency key — a Resend redelivery of the same inbound message
--     carries the same id and the duplicate insert is dropped silently.
--
-- The 00126 INSERT policy already accepts an inbound row (NULL performer,
-- direction = 'inbound') under `crm_activity.create`; the inbound-email webhook
-- runs with the RLS-bypassing service-role client, identical to the inbound
-- WhatsApp webhook. No new table => the existing `crm_activities` RLS policies
-- (00011 / 00105 / 00126) fully cover every email-channel row. Idempotent:
-- safe to re-run.
-- =============================================

-- The deal "Comunicação" panel and the per-contact email view both filter to
-- channel = 'email' and order by occurred_at to render the conversation
-- thread. 00126 indexed the comm path generically (channel <> 'manual'); this
-- partial index narrows it to the email channel so a deal with a long mixed
-- WhatsApp+email history still resolves the email thread cheaply.
CREATE INDEX IF NOT EXISTS idx_crm_activities_email_thread
  ON crm_activities (deal_id, occurred_at)
  WHERE channel = 'email';

CREATE INDEX IF NOT EXISTS idx_crm_activities_email_thread_contact
  ON crm_activities (contact_id, occurred_at)
  WHERE channel = 'email';

-- The inbound-email webhook (`app/api/webhooks/email`) matches a sender to a
-- `crm_contacts` row by email address. Index the lower-cased email so the
-- match is a cheap case-insensitive equality lookup rather than a scan.
CREATE INDEX IF NOT EXISTS idx_crm_contacts_email_lower
  ON crm_contacts (lower(email))
  WHERE email IS NOT NULL AND is_active = true;

COMMENT ON INDEX idx_crm_activities_external_ref IS
  'Idempotency key for inbound communication webhooks: WhatsApp `wamid` '
  '(00126) and the Resend inbound-email message id (00136). A provider '
  'redelivery carries the same id, so the duplicate insert is dropped.';
