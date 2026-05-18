-- Migration 00196: SLA business-hours schedule + breach escalation actions
--
-- Wave 4 audit S1/S2: the "Horário Comercial" flag is cosmetic — there is no
-- definition of WHAT business hours are, and a rule says nothing about what
-- happens on breach. This migration:
--
--  1. Gives every SLA rule a real weekly business-hours window
--     (timezone-naive start/end + a working-days bitset) so the SLA clock can
--     honour `business_hours_only`.
--  2. Adds a breach action to each rule — `none` / `notify` / `escalate` —
--     plus a warn threshold (% of the window elapsed) so a manager learns of
--     an at-risk ticket before the dashboard banner is the only signal.
--
-- All new columns are nullable or defaulted so existing rows and
-- `sample_data*.sql` keep inserting without change.
--
-- Idempotent: safe to re-run.

-- =============================================
-- 1. Business-hours schedule on sla_rules
-- =============================================
ALTER TABLE sla_rules
  -- IANA timezone the schedule is expressed in.
  ADD COLUMN IF NOT EXISTS business_timezone text NOT NULL
    DEFAULT 'America/Sao_Paulo',
  -- Local working-day start/end as minutes from midnight (e.g. 540 = 09:00).
  ADD COLUMN IF NOT EXISTS business_start_minute int NOT NULL DEFAULT 540
    CHECK (business_start_minute >= 0 AND business_start_minute < 1440),
  ADD COLUMN IF NOT EXISTS business_end_minute int NOT NULL DEFAULT 1080
    CHECK (business_end_minute > 0 AND business_end_minute <= 1440),
  -- Working-days bitset: bit 0 = Sunday ... bit 6 = Saturday. 62 = Mon-Fri.
  ADD COLUMN IF NOT EXISTS business_days_mask int NOT NULL DEFAULT 62
    CHECK (business_days_mask >= 0 AND business_days_mask <= 127),
  -- Breach action: none = dashboard only; notify = write a support
  -- notification; escalate = notify + flag for escalation review.
  ADD COLUMN IF NOT EXISTS breach_action text NOT NULL DEFAULT 'none'
    CHECK (breach_action IN ('none', 'notify', 'escalate')),
  -- Warn threshold: % of the SLA window elapsed at which a warning fires.
  ADD COLUMN IF NOT EXISTS warn_threshold_pct int NOT NULL DEFAULT 80
    CHECK (warn_threshold_pct > 0 AND warn_threshold_pct <= 100);

-- A rule's window must be coherent (end strictly after start).
ALTER TABLE sla_rules DROP CONSTRAINT IF EXISTS sla_rules_business_window_chk;
ALTER TABLE sla_rules ADD CONSTRAINT sla_rules_business_window_chk
  CHECK (business_end_minute > business_start_minute);

-- =============================================
-- 2. Breach-action bookkeeping on support_tickets
-- =============================================
ALTER TABLE support_tickets
  -- Timestamp the SLA breach escalation action was last applied, so the
  -- breach sweep is idempotent and never double-notifies.
  ADD COLUMN IF NOT EXISTS sla_breach_actioned_at timestamptz;

-- =============================================
-- 3. Widen support_notifications so the breach sweep can record a warning
--    that fires BEFORE a full breach (Wave 4 S2 "warn-at-X%").
-- =============================================
ALTER TABLE support_notifications
  DROP CONSTRAINT IF EXISTS support_notifications_type_check;
ALTER TABLE support_notifications
  ADD CONSTRAINT support_notifications_type_check
  CHECK (type IN ('sla_warning', 'sla_breach', 'sla_escalation'));
