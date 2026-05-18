-- =============================================
-- Migration 00185: CRM Wave 5 — lead operations
-- The "High-impact backlog" the Wave 4 quick-wins pass deferred
-- (docs/research/ux-audit-crm-wave4.md backlog #5/#6/#7):
--
--   * #5 Field-to-property mapping — a capture form's fields now carry an
--     optional `map` tag (name/email/phone/company). No schema change is
--     needed for this: `crm_lead_forms.fields` is already a free-form jsonb
--     array, and the new `map` key is validated in app code
--     (lib/validations/crm.ts) and applied by `mapSubmissionToLead`. This
--     migration only documents it.
--
--   * #6 Lead ownership & SLA aging — `crm_leads.owner_id` already exists
--     (migration 00128). This migration adds a per-sector SLA setting so a
--     sector can define how many hours an untouched lead may sit in 'new'
--     before the inbox flags it as overdue.
--
--   * #7 Message templates — a new `crm_message_templates` table: reusable
--     WhatsApp / email snippets, scoped per sector, with `{{variable}}`
--     placeholders the deal Communication panel substitutes from the linked
--     contact/deal/company.
--
-- Idempotent: safe to re-run. RLS enabled on every new table.
-- =============================================

-- =============================================
-- Permission resource — message_template
-- Registered against the existing 'crm' module.
-- =============================================
INSERT INTO permissions (module_id, resource, action)
SELECT m.id, 'message_template', a
FROM modules m,
     unnest(ARRAY['create', 'read', 'update', 'delete', 'manage']) AS a
WHERE m.slug = 'crm'
ON CONFLICT (module_id, resource, action) DO NOTHING;

-- Admin + manager get full control.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
JOIN modules m ON p.module_id = m.id
WHERE r.slug IN ('admin', 'manager')
AND p.resource = 'message_template'
AND m.slug = 'crm'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Analyst can create/read/update (sales reps maintain their own snippets).
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
JOIN modules m ON p.module_id = m.id
WHERE r.slug = 'analyst'
AND p.resource = 'message_template'
AND p.action IN ('create', 'read', 'update')
AND m.slug = 'crm'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Intern is read-only.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
JOIN modules m ON p.module_id = m.id
WHERE r.slug = 'intern'
AND p.resource = 'message_template'
AND p.action = 'read'
AND m.slug = 'crm'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- =============================================
-- crm_leads — SLA setting per sector.
-- `lead_sla_hours` on the sector says how long a lead may sit untouched in
-- 'new' before the inbox flags it overdue. 0 disables the indicator.
-- Stored on `sectors` (a single column) rather than a new table because it
-- is one scalar tuning knob, not a list.
-- =============================================
ALTER TABLE sectors
  ADD COLUMN IF NOT EXISTS crm_lead_sla_hours int NOT NULL DEFAULT 24
    CHECK (crm_lead_sla_hours >= 0 AND crm_lead_sla_hours <= 720);

COMMENT ON COLUMN sectors.crm_lead_sla_hours IS
  'CRM Leads inbox SLA: hours an untouched ''new'' lead may age before the '
  'inbox flags it overdue. 0 disables the aging indicator.';

-- =============================================
-- crm_message_templates — reusable WhatsApp / email snippets.
-- `body` may carry {{variable}} placeholders the Communication panel
-- substitutes (e.g. {{contato.nome}}, {{empresa.nome}}, {{deal.titulo}}).
-- A template is scoped to ONE channel so the panel only offers WhatsApp
-- templates in the WhatsApp composer and email templates in the email one.
-- =============================================
CREATE TABLE IF NOT EXISTS crm_message_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id   uuid NOT NULL REFERENCES sectors(id),
  -- Which composer offers this template.
  channel     text NOT NULL CHECK (channel IN ('whatsapp', 'email')),
  -- Short human label shown in the template picker.
  name        text NOT NULL,
  -- Email subject line. Required for email templates, NULL for WhatsApp.
  subject     text,
  -- The message body, with optional {{variable}} placeholders.
  body        text NOT NULL,
  created_by  uuid NOT NULL REFERENCES users(id),
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  -- An email template must carry a subject; a WhatsApp template must not.
  CHECK (
    (channel = 'email' AND subject IS NOT NULL)
    OR (channel = 'whatsapp' AND subject IS NULL)
  )
);

DROP TRIGGER IF EXISTS trg_crm_message_templates_updated_at
  ON crm_message_templates;
CREATE TRIGGER trg_crm_message_templates_updated_at
  BEFORE UPDATE ON crm_message_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_crm_message_templates_sector
  ON crm_message_templates (sector_id, channel)
  WHERE is_active = true;

ALTER TABLE crm_message_templates ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS Policies — crm_message_templates
-- Authenticated, per-sector and permission-scoped, like every other CRM table.
-- =============================================
DROP POLICY IF EXISTS "crm_message_templates_select" ON crm_message_templates;
CREATE POLICY "crm_message_templates_select" ON crm_message_templates
  FOR SELECT TO authenticated
  USING (is_active = true AND user_has_sector_access(sector_id));

DROP POLICY IF EXISTS "crm_message_templates_insert" ON crm_message_templates;
CREATE POLICY "crm_message_templates_insert" ON crm_message_templates
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND user_has_permission(sector_id, 'message_template', 'create')
  );

DROP POLICY IF EXISTS "crm_message_templates_update" ON crm_message_templates;
CREATE POLICY "crm_message_templates_update" ON crm_message_templates
  FOR UPDATE TO authenticated
  USING (user_has_permission(sector_id, 'message_template', 'update'))
  WITH CHECK (user_has_permission(sector_id, 'message_template', 'update'));

DROP POLICY IF EXISTS "crm_message_templates_delete" ON crm_message_templates;
CREATE POLICY "crm_message_templates_delete" ON crm_message_templates
  FOR DELETE TO authenticated
  USING (user_has_permission(sector_id, 'message_template', 'delete'));

-- =============================================
-- RPC: get_crm_lead_aging
-- Counts of untouched 'new' leads for a sector, split by whether they have
-- breached the sector's `crm_lead_sla_hours`. Powers the inbox SLA KPI.
-- SECURITY DEFINER — search_path pinned per the project security baseline.
-- =============================================
CREATE OR REPLACE FUNCTION get_crm_lead_aging(p_sector_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sla_hours int;
  result json;
BEGIN
  IF NOT user_has_sector_access(p_sector_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT crm_lead_sla_hours INTO v_sla_hours
  FROM sectors WHERE id = p_sector_id;

  SELECT json_build_object(
    'sla_hours', COALESCE(v_sla_hours, 0),
    'untouched', (
      SELECT COUNT(*) FROM crm_leads
      WHERE sector_id = p_sector_id
        AND is_active = true
        AND status = 'new'
    ),
    'overdue', (
      SELECT COUNT(*) FROM crm_leads
      WHERE sector_id = p_sector_id
        AND is_active = true
        AND status = 'new'
        AND COALESCE(v_sla_hours, 0) > 0
        AND created_at < now() - make_interval(hours => v_sla_hours)
    )
  ) INTO result;

  RETURN result;
END;
$$;
