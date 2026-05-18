-- Migration 00114: Marketing automation MVP — email campaigns + sequences.
-- Phase 5 of the total-migration roadmap (docs/research/migration-architecture.md
-- §2.8 "RD Station Marketing — Hybrid: native automation, gateway sending").
--
-- This adds a focused, feasible marketing-automation MVP — NOT a full RD Station
-- Marketing replacement (see migration-comercial.md §5: a full replacement is a
-- multi-quarter build). It ships:
--
--   * email campaigns — compose an email and send it to an audience segment;
--   * email sends      — one row per recipient, tracking delivery status;
--   * automation sequences — a trigger -> step model (e.g. "on segment entry,
--     wait N days, send email"), with a server-action runner entrypoint;
--   * sequence enrollments — a contact's progress through a sequence.
--
-- Email *sending* goes through an ESP gateway (Resend) via the integration
-- layer's ResendAdapter — ONEmonday never runs mail infrastructure. With no
-- ESP credential the adapter runs in no-op mode and sends are recorded as
-- 'skipped'. The company must supply a Resend account + a verified sending
-- domain (SPF/DKIM/DMARC) to go live.
--
-- Deferred (explicitly out of scope, see migration-comercial.md §5):
-- landing-page builder, form builder, lead-scoring engine, visual flow canvas,
-- a scheduled background worker (the runner is a server-action entrypoint).
--
-- Monetary values: none here (email volume is metered by the ESP, not ONEmonday).
-- Idempotent: safe to re-run.

-- =============================================
-- Permission resources — email_campaign + automation
-- Registered against the existing 'marketing' module.
-- =============================================
INSERT INTO permissions (module_id, resource, action)
SELECT m.id, r, a
FROM modules m,
     unnest(ARRAY['email_campaign', 'automation']) AS r,
     unnest(ARRAY['create', 'read', 'update', 'delete', 'manage']) AS a
WHERE m.slug = 'marketing'
ON CONFLICT (module_id, resource, action) DO NOTHING;

-- Grant the new resources to admin and manager roles (full control).
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
JOIN modules m ON p.module_id = m.id
WHERE r.slug IN ('admin', 'manager')
AND p.resource IN ('email_campaign', 'automation')
AND m.slug = 'marketing'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Grant create/read/update to the analyst role.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
JOIN modules m ON p.module_id = m.id
WHERE r.slug = 'analyst'
AND p.resource IN ('email_campaign', 'automation')
AND p.action IN ('create', 'read', 'update')
AND m.slug = 'marketing'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Grant read-only to the intern role.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
JOIN modules m ON p.module_id = m.id
WHERE r.slug = 'intern'
AND p.resource IN ('email_campaign', 'automation')
AND p.action = 'read'
AND m.slug = 'marketing'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- =============================================
-- marketing_email_campaigns — composed email blasts
-- A campaign is composed once and sent to one audience segment.
-- =============================================
CREATE TABLE IF NOT EXISTS marketing_email_campaigns (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id         uuid NOT NULL REFERENCES sectors(id),
  -- Optional link to the marketing campaign this email belongs to.
  campaign_id       uuid REFERENCES marketing_campaigns(id) ON DELETE SET NULL,
  -- The audience this email is sent to. Required to actually send.
  segment_id        uuid REFERENCES marketing_audience_segments(id) ON DELETE SET NULL,
  name              text NOT NULL,
  -- Email envelope fields.
  subject           text NOT NULL,
  from_name         text NOT NULL DEFAULT 'ONEmonday',
  from_email        text NOT NULL,
  reply_to          text,
  -- The email body. `body_html` is rendered to the recipient; `body_text` is
  -- the plain-text fallback. A simple composer — no drag-and-drop builder.
  body_html         text NOT NULL DEFAULT '',
  body_text         text NOT NULL DEFAULT '',
  -- Lifecycle:
  --   draft     — being composed, not sent
  --   scheduled — queued for a future send (scheduled_at set)
  --   sending   — a send run is in progress
  --   sent      — the send run completed
  --   cancelled — abandoned
  status            text NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'scheduled', 'sending',
                                      'sent', 'cancelled')),
  scheduled_at      timestamptz,
  sent_at           timestamptz,
  -- Roll-up counters, updated as sends are recorded. Never negative.
  recipient_count   integer NOT NULL DEFAULT 0 CHECK (recipient_count >= 0),
  delivered_count   integer NOT NULL DEFAULT 0 CHECK (delivered_count >= 0),
  failed_count      integer NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
  created_by        uuid NOT NULL REFERENCES users(id),
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_marketing_email_campaigns_updated_at ON marketing_email_campaigns;
CREATE TRIGGER trg_marketing_email_campaigns_updated_at BEFORE UPDATE ON marketing_email_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- marketing_email_sends — one row per recipient per send
-- The per-recipient delivery ledger. Bounce/complaint updates from the ESP
-- webhook (a later phase) land here keyed by `provider_ref`.
-- =============================================
CREATE TABLE IF NOT EXISTS marketing_email_sends (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id         uuid NOT NULL REFERENCES sectors(id),
  email_campaign_id uuid NOT NULL REFERENCES marketing_email_campaigns(id) ON DELETE CASCADE,
  -- Recipient address. A send is a denormalised snapshot — the recipient may
  -- not be a CRM contact (segments are not yet queryable, see deferred items).
  recipient_email   text NOT NULL,
  recipient_name    text,
  -- Delivery lifecycle:
  --   pending   — created, not yet handed to the ESP
  --   sent      — accepted by the ESP gateway
  --   delivered — ESP confirmed delivery (via webhook, later phase)
  --   bounced   — hard/soft bounce reported by the ESP
  --   failed    — a transport / gateway error
  --   skipped   — ESP not configured (no-op mode) — nothing was sent
  status            text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'sent', 'delivered',
                                      'bounced', 'failed', 'skipped')),
  -- ESP-side message id, when one was returned.
  provider_ref      text,
  -- Human-readable failure reason when status is failed/bounced.
  error             text,
  sent_at           timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_marketing_email_sends_updated_at ON marketing_email_sends;
