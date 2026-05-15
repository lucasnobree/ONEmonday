-- =============================================
-- Migration 00060: Dev-Tools module
-- Engineering operations workspace: service registry, incident tracker,
-- deployment log and feature flags.
-- Idempotent: safe to run more than once.
-- =============================================

-- ---------------------------------------------
-- 1. Module activation + sector enablement
-- ---------------------------------------------
-- The base seed registers `dev-tools` with status `coming_soon`; promote it to
-- `active`. ON CONFLICT keeps this idempotent.
INSERT INTO modules (slug, name, description, icon, status, category)
VALUES (
  'dev-tools',
  'Dev Tools',
  'Operacoes de engenharia: registro de servicos, incidentes, deploys e feature flags',
  'Terminal',
  'active',
  'hub'
)
ON CONFLICT (slug) DO UPDATE
  SET status = 'active',
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      icon = EXCLUDED.icon,
      category = EXCLUDED.category;

-- Enable the Dev-Tools module for every existing sector.
INSERT INTO sector_modules (sector_id, module_id, is_enabled)
SELECT s.id, m.id, true
FROM sectors s
CROSS JOIN modules m
WHERE m.slug = 'dev-tools'
ON CONFLICT (sector_id, module_id) DO UPDATE SET is_enabled = true;

-- ---------------------------------------------
-- 2. Permissions + role grants
-- ---------------------------------------------
INSERT INTO permissions (module_id, resource, action)
SELECT m.id, r, a
FROM modules m,
     unnest(ARRAY['service', 'incident', 'deployment', 'feature_flag']) AS r,
     unnest(ARRAY['create', 'read', 'update', 'delete', 'manage']) AS a
WHERE m.slug = 'dev-tools'
ON CONFLICT (module_id, resource, action) DO NOTHING;

-- admin + manager get every dev-tools permission.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
JOIN modules m ON p.module_id = m.id
WHERE r.slug IN ('admin', 'manager')
  AND m.slug = 'dev-tools'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- analyst gets create/read/update.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
JOIN modules m ON p.module_id = m.id
WHERE r.slug = 'analyst'
  AND p.action IN ('create', 'read', 'update')
  AND m.slug = 'dev-tools'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- intern gets read-only.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
JOIN modules m ON p.module_id = m.id
WHERE r.slug = 'intern'
  AND p.action = 'read'
  AND m.slug = 'dev-tools'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ---------------------------------------------
-- 3. Tables
-- ---------------------------------------------

-- 3.1 dev_services — the service / component registry.
CREATE TABLE IF NOT EXISTS dev_services (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id     uuid NOT NULL REFERENCES sectors(id),
  name          text NOT NULL,
  slug          text NOT NULL,
  description   text,
  environment   text NOT NULL DEFAULT 'production'
                CHECK (environment IN ('production', 'staging', 'development')),
  criticality   text NOT NULL DEFAULT 'medium'
                CHECK (criticality IN ('critical', 'high', 'medium', 'low')),
  health        text NOT NULL DEFAULT 'operational'
                CHECK (health IN ('operational', 'degraded', 'partial_outage', 'major_outage')),
  repository_url text,
  is_active     boolean NOT NULL DEFAULT true,
  created_by    uuid NOT NULL REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sector_id, slug)
);

-- 3.2 dev_incidents — incident tracker with severity + lifecycle.
CREATE TABLE IF NOT EXISTS dev_incidents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id       uuid NOT NULL REFERENCES sectors(id),
  service_id      uuid REFERENCES dev_services(id) ON DELETE SET NULL,
  title           text NOT NULL,
  description     text,
  severity        text NOT NULL DEFAULT 'sev3'
                  CHECK (severity IN ('sev1', 'sev2', 'sev3', 'sev4')),
  status          text NOT NULL DEFAULT 'investigating'
                  CHECK (status IN ('investigating', 'identified', 'monitoring', 'resolved')),
  acknowledged_at timestamptz,
  resolved_at     timestamptz,
  assigned_to     uuid REFERENCES users(id),
  is_active       boolean NOT NULL DEFAULT true,
  created_by      uuid NOT NULL REFERENCES users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- 3.3 dev_deployments — append-style release / deployment log.
CREATE TABLE IF NOT EXISTS dev_deployments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id     uuid NOT NULL REFERENCES sectors(id),
  service_id    uuid NOT NULL REFERENCES dev_services(id) ON DELETE CASCADE,
  version       text NOT NULL,
  environment   text NOT NULL DEFAULT 'production'
                CHECK (environment IN ('production', 'staging', 'development')),
  status        text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'succeeded', 'failed', 'rolled_back')),
  notes         text,
  deployed_by   uuid NOT NULL REFERENCES users(id),
  deployed_at   timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- 3.4 dev_feature_flags — per-service feature flags / kill switches.
