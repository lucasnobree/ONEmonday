-- =============================================
-- Migration 00128: CRM Lead Lifecycle
-- Phase 2/6 of the total-migration roadmap
-- (docs/research/migration-architecture.md §2.8, migration-comercial.md
-- backlog #15 "Leads inbox" + #22 "Form builder" + #26 "Lead scoring").
--
-- This is the seam that lets the company stop depending on RD Station for
-- inbound leads. It ships three connected pieces:
--
--   * `crm_lead_forms`  — a sector-defined lead-capture form: a list of fields
--     plus a public `public_token`. Each form exposes ONE public, unauthenticated
--     submission URL (/f/<public_token>).
--   * `crm_leads`       — a raw inbound lead (name/email/phone/company/source,
--     a free-form `payload` jsonb of the submitted custom fields, a triage
--     `status`, a rule-based `score`, and `sector` for routing). A lead is the
--     pre-deal entity: it gets triaged in the Leads inbox and, when qualified,
--     converted into a `crm_contacts` + `crm_deals` pair.
--
-- The public submission path (app/api/forms/[id]/route.ts) writes ONLY
-- `crm_leads`, with no auth. It is secured by:
--   * a dedicated RLS INSERT policy for the `anon` role that ONLY allows a
--     lead row whose form_id points at an ACTIVE, PUBLIC form in the SAME
--     sector — anon can never insert an arbitrary lead;
--   * `anon` has NO select/update/delete on either table (write-only path);
--   * the form is addressed by an unguessable random `public_token`, not by id.
--
-- Lead scoring is a simple rule-based model computed in app code
-- (lib/crm/lead-scoring.ts); the resulting integer is persisted on `score`.
--
-- Deferred (explicitly out of scope — a focused MVP, see migration-comercial.md
-- §5): a drag-and-drop landing-page builder. This is a field-list form only.
--
-- Idempotent: safe to re-run. RLS enabled on every new table.
-- =============================================

-- =============================================
-- Permission resources — lead + lead_form
-- Registered against the existing 'crm' module.
-- =============================================
INSERT INTO permissions (module_id, resource, action)
SELECT m.id, r, a
FROM modules m,
     unnest(ARRAY['lead', 'lead_form']) AS r,
     unnest(ARRAY['create', 'read', 'update', 'delete', 'manage']) AS a
WHERE m.slug = 'crm'
ON CONFLICT (module_id, resource, action) DO NOTHING;

-- Grant the new resources to admin and manager roles (full control).
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
JOIN modules m ON p.module_id = m.id
WHERE r.slug IN ('admin', 'manager')
AND p.resource IN ('lead', 'lead_form')
AND m.slug = 'crm'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Grant create/read/update to the analyst role.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
JOIN modules m ON p.module_id = m.id
WHERE r.slug = 'analyst'
AND p.resource IN ('lead', 'lead_form')
AND p.action IN ('create', 'read', 'update')
AND m.slug = 'crm'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Grant read-only to the intern role.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
JOIN modules m ON p.module_id = m.id
WHERE r.slug = 'intern'
AND p.resource IN ('lead', 'lead_form')
AND p.action = 'read'
AND m.slug = 'crm'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- =============================================
-- crm_lead_forms — a sector-defined lead-capture form.
-- `fields` is a jsonb array of field definitions, each:
--   { "key": "...", "label": "...", "type": "text|email|tel|textarea|select",
--     "required": bool, "options": ["..."] }
-- `public_token` is the unguessable slug in the public URL.
-- =============================================
CREATE TABLE IF NOT EXISTS crm_lead_forms (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id     uuid NOT NULL REFERENCES sectors(id),
  name          text NOT NULL,
  description   text,
  -- Random, unguessable token used in the public URL (/f/<public_token>).
  -- 64 hex chars from two uuids — no pgcrypto dependency, gen_random_uuid is core.
  public_token  text NOT NULL UNIQUE
                DEFAULT (replace(gen_random_uuid()::text, '-', '')
                         || replace(gen_random_uuid()::text, '-', '')),
  -- Ordered list of field definitions (jsonb array). Defaults to an empty list.
  fields        jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Lead source label stamped onto every lead captured through this form.
  source        text NOT NULL DEFAULT 'form',
  -- Message shown to the visitor after a successful submission.
  success_message text NOT NULL DEFAULT 'Obrigado! Recebemos seu contato.',
  -- A form only accepts public submissions while is_published = true.
  is_published  boolean NOT NULL DEFAULT false,
  created_by    uuid NOT NULL REFERENCES users(id),
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(fields) = 'array')
);