CREATE TRIGGER trg_marketing_email_sends_updated_at BEFORE UPDATE ON marketing_email_sends
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- marketing_sequences — automation sequence definitions
-- A simple trigger -> step model. The only trigger today is 'segment_entry'.
-- =============================================
CREATE TABLE IF NOT EXISTS marketing_sequences (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id         uuid NOT NULL REFERENCES sectors(id),
  name              text NOT NULL,
  description       text,
  -- What starts an enrollment. Today only 'segment_entry' (a contact entering
  -- the linked segment). 'manual' allows hand-enrolling for testing.
  trigger_type      text NOT NULL DEFAULT 'segment_entry'
                    CHECK (trigger_type IN ('segment_entry', 'manual')),
  -- The segment whose membership drives 'segment_entry' enrollments.
  segment_id        uuid REFERENCES marketing_audience_segments(id) ON DELETE SET NULL,
  -- 'active' sequences process steps; 'paused'/'draft' do not.
  status            text NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'active', 'paused')),
  created_by        uuid NOT NULL REFERENCES users(id),
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_marketing_sequences_updated_at ON marketing_sequences;
CREATE TRIGGER trg_marketing_sequences_updated_at BEFORE UPDATE ON marketing_sequences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- marketing_sequence_steps — ordered steps of a sequence
-- Each step is either a 'wait' (delay N days) or a 'send_email'.
-- =============================================
CREATE TABLE IF NOT EXISTS marketing_sequence_steps (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id       uuid NOT NULL REFERENCES marketing_sequences(id) ON DELETE CASCADE,
  -- 0-based execution order within the sequence.
  step_order        integer NOT NULL CHECK (step_order >= 0),
  -- 'wait'       — delay the enrollment by `wait_days` days
  -- 'send_email' — send the linked email campaign to the enrolled recipient
  step_type         text NOT NULL
                    CHECK (step_type IN ('wait', 'send_email')),
  -- For 'wait' steps: the delay in days. Never negative.
  wait_days         integer NOT NULL DEFAULT 0 CHECK (wait_days >= 0),
  -- For 'send_email' steps: the email campaign sent at this step.
  email_campaign_id uuid REFERENCES marketing_email_campaigns(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  -- Step order is unique within a sequence.
  UNIQUE (sequence_id, step_order)
);

DROP TRIGGER IF EXISTS trg_marketing_sequence_steps_updated_at ON marketing_sequence_steps;
CREATE TRIGGER trg_marketing_sequence_steps_updated_at BEFORE UPDATE ON marketing_sequence_steps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- marketing_sequence_enrollments — a recipient's run through a sequence
-- The runner advances `current_step` and `next_run_at` as steps complete.
-- =============================================
CREATE TABLE IF NOT EXISTS marketing_sequence_enrollments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id         uuid NOT NULL REFERENCES sectors(id),
  sequence_id       uuid NOT NULL REFERENCES marketing_sequences(id) ON DELETE CASCADE,
  recipient_email   text NOT NULL,
  recipient_name    text,
  -- The 0-based index of the next step to process.
  current_step      integer NOT NULL DEFAULT 0 CHECK (current_step >= 0),
  -- Enrollment lifecycle:
  --   active    — has steps remaining; runner will process it
  --   completed — all steps done
  --   cancelled — stopped early
  status            text NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'completed', 'cancelled')),
  -- The earliest time the next step may run. A 'wait' step pushes this out.
  next_run_at       timestamptz NOT NULL DEFAULT now(),
  enrolled_at       timestamptz NOT NULL DEFAULT now(),
  completed_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  -- A recipient is enrolled in a given sequence at most once.
  UNIQUE (sequence_id, recipient_email)
);