CREATE TABLE IF NOT EXISTS dev_feature_flags (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id     uuid NOT NULL REFERENCES sectors(id),
  service_id    uuid REFERENCES dev_services(id) ON DELETE SET NULL,
  key           text NOT NULL,
  description   text,
  environment   text NOT NULL DEFAULT 'production'
                CHECK (environment IN ('production', 'staging', 'development')),
  is_enabled    boolean NOT NULL DEFAULT false,
  rollout_percentage int NOT NULL DEFAULT 0
                CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  owner_id      uuid REFERENCES users(id),
  is_active     boolean NOT NULL DEFAULT true,
  created_by    uuid NOT NULL REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sector_id, key, environment)
);

-- ---------------------------------------------
-- 4. updated_at triggers
-- ---------------------------------------------
DROP TRIGGER IF EXISTS trg_dev_services_updated_at ON dev_services;
CREATE TRIGGER trg_dev_services_updated_at BEFORE UPDATE ON dev_services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_dev_incidents_updated_at ON dev_incidents;
CREATE TRIGGER trg_dev_incidents_updated_at BEFORE UPDATE ON dev_incidents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_dev_deployments_updated_at ON dev_deployments;
CREATE TRIGGER trg_dev_deployments_updated_at BEFORE UPDATE ON dev_deployments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_dev_feature_flags_updated_at ON dev_feature_flags;
CREATE TRIGGER trg_dev_feature_flags_updated_at BEFORE UPDATE ON dev_feature_flags
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------
-- 5. Indexes
-- ---------------------------------------------
CREATE INDEX IF NOT EXISTS idx_dev_services_sector_id ON dev_services(sector_id);
CREATE INDEX IF NOT EXISTS idx_dev_services_health ON dev_services(health);

CREATE INDEX IF NOT EXISTS idx_dev_incidents_sector_id ON dev_incidents(sector_id);
CREATE INDEX IF NOT EXISTS idx_dev_incidents_status ON dev_incidents(status);
CREATE INDEX IF NOT EXISTS idx_dev_incidents_service_id ON dev_incidents(service_id);
CREATE INDEX IF NOT EXISTS idx_dev_incidents_assigned_to ON dev_incidents(assigned_to);

CREATE INDEX IF NOT EXISTS idx_dev_deployments_sector_id ON dev_deployments(sector_id);
CREATE INDEX IF NOT EXISTS idx_dev_deployments_service_id ON dev_deployments(service_id);
CREATE INDEX IF NOT EXISTS idx_dev_deployments_deployed_at ON dev_deployments(deployed_at DESC);

CREATE INDEX IF NOT EXISTS idx_dev_feature_flags_sector_id ON dev_feature_flags(sector_id);
CREATE INDEX IF NOT EXISTS idx_dev_feature_flags_service_id ON dev_feature_flags(service_id);

-- ---------------------------------------------
-- 6. RLS — every table is sector-scoped.
-- ---------------------------------------------
ALTER TABLE dev_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE dev_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE dev_deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE dev_feature_flags ENABLE ROW LEVEL SECURITY;

-- dev_services policies
DROP POLICY IF EXISTS "dev_services_select" ON dev_services;
CREATE POLICY "dev_services_select" ON dev_services
  FOR SELECT TO authenticated
  USING (user_has_sector_access(sector_id));

DROP POLICY IF EXISTS "dev_services_insert" ON dev_services;
CREATE POLICY "dev_services_insert" ON dev_services
  FOR INSERT TO authenticated
  WITH CHECK (user_has_permission(sector_id, 'service', 'create'));

DROP POLICY IF EXISTS "dev_services_update" ON dev_services;
CREATE POLICY "dev_services_update" ON dev_services
  FOR UPDATE TO authenticated
  USING (user_has_permission(sector_id, 'service', 'update'))
  WITH CHECK (user_has_permission(sector_id, 'service', 'update'));

DROP POLICY IF EXISTS "dev_services_delete" ON dev_services;
CREATE POLICY "dev_services_delete" ON dev_services
  FOR DELETE TO authenticated
  USING (user_has_permission(sector_id, 'service', 'delete'));

-- dev_incidents policies
DROP POLICY IF EXISTS "dev_incidents_select" ON dev_incidents;
CREATE POLICY "dev_incidents_select" ON dev_incidents
  FOR SELECT TO authenticated
  USING (user_has_sector_access(sector_id));

DROP POLICY IF EXISTS "dev_incidents_insert" ON dev_incidents;
CREATE POLICY "dev_incidents_insert" ON dev_incidents
  FOR INSERT TO authenticated
  WITH CHECK (user_has_permission(sector_id, 'incident', 'create'));