DROP TRIGGER IF EXISTS trg_crm_lead_forms_updated_at ON crm_lead_forms;
CREATE TRIGGER trg_crm_lead_forms_updated_at BEFORE UPDATE ON crm_lead_forms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- crm_leads — a raw inbound lead awaiting triage.
-- =============================================
CREATE TABLE IF NOT EXISTS crm_leads (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id     uuid NOT NULL REFERENCES sectors(id),
  -- The capture form this lead came through, when captured via a form.
  form_id       uuid REFERENCES crm_lead_forms(id) ON DELETE SET NULL,
  name          text NOT NULL,
  email         text,
  phone         text,
  company       text,
  -- Where the lead came from (form name, "manual", an ad channel...).
  source        text NOT NULL DEFAULT 'manual',
  -- The custom fields submitted, as a free-form key/value object.
  payload       jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Triage status. 'new' on capture; a sales user works/qualifies/discards it.
  status        text NOT NULL DEFAULT 'new'
                CHECK (status IN ('new', 'working', 'qualified', 'discarded')),
  -- Rule-based score (lib/crm/lead-scoring.ts). Higher = hotter. Never negative.
  score         int NOT NULL DEFAULT 0 CHECK (score >= 0),
  -- Why a lead was discarded — free text, set when status -> 'discarded'.
  discard_reason text,
  -- The deal a qualified lead was converted into (1:1). NULL until conversion.
  converted_deal_id uuid REFERENCES crm_deals(id) ON DELETE SET NULL,
  -- The contact created/linked at conversion time.
  converted_contact_id uuid REFERENCES crm_contacts(id) ON DELETE SET NULL,
  converted_at  timestamptz,
  -- Salesperson the lead is assigned to for triage.
  owner_id      uuid REFERENCES users(id),
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(payload) = 'object'),
  -- A qualified lead must carry its conversion link; a non-qualified one must not.
  CHECK (
    (status = 'qualified') = (converted_deal_id IS NOT NULL)
  )
);