DROP TRIGGER IF EXISTS trg_marketing_sequence_enrollments_updated_at ON marketing_sequence_enrollments;
CREATE TRIGGER trg_marketing_sequence_enrollments_updated_at BEFORE UPDATE ON marketing_sequence_enrollments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- Indexes
-- =============================================
CREATE INDEX IF NOT EXISTS idx_marketing_email_campaigns_sector
  ON marketing_email_campaigns(sector_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_marketing_email_campaigns_status
  ON marketing_email_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_marketing_email_campaigns_campaign
  ON marketing_email_campaigns(campaign_id);
CREATE INDEX IF NOT EXISTS idx_marketing_email_sends_campaign
  ON marketing_email_sends(email_campaign_id);
CREATE INDEX IF NOT EXISTS idx_marketing_email_sends_sector
  ON marketing_email_sends(sector_id);
CREATE INDEX IF NOT EXISTS idx_marketing_sequences_sector
  ON marketing_sequences(sector_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_marketing_sequence_steps_sequence
  ON marketing_sequence_steps(sequence_id);
CREATE INDEX IF NOT EXISTS idx_marketing_sequence_enrollments_sequence
  ON marketing_sequence_enrollments(sequence_id);
-- The runner query: active enrollments due to run, ordered by next_run_at.
CREATE INDEX IF NOT EXISTS idx_marketing_sequence_enrollments_due
  ON marketing_sequence_enrollments(next_run_at)
  WHERE status = 'active';

-- =============================================
-- Enable RLS on every new table
-- =============================================
ALTER TABLE marketing_email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_email_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_sequence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_sequence_enrollments ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS — marketing_email_campaigns (resource: email_campaign)
-- =============================================
DROP POLICY IF EXISTS "marketing_email_campaigns_select" ON marketing_email_campaigns;
CREATE POLICY "marketing_email_campaigns_select" ON marketing_email_campaigns
  FOR SELECT TO authenticated
  USING (is_active = true AND user_has_sector_access(sector_id));

DROP POLICY IF EXISTS "marketing_email_campaigns_insert" ON marketing_email_campaigns;
CREATE POLICY "marketing_email_campaigns_insert" ON marketing_email_campaigns
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND
    user_has_permission(sector_id, 'email_campaign', 'create')
  );

DROP POLICY IF EXISTS "marketing_email_campaigns_update" ON marketing_email_campaigns;
CREATE POLICY "marketing_email_campaigns_update" ON marketing_email_campaigns
  FOR UPDATE TO authenticated
  USING (user_has_permission(sector_id, 'email_campaign', 'update'))
  WITH CHECK (user_has_permission(sector_id, 'email_campaign', 'update'));

DROP POLICY IF EXISTS "marketing_email_campaigns_delete" ON marketing_email_campaigns;
CREATE POLICY "marketing_email_campaigns_delete" ON marketing_email_campaigns
  FOR DELETE TO authenticated
  USING (user_has_permission(sector_id, 'email_campaign', 'delete'));

-- =============================================
-- RLS — marketing_email_sends
-- A send belongs to an email campaign; gate it with the same `email_campaign`
-- resource. Sends are written by the server action / runner; the webhook route
-- uses the service role (RLS bypassed).
-- =============================================
DROP POLICY IF EXISTS "marketing_email_sends_select" ON marketing_email_sends;
CREATE POLICY "marketing_email_sends_select" ON marketing_email_sends
  FOR SELECT TO authenticated
  USING (user_has_sector_access(sector_id));

DROP POLICY IF EXISTS "marketing_email_sends_insert" ON marketing_email_sends;
CREATE POLICY "marketing_email_sends_insert" ON marketing_email_sends
  FOR INSERT TO authenticated
  WITH CHECK (user_has_permission(sector_id, 'email_campaign', 'update'));

DROP POLICY IF EXISTS "marketing_email_sends_update" ON marketing_email_sends;
CREATE POLICY "marketing_email_sends_update" ON marketing_email_sends
  FOR UPDATE TO authenticated
  USING (user_has_permission(sector_id, 'email_campaign', 'update'))
  WITH CHECK (user_has_permission(sector_id, 'email_campaign', 'update'));

DROP POLICY IF EXISTS "marketing_email_sends_delete" ON marketing_email_sends;
CREATE POLICY "marketing_email_sends_delete" ON marketing_email_sends
  FOR DELETE TO authenticated
  USING (user_has_permission(sector_id, 'email_campaign', 'delete'));

-- =============================================
-- RLS — marketing_sequences (resource: automation)
-- =============================================
DROP POLICY IF EXISTS "marketing_sequences_select" ON marketing_sequences;
CREATE POLICY "marketing_sequences_select" ON marketing_sequences
  FOR SELECT TO authenticated
  USING (is_active = true AND user_has_sector_access(sector_id));

DROP POLICY IF EXISTS "marketing_sequences_insert" ON marketing_sequences;
CREATE POLICY "marketing_sequences_insert" ON marketing_sequences
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND
    user_has_permission(sector_id, 'automation', 'create')
  );