DROP POLICY IF EXISTS "dev_incidents_update" ON dev_incidents;
CREATE POLICY "dev_incidents_update" ON dev_incidents
  FOR UPDATE TO authenticated
  USING (user_has_permission(sector_id, 'incident', 'update'))
  WITH CHECK (user_has_permission(sector_id, 'incident', 'update'));

DROP POLICY IF EXISTS "dev_incidents_delete" ON dev_incidents;
CREATE POLICY "dev_incidents_delete" ON dev_incidents
  FOR DELETE TO authenticated
  USING (user_has_permission(sector_id, 'incident', 'delete'));

-- dev_deployments policies
DROP POLICY IF EXISTS "dev_deployments_select" ON dev_deployments;
CREATE POLICY "dev_deployments_select" ON dev_deployments
  FOR SELECT TO authenticated
  USING (user_has_sector_access(sector_id));

DROP POLICY IF EXISTS "dev_deployments_insert" ON dev_deployments;
CREATE POLICY "dev_deployments_insert" ON dev_deployments
  FOR INSERT TO authenticated
  WITH CHECK (user_has_permission(sector_id, 'deployment', 'create'));

DROP POLICY IF EXISTS "dev_deployments_update" ON dev_deployments;
CREATE POLICY "dev_deployments_update" ON dev_deployments
  FOR UPDATE TO authenticated
  USING (user_has_permission(sector_id, 'deployment', 'update'))
  WITH CHECK (user_has_permission(sector_id, 'deployment', 'update'));

DROP POLICY IF EXISTS "dev_deployments_delete" ON dev_deployments;
CREATE POLICY "dev_deployments_delete" ON dev_deployments
  FOR DELETE TO authenticated
  USING (user_has_permission(sector_id, 'deployment', 'delete'));

-- dev_feature_flags policies
DROP POLICY IF EXISTS "dev_feature_flags_select" ON dev_feature_flags;
CREATE POLICY "dev_feature_flags_select" ON dev_feature_flags
  FOR SELECT TO authenticated
  USING (user_has_sector_access(sector_id));

DROP POLICY IF EXISTS "dev_feature_flags_insert" ON dev_feature_flags;
CREATE POLICY "dev_feature_flags_insert" ON dev_feature_flags
  FOR INSERT TO authenticated
  WITH CHECK (user_has_permission(sector_id, 'feature_flag', 'create'));

DROP POLICY IF EXISTS "dev_feature_flags_update" ON dev_feature_flags;
CREATE POLICY "dev_feature_flags_update" ON dev_feature_flags
  FOR UPDATE TO authenticated
  USING (user_has_permission(sector_id, 'feature_flag', 'update'))
  WITH CHECK (user_has_permission(sector_id, 'feature_flag', 'update'));

DROP POLICY IF EXISTS "dev_feature_flags_delete" ON dev_feature_flags;
CREATE POLICY "dev_feature_flags_delete" ON dev_feature_flags
  FOR DELETE TO authenticated
  USING (user_has_permission(sector_id, 'feature_flag', 'delete'));

-- ---------------------------------------------
-- 7. RPC: get_dev_tools_dashboard_stats
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION get_dev_tools_dashboard_stats(p_sector_id uuid)
RETURNS json AS $$
DECLARE
  v_open_incidents     int;
  v_sev1_open          int;
  v_services_down      int;
  v_deploys_7d         int;
  v_active_flags       int;
BEGIN
  SELECT count(*) INTO v_open_incidents
  FROM dev_incidents
  WHERE sector_id = p_sector_id AND is_active = true AND status <> 'resolved';

  SELECT count(*) INTO v_sev1_open
  FROM dev_incidents
  WHERE sector_id = p_sector_id
    AND is_active = true
    AND status <> 'resolved'
    AND severity = 'sev1';

  SELECT count(*) INTO v_services_down
  FROM dev_services
  WHERE sector_id = p_sector_id
    AND is_active = true
    AND health IN ('partial_outage', 'major_outage');

  SELECT count(*) INTO v_deploys_7d
  FROM dev_deployments
  WHERE sector_id = p_sector_id
    AND deployed_at >= now() - interval '7 days';

  SELECT count(*) INTO v_active_flags
  FROM dev_feature_flags
  WHERE sector_id = p_sector_id
    AND is_active = true
    AND is_enabled = true;

  RETURN json_build_object(
    'open_incidents', v_open_incidents,
    'sev1_open',      v_sev1_open,
    'services_down',  v_services_down,
    'deploys_7d',     v_deploys_7d,
    'active_flags',   v_active_flags
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
