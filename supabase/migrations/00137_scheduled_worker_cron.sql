-- =============================================
-- Migration 00137: Scheduled automation runtime (pg_cron + pg_net)
-- Total-migration roadmap (docs/research/migration-architecture.md §1, the
-- "background job runner (pg_cron / scheduled fn)" row of the runtime table).
--
-- Several phases built a worker entrypoint but deferred the scheduler itself:
--   * Phase 1 — `runOutboxDispatch` drains the notification outbox (00103).
--   * Phase 5 — `runDueSequenceSteps` advances marketing sequences (00114).
-- Each was reachable only by a manual "Processar agora" button. This migration
-- adds the missing piece: it enables `pg_cron` (in-database scheduler) and
-- `pg_net` (async HTTP from SQL), and registers cron jobs that `POST` to the
-- internal Next.js cron routes:
--   * /api/cron/dispatch-outbox  — every minute   (outbox is latency-sensitive)
--   * /api/cron/run-sequences    — every 15 min   (sequences advance in days)
--
-- The routes are guarded by a shared secret (`CRON_SECRET`); the cron job
-- presents it as an `Authorization: Bearer` header. Neither the target base
-- URL nor the secret is hardcoded — both are read from the `cron_settings`
-- config table below, so a deploy configures them with one UPDATE rather than
-- by editing this migration.
--
-- Honest scope: in local dev, pg_cron -> pg_net reaching the Next.js app
-- depends on the database container being able to resolve the app's host.
-- The migration and routes are correct; going live needs the production base
-- URL + secret set in `cron_settings` (see the final UPDATE comment).
--
-- Idempotent: safe to re-run.
-- =============================================

-- =============================================
-- Extensions — the in-database scheduler and async HTTP client.
-- On Supabase both ship preinstalled into the `extensions` schema; CREATE
-- EXTENSION IF NOT EXISTS is a no-op when already present.
-- =============================================
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- =============================================
-- cron_settings — runtime configuration for the scheduled jobs.
-- A single-row key/value table: the base URL the cron jobs POST to and the
-- shared secret they authenticate with. Kept out of this migration's code so
-- the same migration runs unchanged in dev / staging / prod.
-- =============================================
CREATE TABLE IF NOT EXISTS cron_settings (
  -- Enforces the single-row invariant: the row always has id = true.
  id          boolean PRIMARY KEY DEFAULT true CHECK (id),
  -- Base URL of the Next.js app, no trailing slash, e.g. https://app.example.com
  -- The placeholder default keeps dev safe — a job firing against it is a
  -- harmless connection failure, never a misdirected real request.
  base_url    text NOT NULL DEFAULT 'http://localhost:3000',
  -- Must equal the app's `CRON_SECRET` env var. Sent as a bearer token; the
  -- route rejects a request whose secret does not match with 401.
  cron_secret text NOT NULL DEFAULT '',
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Seed the single config row (no-op once it exists).
INSERT INTO cron_settings (id) VALUES (true)
  ON CONFLICT (id) DO NOTHING;

-- RLS: this row holds the cron shared secret — only global admins may read or
-- change it. The cron jobs run as the table owner (SECURITY DEFINER context of
-- pg_cron), bypassing RLS, so locking the table to admins does not break them.
ALTER TABLE cron_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cron_settings_select" ON cron_settings;
CREATE POLICY "cron_settings_select" ON cron_settings
  FOR SELECT TO authenticated
  USING (is_global_admin());

DROP POLICY IF EXISTS "cron_settings_update" ON cron_settings;
CREATE POLICY "cron_settings_update" ON cron_settings
  FOR UPDATE TO authenticated
  USING (is_global_admin())
  WITH CHECK (is_global_admin());

-- =============================================
-- Trigger a cron route — a helper that reads `cron_settings` and fires one
-- async HTTP POST via pg_net. Centralising it keeps each cron job a one-liner
-- and means a config change needs no job re-registration.
-- =============================================
CREATE OR REPLACE FUNCTION trigger_cron_route(route_path text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  cfg cron_settings%ROWTYPE;
BEGIN
  SELECT * INTO cfg FROM cron_settings WHERE id = true;
  IF cfg IS NULL THEN
    RAISE NOTICE 'cron_settings not configured — skipping %', route_path;
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := cfg.base_url || route_path,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || cfg.cron_secret
    ),
    body    := '{}'::jsonb
  );
END;
$$;

-- =============================================
-- Register the cron jobs. cron.schedule is upsert-by-name on modern pg_cron,
-- but to stay idempotent on every version we unschedule any prior job of the
-- same name first (cron.unschedule throws if the job is absent, so guard it).
-- =============================================
DO $$
BEGIN
  -- Outbox dispatch — every minute.
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'onemonday-dispatch-outbox') THEN
    PERFORM cron.unschedule('onemonday-dispatch-outbox');
  END IF;
  PERFORM cron.schedule(
    'onemonday-dispatch-outbox',
    '* * * * *',
    $cron$ SELECT trigger_cron_route('/api/cron/dispatch-outbox'); $cron$
  );

  -- Marketing-sequence runner — every 15 minutes.
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'onemonday-run-sequences') THEN
    PERFORM cron.unschedule('onemonday-run-sequences');
  END IF;
  PERFORM cron.schedule(
    'onemonday-run-sequences',
    '*/15 * * * *',
    $cron$ SELECT trigger_cron_route('/api/cron/run-sequences'); $cron$
  );
EXCEPTION
  WHEN undefined_table OR insufficient_privilege THEN
    -- pg_cron's `cron` schema is unavailable (e.g. a managed environment
    -- where the extension is provisioned out-of-band, or a local stack
    -- without it). The routes still work for the manual path; only the
    -- automatic scheduling is skipped. Re-running this migration once
    -- pg_cron is present registers the jobs.
    RAISE NOTICE 'pg_cron schema unavailable — cron jobs not registered.';
END;
$$;

-- =============================================
-- ACTIVATION (run once per environment — NOT part of this migration):
--
--   UPDATE cron_settings SET
--     base_url    = 'https://your-app-host',   -- the deployed Next.js origin
--     cron_secret = '<the CRON_SECRET value>', -- must match the app env var
--     updated_at  = now()
--   WHERE id = true;
--
-- And set `CRON_SECRET` (server-only, never NEXT_PUBLIC_) in the app
-- environment to the same value. Until both are set the jobs fire against the
-- localhost placeholder / empty secret and the routes answer 401 — harmless.
-- =============================================
