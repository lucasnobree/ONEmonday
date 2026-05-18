-- =============================================
-- Migration 00179: Legal — automated renewal notifications
-- Implements the deferred Legal backlog (docs/research/ux-audit-legal.md
-- item #4 "automated renewal notifications").
--
-- The renewal/notice-window detection already exists (lib/legal/renewal.ts);
-- this migration wires it to a delivery channel:
--   * adds `renewal_notified_at` to legal_contracts so the worker dispatches a
--     renewal alert AT MOST ONCE per contract (idempotent re-runs are a no-op).
--   * `get_contracts_needing_renewal_notice` — an RPC the worker calls to find
--     contracts that have entered the termination-notice window and not yet
--     been alerted.
--   * a default `contract_renewal` route into `notification_channel_routes`
--     (the Phase-1 integration layer, migration 00103) so a configured Teams /
--     WhatsApp channel also receives the alert.
--   * a `pg_cron` job that POSTs the renewal-scan route daily.
--
-- The in-app `notifications` table (migration 00003) is untouched: the worker
-- inserts in-app rows directly and ADDITIONALLY enqueues outbox rows.
--
-- Idempotent: safe to run more than once.
-- =============================================

-- ---------------------------------------------
-- 1. Track when a renewal alert was last dispatched for a contract
-- ---------------------------------------------
ALTER TABLE legal_contracts
  ADD COLUMN IF NOT EXISTS renewal_notified_at timestamptz;

-- ---------------------------------------------
-- 2. RPC: contracts that have entered the notice window and not been alerted
-- ---------------------------------------------
-- A contract "needs a renewal notice" when:
--   * it is active/approved and still tracked (is_active),
--   * it has an expiry date,
--   * today is at or past `expiry_date - notice_period_days` (notice window
--     open) — mirrors getRenewalStatus()'s `notice`/`expired` classification,
--   * a renewal alert has not already been dispatched for it.
-- SECURITY DEFINER so the service-role worker and an admin can both call it.
CREATE OR REPLACE FUNCTION get_contracts_needing_renewal_notice()
RETURNS TABLE (
  contract_id     uuid,
  sector_id       uuid,
  title           text,
  counterparty    text,
  owner_id        uuid,
  created_by      uuid,
  expiry_date     date,
  notice_period_days int,
  days_until_expiry  int
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.sector_id,
    c.title,
    c.counterparty,
    c.owner_id,
    c.created_by,
    c.expiry_date,
    c.notice_period_days,
    (c.expiry_date - CURRENT_DATE)::int AS days_until_expiry
  FROM legal_contracts c
  WHERE c.is_active = true
    AND c.status IN ('active', 'approved')
    AND c.expiry_date IS NOT NULL
    AND c.renewal_notified_at IS NULL
    AND CURRENT_DATE >= (c.expiry_date - make_interval(days => c.notice_period_days))
  ORDER BY c.expiry_date ASC;
$$;

-- ---------------------------------------------
-- 3. Default channel route for the renewal event
-- ---------------------------------------------
-- A global in_app route guarantees the event is recognised by the dispatch
-- layer even before an admin configures Teams / WhatsApp. The worker also
-- writes the in-app notification directly, so this row is mainly a marker that
-- keeps `enqueueEventDispatch` from treating the event as unrouted.
INSERT INTO notification_channel_routes (sector_id, event_type, channel, is_enabled, created_by)
SELECT NULL, 'contract_renewal', 'in_app', true, u.id
FROM users u
WHERE u.id = (SELECT id FROM users ORDER BY created_at ASC LIMIT 1)
ON CONFLICT (
  COALESCE(sector_id, '00000000-0000-0000-0000-000000000000'),
  event_type, channel
) DO NOTHING;

-- ---------------------------------------------
-- 4. Schedule the daily renewal scan
-- ---------------------------------------------
-- Reuses the trigger_cron_route helper + cron_settings config from 00137.
-- Renewal windows move in days, so a daily scan (08:00 UTC) is ample.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'onemonday-legal-renewals') THEN
    PERFORM cron.unschedule('onemonday-legal-renewals');
  END IF;
  PERFORM cron.schedule(
    'onemonday-legal-renewals',
    '0 8 * * *',
    $cron$ SELECT trigger_cron_route('/api/cron/legal-renewals'); $cron$
  );
EXCEPTION
  WHEN undefined_table OR undefined_function OR insufficient_privilege THEN
    RAISE NOTICE 'pg_cron unavailable — legal-renewals job not registered.';
END;
$$;
