-- =============================================
-- Migration 00105: CRM Activity / Task Management
-- Phase 2 of the total-migration roadmap (docs/research/migration-comercial.md
-- backlog #3, ux-audit-crm.md A1/A2).
--
-- `crm_activities` already has `scheduled_at` and `completed_at` columns
-- (migration 00011) but the app never used them — every activity was an
-- immutable "now" log entry. Pipedrive's activity model — scheduled, overdue,
-- done — is core CRM. This migration:
--
--   * adds `assigned_to` so a task can be scheduled for a specific rep
--     (distinct from `performed_by`, who logged/performed it);
--   * adds indexes that make the "open / overdue / today" views fast;
--   * widens the UPDATE RLS policy so a user can complete a task assigned to
--     them, not only one they performed.
--
-- No new table — the columns exist; this is additive + idempotent.
-- =============================================

-- The rep a scheduled task is assigned to. Nullable: a logged historical
-- activity (a past call) has no assignee, only a `performed_by`.
ALTER TABLE crm_activities
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES users(id);

-- Backfill: an open task (scheduled, not completed) defaults its assignee to
-- whoever created it, so existing scheduled tasks are not orphaned.
UPDATE crm_activities
  SET assigned_to = performed_by
  WHERE assigned_to IS NULL
    AND scheduled_at IS NOT NULL
    AND completed_at IS NULL;

-- "Open tasks" / "overdue" / "today" all filter on scheduled_at among
-- not-yet-completed rows — a partial index keeps those views cheap.
CREATE INDEX IF NOT EXISTS idx_crm_activities_open_tasks
  ON crm_activities (sector_id, scheduled_at)
  WHERE completed_at IS NULL AND scheduled_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_activities_assigned_to
  ON crm_activities (assigned_to);

-- Widen UPDATE: the assignee of a task must be able to complete / reschedule
-- it, even if someone else created the task. Mirrors the original policy
-- (performed_by OR crm_activity:update permission) plus the assignee.
DROP POLICY IF EXISTS "crm_activities_update" ON crm_activities;
CREATE POLICY "crm_activities_update" ON crm_activities
  FOR UPDATE TO authenticated
  USING (
    performed_by = auth.uid()
    OR assigned_to = auth.uid()
    OR user_has_permission(sector_id, 'crm_activity', 'update')
  )
  WITH CHECK (
    performed_by = auth.uid()
    OR assigned_to = auth.uid()
    OR user_has_permission(sector_id, 'crm_activity', 'update')
  );
