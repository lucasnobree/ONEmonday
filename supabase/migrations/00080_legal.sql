-- =============================================
-- Migration 00080: Legal module (Juridico)
-- Contract repository, legal matters intake, clause/template library.
-- Idempotent: safe to run more than once.
-- =============================================

-- ---------------------------------------------
-- 1. Module registration + sector enablement
-- ---------------------------------------------
-- The base seed does not register a `legal` module row, so insert it here and
-- mark it active. ON CONFLICT keeps this idempotent and also upgrades a
-- pre-existing `coming_soon` placeholder to `active`.
INSERT INTO modules (slug, name, description, icon, status, category)
VALUES (
  'legal',
  'Juridico',
  'Gestao de contratos, ciclo de vida, renovacoes, demandas juridicas e biblioteca de clausulas',
  'Scale',
  'active',
  'hub'
)
ON CONFLICT (slug) DO UPDATE
  SET status = 'active',
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      icon = EXCLUDED.icon,
      category = EXCLUDED.category;

-- Enable the Legal module for every existing sector.
INSERT INTO sector_modules (sector_id, module_id, is_enabled)
SELECT s.id, m.id, true
FROM sectors s
CROSS JOIN modules m
WHERE m.slug = 'legal'
ON CONFLICT (sector_id, module_id) DO UPDATE SET is_enabled = true;

-- ---------------------------------------------
-- 2. Permissions + role grants
-- ---------------------------------------------
INSERT INTO permissions (module_id, resource, action)
SELECT m.id, r, a
FROM modules m,
     unnest(ARRAY['contract', 'legal_matter', 'clause']) AS r,
     unnest(ARRAY['create', 'read', 'update', 'delete', 'manage']) AS a
WHERE m.slug = 'legal'
ON CONFLICT (module_id, resource, action) DO NOTHING;

-- admin + manager get every legal permission.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
JOIN modules m ON p.module_id = m.id
WHERE r.slug IN ('admin', 'manager')
  AND m.slug = 'legal'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- analyst gets create/read/update.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
JOIN modules m ON p.module_id = m.id
WHERE r.slug = 'analyst'
  AND p.action IN ('create', 'read', 'update')
  AND m.slug = 'legal'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- intern gets read-only.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
JOIN modules m ON p.module_id = m.id
WHERE r.slug = 'intern'
  AND p.action = 'read'
  AND m.slug = 'legal'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ---------------------------------------------
-- 3. Tables
-- ---------------------------------------------

