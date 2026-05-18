-- Migration 00103: Integration layer — outbound notification dispatch.
-- Phase 1 of the total-migration roadmap (docs/research/migration-architecture.md
-- §1.2e "The notification dispatch layer").
--
-- This generalises the in-app-only `notifications` table (migration 00003) into
-- a multi-channel dispatch pipeline WITHOUT replacing it:
--
--   * `notification_outbox` — every dispatchable message enqueued with a
--     resolved target channel (teams / whatsapp / in_app). A worker / dispatch
--     routine drains it and calls the matching integration adapter.
--   * `notification_channel_routes` — admin-configured mapping of an event
--     type to the channel(s) it should also be delivered on. The Settings UI
--     edits this table.
--
-- The existing in-app `create_notification` flow is untouched: an in-app
-- notification can ADDITIONALLY be fanned out to Teams/WhatsApp by enqueuing
-- outbox rows for the routes configured here.
--
-- Idempotent: safe to re-run.

-- =============================================
-- notification_channel_routes — event -> channel routing config
-- =============================================
CREATE TABLE IF NOT EXISTS notification_channel_routes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NULL sector_id = a global route applied across every sector.
  sector_id     uuid REFERENCES sectors(id),
  -- The notification `type` (matches notifications.type / preferences.type).
  event_type    text NOT NULL,
  -- Outbound channel this event should also dispatch to.
  channel       text NOT NULL
                CHECK (channel IN ('teams', 'whatsapp', 'in_app')),
  is_enabled    boolean NOT NULL DEFAULT true,
  created_by    uuid NOT NULL REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_channel_routes_unique
  ON notification_channel_routes (
    COALESCE(sector_id, '00000000-0000-0000-0000-000000000000'),
    event_type, channel
  );

DROP TRIGGER IF EXISTS trg_notification_channel_routes_updated_at ON notification_channel_routes;
CREATE TRIGGER trg_notification_channel_routes_updated_at
  BEFORE UPDATE ON notification_channel_routes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- notification_outbox — queued outbound deliveries
-- =============================================
CREATE TABLE IF NOT EXISTS notification_outbox (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Sector the dispatch belongs to — used to resolve the credential. May be
  -- NULL for a platform-wide dispatch that uses a global credential.
  sector_id     uuid REFERENCES sectors(id),
  -- Delivery channel — must have a matching integration adapter.
  channel       text NOT NULL
                CHECK (channel IN ('teams', 'whatsapp', 'in_app')),
  -- Free-form target (Teams: unused/channel; WhatsApp: E.164 phone number).
  target        text,
  -- The originating event type, for traceability back to the trigger.
  event_type    text,
  -- Channel-agnostic message payload: { title, body, ...adapter extras }.
  payload       jsonb NOT NULL DEFAULT '{}',
  -- Lifecycle: pending -> sent | failed (after max attempts).
  status        text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'sent', 'failed')),
  attempts      integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  error         text,
  -- Provider's accepted-message id, when the adapter returns one.
  provider_ref  text,
  created_by    uuid NOT NULL REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  sent_at       timestamptz
);

CREATE INDEX IF NOT EXISTS idx_notification_outbox_status
  ON notification_outbox (status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_notification_outbox_sector
  ON notification_outbox (sector_id);
CREATE INDEX IF NOT EXISTS idx_notification_outbox_created_at
  ON notification_outbox (created_at DESC);

DROP TRIGGER IF EXISTS trg_notification_outbox_updated_at ON notification_outbox;
CREATE TRIGGER trg_notification_outbox_updated_at
  BEFORE UPDATE ON notification_outbox
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- RLS
-- =============================================
ALTER TABLE notification_channel_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_outbox ENABLE ROW LEVEL SECURITY;

-- notification_channel_routes — admin / sector-admin managed.
DROP POLICY IF EXISTS "notification_channel_routes_select" ON notification_channel_routes;
CREATE POLICY "notification_channel_routes_select" ON notification_channel_routes
  FOR SELECT TO authenticated
  USING (
    (sector_id IS NULL AND is_global_admin())
    OR (sector_id IS NOT NULL AND user_has_permission(sector_id, 'integration', 'manage'))
  );

DROP POLICY IF EXISTS "notification_channel_routes_insert" ON notification_channel_routes;
CREATE POLICY "notification_channel_routes_insert" ON notification_channel_routes
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND (
      (sector_id IS NULL AND is_global_admin())
      OR (sector_id IS NOT NULL AND user_has_permission(sector_id, 'integration', 'manage'))
    )
  );

DROP POLICY IF EXISTS "notification_channel_routes_update" ON notification_channel_routes;
CREATE POLICY "notification_channel_routes_update" ON notification_channel_routes
  FOR UPDATE TO authenticated
  USING (
    (sector_id IS NULL AND is_global_admin())
    OR (sector_id IS NOT NULL AND user_has_permission(sector_id, 'integration', 'manage'))
  )
  WITH CHECK (
    (sector_id IS NULL AND is_global_admin())
    OR (sector_id IS NOT NULL AND user_has_permission(sector_id, 'integration', 'manage'))
  );

DROP POLICY IF EXISTS "notification_channel_routes_delete" ON notification_channel_routes;
CREATE POLICY "notification_channel_routes_delete" ON notification_channel_routes
  FOR DELETE TO authenticated
  USING (
    (sector_id IS NULL AND is_global_admin())
    OR (sector_id IS NOT NULL AND user_has_permission(sector_id, 'integration', 'manage'))
  );

-- notification_outbox — readable by integration managers (a delivery log).
-- Inserts come from server actions / the service role; the dispatch worker
-- updates rows via the service role (bypasses RLS).
DROP POLICY IF EXISTS "notification_outbox_select" ON notification_outbox;
CREATE POLICY "notification_outbox_select" ON notification_outbox
  FOR SELECT TO authenticated
  USING (
    (sector_id IS NULL AND is_global_admin())
    OR (sector_id IS NOT NULL AND user_has_permission(sector_id, 'integration', 'read'))
  );

DROP POLICY IF EXISTS "notification_outbox_insert" ON notification_outbox;
CREATE POLICY "notification_outbox_insert" ON notification_outbox
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND (
      (sector_id IS NULL AND is_global_admin())
      OR (sector_id IS NOT NULL AND user_has_permission(sector_id, 'integration', 'create'))
    )
  );
