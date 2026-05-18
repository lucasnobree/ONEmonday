-- =============================================
-- Migration 00183: Core/Analytics — seeded default reports
-- Implements the deferred Core Wave 4 backlog (docs/research/
-- ux-audit-core-wave4.md item #5 "Seed/ship default Analytics reports").
-- Analytics today ships with an empty "Relatórios Salvos" box, so the screen
-- has no value until a user manually builds a report.
--
-- This migration:
--   * marks `analytics_reports` rows with `is_default` so seeded reports can
--     be distinguished from user-created ones (and re-seeding is idempotent);
--   * `seed_default_analytics_reports(p_sector_id)` — inserts the standard
--     set of three default reports for one sector if they are missing. It
--     uses a NULL `created_by` because seeded reports have no human author;
--   * back-fills every existing sector;
--   * a trigger so a newly created sector also gets the default reports.
--
-- The three defaults mirror the metric catalog (lib/analytics/metrics.ts):
-- cards completed, deal value won, tickets resolved — all line charts over a
-- 180-day window.
--
-- Idempotent: safe to run more than once.
-- =============================================

-- ---------------------------------------------
-- 1. Mark seeded reports + allow a NULL author
-- ---------------------------------------------
ALTER TABLE analytics_reports
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

-- Seeded reports have no human author. Drop the NOT NULL so the seeder can
-- insert a system-owned row; user-created rows still set created_by from the
-- insert RLS policy.
ALTER TABLE analytics_reports
  ALTER COLUMN created_by DROP NOT NULL;

-- One default report per (sector, metric) — the unique index makes the
-- seeder's ON CONFLICT a true no-op on re-run.
CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_reports_default_metric
  ON analytics_reports(sector_id, metric)
  WHERE is_default = true;

-- ---------------------------------------------
-- 2. Seeder — inserts the default report set for one sector
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION seed_default_analytics_reports(p_sector_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO analytics_reports
    (sector_id, name, description, metric, chart_type, group_by,
     date_range_days, is_default, created_by)
  VALUES
    (p_sector_id, 'Cards concluídos por mês',
     'Evolução de cards concluídos nos últimos 6 meses.',
     'cards_completed', 'line', 'month', 180, true, NULL),
    (p_sector_id, 'Valor de negócios ganhos',
     'Valor total de negócios fechados por mês.',
     'deals_won_value_cents', 'bar', 'month', 180, true, NULL),
    (p_sector_id, 'Tickets resolvidos por mês',
     'Tickets de suporte resolvidos nos últimos 6 meses.',
     'tickets_resolved', 'line', 'month', 180, true, NULL)
  ON CONFLICT (sector_id, metric) WHERE is_default = true
  DO NOTHING;
END;
$$;

-- ---------------------------------------------
-- 3. Back-fill every existing sector
-- ---------------------------------------------
DO $$
DECLARE
  v_sector_id uuid;
BEGIN
  FOR v_sector_id IN SELECT id FROM sectors LOOP
    PERFORM seed_default_analytics_reports(v_sector_id);
  END LOOP;
END $$;

-- ---------------------------------------------
-- 4. Trigger — a new sector gets the default reports automatically
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION trg_seed_sector_analytics_reports()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM seed_default_analytics_reports(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sectors_seed_analytics_reports ON sectors;
CREATE TRIGGER trg_sectors_seed_analytics_reports
  AFTER INSERT ON sectors
  FOR EACH ROW
  EXECUTE FUNCTION trg_seed_sector_analytics_reports();