-- 3.1 legal_contracts — the contract repository.
CREATE TABLE IF NOT EXISTS legal_contracts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id           uuid NOT NULL REFERENCES sectors(id),
  title               text NOT NULL,
  counterparty        text NOT NULL,
  contract_type       text NOT NULL DEFAULT 'service'
                      CHECK (contract_type IN ('service', 'nda', 'vendor', 'employment', 'lease', 'license', 'partnership', 'other')),
  status              text NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'in_review', 'approved', 'active', 'expired', 'renewed', 'terminated')),
  -- Renewal handling, mirroring Ironclad's auto-renew model.
  renewal_type        text NOT NULL DEFAULT 'none'
                      CHECK (renewal_type IN ('none', 'auto', 'optional')),
  notice_period_days  int NOT NULL DEFAULT 30 CHECK (notice_period_days >= 0),
  value_amount        numeric(15, 2),
  currency            text NOT NULL DEFAULT 'BRL',
  effective_date      date,
  expiry_date         date,
  owner_id            uuid REFERENCES users(id),
  description         text,
  is_active           boolean NOT NULL DEFAULT true,
  created_by          uuid NOT NULL REFERENCES users(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- 3.2 legal_matters — legal request / matter intake queue.
CREATE TABLE IF NOT EXISTS legal_matters (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id     uuid NOT NULL REFERENCES sectors(id),
  contract_id   uuid REFERENCES legal_contracts(id) ON DELETE SET NULL,
  title         text NOT NULL,
  matter_type   text NOT NULL DEFAULT 'contract_review'
                CHECK (matter_type IN ('contract_review', 'advice', 'dispute', 'compliance', 'litigation', 'other')),
  priority      text NOT NULL DEFAULT 'medium'
                CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status        text NOT NULL DEFAULT 'open'
                CHECK (status IN ('open', 'in_progress', 'blocked', 'resolved', 'closed')),
  description   text,
  requested_by  uuid NOT NULL REFERENCES users(id),
  assigned_to   uuid REFERENCES users(id),
  due_date      date,
  resolved_at   timestamptz,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- 3.3 legal_clauses — clause / template library of pre-approved language.
CREATE TABLE IF NOT EXISTS legal_clauses (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id    uuid NOT NULL REFERENCES sectors(id),
  title        text NOT NULL,
  category     text NOT NULL DEFAULT 'general'
               CHECK (category IN ('general', 'confidentiality', 'liability', 'payment', 'termination', 'ip', 'compliance', 'other')),
  body         text NOT NULL,
  is_approved  boolean NOT NULL DEFAULT false,
  is_active    boolean NOT NULL DEFAULT true,
  created_by   uuid NOT NULL REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------
-- 4. updated_at triggers
-- ---------------------------------------------
DROP TRIGGER IF EXISTS trg_legal_contracts_updated_at ON legal_contracts;
CREATE TRIGGER trg_legal_contracts_updated_at BEFORE UPDATE ON legal_contracts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_legal_matters_updated_at ON legal_matters;
CREATE TRIGGER trg_legal_matters_updated_at BEFORE UPDATE ON legal_matters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_legal_clauses_updated_at ON legal_clauses;
CREATE TRIGGER trg_legal_clauses_updated_at BEFORE UPDATE ON legal_clauses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------
-- 5. Indexes
-- ---------------------------------------------
CREATE INDEX IF NOT EXISTS idx_legal_contracts_sector_id ON legal_contracts(sector_id);
CREATE INDEX IF NOT EXISTS idx_legal_contracts_status ON legal_contracts(status);
CREATE INDEX IF NOT EXISTS idx_legal_contracts_expiry_date ON legal_contracts(expiry_date)
  WHERE expiry_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_legal_contracts_owner_id ON legal_contracts(owner_id);

CREATE INDEX IF NOT EXISTS idx_legal_matters_sector_id ON legal_matters(sector_id);
CREATE INDEX IF NOT EXISTS idx_legal_matters_status ON legal_matters(status);
CREATE INDEX IF NOT EXISTS idx_legal_matters_assigned_to ON legal_matters(assigned_to);
CREATE INDEX IF NOT EXISTS idx_legal_matters_contract_id ON legal_matters(contract_id);

CREATE INDEX IF NOT EXISTS idx_legal_clauses_sector_id ON legal_clauses(sector_id);
CREATE INDEX IF NOT EXISTS idx_legal_clauses_category ON legal_clauses(category);

-- ---------------------------------------------
-- 6. RLS — every table is sector-scoped.
-- ---------------------------------------------
ALTER TABLE legal_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_matters ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_clauses ENABLE ROW LEVEL SECURITY;

-- legal_contracts policies
DROP POLICY IF EXISTS "legal_contracts_select" ON legal_contracts;
CREATE POLICY "legal_contracts_select" ON legal_contracts
  FOR SELECT TO authenticated
  USING (user_has_sector_access(sector_id));

DROP POLICY IF EXISTS "legal_contracts_insert" ON legal_contracts;
CREATE POLICY "legal_contracts_insert" ON legal_contracts
  FOR INSERT TO authenticated
  WITH CHECK (user_has_permission(sector_id, 'contract', 'create'));

DROP POLICY IF EXISTS "legal_contracts_update" ON legal_contracts;
CREATE POLICY "legal_contracts_update" ON legal_contracts
  FOR UPDATE TO authenticated
  USING (user_has_permission(sector_id, 'contract', 'update'))
  WITH CHECK (user_has_permission(sector_id, 'contract', 'update'));

DROP POLICY IF EXISTS "legal_contracts_delete" ON legal_contracts;
CREATE POLICY "legal_contracts_delete" ON legal_contracts
  FOR DELETE TO authenticated
  USING (user_has_permission(sector_id, 'contract', 'delete'));

-- legal_matters policies
DROP POLICY IF EXISTS "legal_matters_select" ON legal_matters;
CREATE POLICY "legal_matters_select" ON legal_matters
  FOR SELECT TO authenticated
  USING (user_has_sector_access(sector_id));

DROP POLICY IF EXISTS "legal_matters_insert" ON legal_matters;
CREATE POLICY "legal_matters_insert" ON legal_matters
  FOR INSERT TO authenticated
  WITH CHECK (user_has_permission(sector_id, 'legal_matter', 'create'));

DROP POLICY IF EXISTS "legal_matters_update" ON legal_matters;
CREATE POLICY "legal_matters_update" ON legal_matters
  FOR UPDATE TO authenticated
  USING (user_has_permission(sector_id, 'legal_matter', 'update'))
  WITH CHECK (user_has_permission(sector_id, 'legal_matter', 'update'));

DROP POLICY IF EXISTS "legal_matters_delete" ON legal_matters;
CREATE POLICY "legal_matters_delete" ON legal_matters
  FOR DELETE TO authenticated
  USING (user_has_permission(sector_id, 'legal_matter', 'delete'));

-- legal_clauses policies
DROP POLICY IF EXISTS "legal_clauses_select" ON legal_clauses;
CREATE POLICY "legal_clauses_select" ON legal_clauses
  FOR SELECT TO authenticated
  USING (user_has_sector_access(sector_id));

DROP POLICY IF EXISTS "legal_clauses_insert" ON legal_clauses;
CREATE POLICY "legal_clauses_insert" ON legal_clauses
  FOR INSERT TO authenticated
  WITH CHECK (user_has_permission(sector_id, 'clause', 'create'));

DROP POLICY IF EXISTS "legal_clauses_update" ON legal_clauses;
CREATE POLICY "legal_clauses_update" ON legal_clauses
  FOR UPDATE TO authenticated
  USING (user_has_permission(sector_id, 'clause', 'update'))
  WITH CHECK (user_has_permission(sector_id, 'clause', 'update'));

DROP POLICY IF EXISTS "legal_clauses_delete" ON legal_clauses;
CREATE POLICY "legal_clauses_delete" ON legal_clauses
  FOR DELETE TO authenticated
  USING (user_has_permission(sector_id, 'clause', 'delete'));

-- ---------------------------------------------
-- 7. RPC: get_legal_dashboard_stats
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION get_legal_dashboard_stats(p_sector_id uuid)
RETURNS json AS $$
DECLARE
  v_active_contracts   int;
  v_expiring_30        int;
  v_open_matters       int;
  v_draft_contracts    int;
BEGIN
  SELECT count(*) INTO v_active_contracts
  FROM legal_contracts
  WHERE sector_id = p_sector_id AND status = 'active' AND is_active = true;

  SELECT count(*) INTO v_expiring_30
  FROM legal_contracts
  WHERE sector_id = p_sector_id
    AND is_active = true
    AND status IN ('active', 'approved')
    AND expiry_date IS NOT NULL
    AND expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + interval '30 days';

  SELECT count(*) INTO v_open_matters
  FROM legal_matters
  WHERE sector_id = p_sector_id
    AND is_active = true
    AND status IN ('open', 'in_progress', 'blocked');

  SELECT count(*) INTO v_draft_contracts
  FROM legal_contracts
  WHERE sector_id = p_sector_id
    AND is_active = true
    AND status IN ('draft', 'in_review');

  RETURN json_build_object(
    'active_contracts', v_active_contracts,
    'expiring_30',      v_expiring_30,
    'open_matters',     v_open_matters,
    'draft_contracts',  v_draft_contracts
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