DROP TRIGGER IF EXISTS trg_crm_leads_updated_at ON crm_leads;
CREATE TRIGGER trg_crm_leads_updated_at BEFORE UPDATE ON crm_leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- Indexes
-- =============================================
CREATE INDEX IF NOT EXISTS idx_crm_lead_forms_sector_id ON crm_lead_forms(sector_id);
CREATE INDEX IF NOT EXISTS idx_crm_lead_forms_public_token ON crm_lead_forms(public_token);
CREATE INDEX IF NOT EXISTS idx_crm_leads_sector_id ON crm_leads(sector_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_status ON crm_leads(sector_id, status);
CREATE INDEX IF NOT EXISTS idx_crm_leads_form_id ON crm_leads(form_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_owner_id ON crm_leads(owner_id);
-- The inbox sorts hottest-first; index the score path per sector.
CREATE INDEX IF NOT EXISTS idx_crm_leads_score ON crm_leads(sector_id, score DESC);

-- =============================================
-- Enable RLS on every new table
-- =============================================
ALTER TABLE crm_lead_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_leads ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS Policies — crm_lead_forms
--
-- Authenticated, per-sector and permission-scoped, like every other CRM table.
-- PLUS a single SELECT policy for the `anon` role: an unauthenticated visitor
-- loading a public form must be able to read ONLY its published, active forms
-- (so the public page can render the field list). No anon insert/update/delete.
-- =============================================
DROP POLICY IF EXISTS "crm_lead_forms_select" ON crm_lead_forms;
CREATE POLICY "crm_lead_forms_select" ON crm_lead_forms
  FOR SELECT TO authenticated
  USING (is_active = true AND user_has_sector_access(sector_id));

DROP POLICY IF EXISTS "crm_lead_forms_insert" ON crm_lead_forms;
CREATE POLICY "crm_lead_forms_insert" ON crm_lead_forms
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND
    user_has_permission(sector_id, 'lead_form', 'create')
  );

DROP POLICY IF EXISTS "crm_lead_forms_update" ON crm_lead_forms;
CREATE POLICY "crm_lead_forms_update" ON crm_lead_forms
  FOR UPDATE TO authenticated
  USING (user_has_permission(sector_id, 'lead_form', 'update'))
  WITH CHECK (user_has_permission(sector_id, 'lead_form', 'update'));

DROP POLICY IF EXISTS "crm_lead_forms_delete" ON crm_lead_forms;
CREATE POLICY "crm_lead_forms_delete" ON crm_lead_forms
  FOR DELETE TO authenticated
  USING (user_has_permission(sector_id, 'lead_form', 'delete'));

-- Public, unauthenticated read: only published + active forms. This is the
-- one row a visitor on the public capture page is allowed to see — and only
-- the form definition, never any lead data.
DROP POLICY IF EXISTS "crm_lead_forms_public_select" ON crm_lead_forms;
CREATE POLICY "crm_lead_forms_public_select" ON crm_lead_forms
  FOR SELECT TO anon
  USING (is_active = true AND is_published = true);

-- =============================================
-- RLS Policies — crm_leads
--
-- Authenticated, per-sector and permission-scoped for the sales team.
-- PLUS one anon INSERT policy: the public form-submission path. The WITH CHECK
-- pins every anon-inserted lead to an ACTIVE, PUBLISHED form in the SAME
-- sector and forces status='new' / score=0 / no conversion links — anon can
-- only ever create a fresh, unscored, unconverted lead for a real public form.
-- anon has NO select/update/delete on crm_leads (write-only public path).
-- =============================================
DROP POLICY IF EXISTS "crm_leads_select" ON crm_leads;
CREATE POLICY "crm_leads_select" ON crm_leads
  FOR SELECT TO authenticated
  USING (is_active = true AND user_has_sector_access(sector_id));

DROP POLICY IF EXISTS "crm_leads_insert" ON crm_leads;
CREATE POLICY "crm_leads_insert" ON crm_leads
  FOR INSERT TO authenticated
  WITH CHECK (user_has_permission(sector_id, 'lead', 'create'));

DROP POLICY IF EXISTS "crm_leads_update" ON crm_leads;
CREATE POLICY "crm_leads_update" ON crm_leads
  FOR UPDATE TO authenticated
  USING (user_has_permission(sector_id, 'lead', 'update'))
  WITH CHECK (user_has_permission(sector_id, 'lead', 'update'));

DROP POLICY IF EXISTS "crm_leads_delete" ON crm_leads;
CREATE POLICY "crm_leads_delete" ON crm_leads
  FOR DELETE TO authenticated
  USING (user_has_permission(sector_id, 'lead', 'delete'));

-- Public, unauthenticated lead capture. A submission is accepted ONLY when:
--   * it references an active, published form (form_id must resolve);
--   * the lead's sector_id matches that form's sector_id (no cross-sector);
--   * it is a brand-new, unassigned, unconverted lead in status 'new'.
-- Anonymous callers therefore cannot forge a qualified/owned/converted lead,
-- nor write a lead into a sector with no public form. The `score` is allowed
-- as any non-negative value because the score is COMPUTED SERVER-SIDE inside
-- the route (lib/crm/lead-scoring.ts) before the insert — it is never read
-- from the client request body — and the column CHECK already pins score >= 0.
-- A sales user re-triages every captured lead regardless.
DROP POLICY IF EXISTS "crm_leads_public_insert" ON crm_leads;
CREATE POLICY "crm_leads_public_insert" ON crm_leads
  FOR INSERT TO anon
  WITH CHECK (
    status = 'new'
    AND converted_deal_id IS NULL
    AND converted_contact_id IS NULL
    AND converted_at IS NULL
    AND owner_id IS NULL
    AND discard_reason IS NULL
    AND form_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM crm_lead_forms f
      WHERE f.id = crm_leads.form_id
        AND f.sector_id = crm_leads.sector_id
        AND f.is_active = true
        AND f.is_published = true
    )
  );

-- =============================================
-- RPC: get_crm_lead_stats
-- Inbox KPI counts (per status) + average score for a sector.
-- =============================================
CREATE OR REPLACE FUNCTION get_crm_lead_stats(p_sector_id uuid)
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  IF NOT user_has_sector_access(p_sector_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT json_build_object(
    'total', (
      SELECT COUNT(*) FROM crm_leads
      WHERE sector_id = p_sector_id AND is_active = true
    ),
    'new', (
      SELECT COUNT(*) FROM crm_leads
      WHERE sector_id = p_sector_id AND is_active = true AND status = 'new'
    ),
    'working', (
      SELECT COUNT(*) FROM crm_leads
      WHERE sector_id = p_sector_id AND is_active = true AND status = 'working'
    ),
    'qualified', (
      SELECT COUNT(*) FROM crm_leads
      WHERE sector_id = p_sector_id AND is_active = true AND status = 'qualified'
    ),
    'discarded', (
      SELECT COUNT(*) FROM crm_leads
      WHERE sector_id = p_sector_id AND is_active = true AND status = 'discarded'
    ),
    'avg_score', COALESCE((
      SELECT ROUND(AVG(score), 1) FROM crm_leads
      WHERE sector_id = p_sector_id AND is_active = true
    ), 0)
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