DROP POLICY IF EXISTS "marketing_sequences_update" ON marketing_sequences;
CREATE POLICY "marketing_sequences_update" ON marketing_sequences
  FOR UPDATE TO authenticated
  USING (user_has_permission(sector_id, 'automation', 'update'))
  WITH CHECK (user_has_permission(sector_id, 'automation', 'update'));

DROP POLICY IF EXISTS "marketing_sequences_delete" ON marketing_sequences;
CREATE POLICY "marketing_sequences_delete" ON marketing_sequences
  FOR DELETE TO authenticated
  USING (user_has_permission(sector_id, 'automation', 'delete'));

-- =============================================
-- RLS — marketing_sequence_steps
-- A step has no sector_id of its own; access derives from its parent sequence.
-- =============================================
DROP POLICY IF EXISTS "marketing_sequence_steps_select" ON marketing_sequence_steps;
CREATE POLICY "marketing_sequence_steps_select" ON marketing_sequence_steps
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM marketing_sequences s
    WHERE s.id = marketing_sequence_steps.sequence_id
    AND s.is_active = true
    AND user_has_sector_access(s.sector_id)
  ));

DROP POLICY IF EXISTS "marketing_sequence_steps_insert" ON marketing_sequence_steps;
CREATE POLICY "marketing_sequence_steps_insert" ON marketing_sequence_steps
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM marketing_sequences s
    WHERE s.id = marketing_sequence_steps.sequence_id
    AND user_has_permission(s.sector_id, 'automation', 'update')
  ));

DROP POLICY IF EXISTS "marketing_sequence_steps_update" ON marketing_sequence_steps;
CREATE POLICY "marketing_sequence_steps_update" ON marketing_sequence_steps
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM marketing_sequences s
    WHERE s.id = marketing_sequence_steps.sequence_id
    AND user_has_permission(s.sector_id, 'automation', 'update')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM marketing_sequences s
    WHERE s.id = marketing_sequence_steps.sequence_id
    AND user_has_permission(s.sector_id, 'automation', 'update')
  ));

DROP POLICY IF EXISTS "marketing_sequence_steps_delete" ON marketing_sequence_steps;
CREATE POLICY "marketing_sequence_steps_delete" ON marketing_sequence_steps
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM marketing_sequences s
    WHERE s.id = marketing_sequence_steps.sequence_id
    AND user_has_permission(s.sector_id, 'automation', 'update')
  ));

-- =============================================
-- RLS — marketing_sequence_enrollments (resource: automation)
-- =============================================
DROP POLICY IF EXISTS "marketing_sequence_enrollments_select" ON marketing_sequence_enrollments;
CREATE POLICY "marketing_sequence_enrollments_select" ON marketing_sequence_enrollments
  FOR SELECT TO authenticated
  USING (user_has_sector_access(sector_id));

DROP POLICY IF EXISTS "marketing_sequence_enrollments_insert" ON marketing_sequence_enrollments;
CREATE POLICY "marketing_sequence_enrollments_insert" ON marketing_sequence_enrollments
  FOR INSERT TO authenticated
  WITH CHECK (user_has_permission(sector_id, 'automation', 'update'));

DROP POLICY IF EXISTS "marketing_sequence_enrollments_update" ON marketing_sequence_enrollments;
CREATE POLICY "marketing_sequence_enrollments_update" ON marketing_sequence_enrollments
  FOR UPDATE TO authenticated
  USING (user_has_permission(sector_id, 'automation', 'update'))
  WITH CHECK (user_has_permission(sector_id, 'automation', 'update'));

DROP POLICY IF EXISTS "marketing_sequence_enrollments_delete" ON marketing_sequence_enrollments;
CREATE POLICY "marketing_sequence_enrollments_delete" ON marketing_sequence_enrollments
  FOR DELETE TO authenticated
  USING (user_has_permission(sector_id, 'automation', 'delete'));
