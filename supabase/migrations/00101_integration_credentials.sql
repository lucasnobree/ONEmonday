-- Migration 00101: Integration layer — provider credentials store.
-- Phase 1 of the total-migration roadmap (docs/research/migration-architecture.md
-- §1.2d "Secret management").
--
-- `integration_credentials` holds the per-sector (or global) configuration for
-- external providers (Microsoft Teams, WhatsApp Cloud API, ...). The `secret`
-- column NEVER stores plaintext: server actions encrypt it with AES-256-GCM
-- using the app key in `INTEGRATION_ENCRYPTION_KEY` before insert, and decrypt
-- it only inside server-only code. The DB therefore only ever holds ciphertext.
--
-- RLS: only global admins or sector admins (the `settings`/`manage` permission)
-- may read or write a row.
--
-- Idempotent: safe to re-run.

-- =============================================
-- Permission resource registration
-- =============================================
-- A single new `integration` resource backs the whole integration layer. It is
-- registered against the existing `finance` module purely so it has a home in
-- the modules/permissions schema; the app-level Resource union is extended
-- additively in lib/permissions/types.ts.
INSERT INTO permissions (module_id, resource, action)
SELECT m.id, 'integration', a
FROM modules m,
     unnest(ARRAY['create', 'read', 'update', 'delete', 'manage']) AS a
WHERE m.slug = 'finance'
ON CONFLICT (module_id, resource, action) DO NOTHING;

-- Grant integration permissions to admin and manager roles only — these are
-- sensitive (they gate provider secrets).
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
JOIN modules m ON p.module_id = m.id
WHERE r.slug IN ('admin', 'manager')
AND p.resource = 'integration'
AND m.slug = 'finance'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- =============================================
-- integration_credentials
-- =============================================
CREATE TABLE IF NOT EXISTS integration_credentials (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NULL sector_id = a global credential usable by every sector.
  sector_id     uuid REFERENCES sectors(id),
  -- Logical capability this credential serves (mirrors lib/integrations).
  capability    text NOT NULL DEFAULT 'messaging'
                CHECK (capability IN ('messaging', 'email', 'fiscal',
                                      'banking', 'payments', 'payroll',
                                      'timeclock')),
  -- Provider slug — must match a registered adapter (e.g. 'teams', 'whatsapp').
  provider      text NOT NULL,
  -- AES-256-GCM ciphertext of the JSON secret blob. Format produced by
  -- lib/integrations/crypto.ts: base64(iv).base64(authTag).base64(ciphertext).
  -- NULL = configured but no secret yet (e.g. a no-op / log-only channel).
  secret        text,
  -- Non-secret config (display name, base URLs, template ids, ...).
  metadata      jsonb NOT NULL DEFAULT '{}',
  is_enabled    boolean NOT NULL DEFAULT true,
  is_active     boolean NOT NULL DEFAULT true,
  created_by    uuid NOT NULL REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- One credential per (sector, provider). A global credential uses a fixed
-- sentinel so the unique index also covers the NULL-sector case.
CREATE UNIQUE INDEX IF NOT EXISTS idx_integration_credentials_unique
  ON integration_credentials (COALESCE(sector_id, '00000000-0000-0000-0000-000000000000'), provider)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_integration_credentials_capability
  ON integration_credentials (capability) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_integration_credentials_sector
  ON integration_credentials (sector_id) WHERE is_active = true;

DROP TRIGGER IF EXISTS trg_integration_credentials_updated_at ON integration_credentials;
CREATE TRIGGER trg_integration_credentials_updated_at BEFORE UPDATE ON integration_credentials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE integration_credentials ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS — integration_credentials
-- Global credentials (sector_id IS NULL) are admin-only. Sector credentials
-- require the `integration`/`manage` permission in that sector.
-- =============================================
DROP POLICY IF EXISTS "integration_credentials_select" ON integration_credentials;
CREATE POLICY "integration_credentials_select" ON integration_credentials
  FOR SELECT TO authenticated
  USING (
    is_active = true AND (
      (sector_id IS NULL AND is_global_admin())
      OR (sector_id IS NOT NULL AND user_has_permission(sector_id, 'integration', 'manage'))
    )
  );

DROP POLICY IF EXISTS "integration_credentials_insert" ON integration_credentials;
CREATE POLICY "integration_credentials_insert" ON integration_credentials
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND (
      (sector_id IS NULL AND is_global_admin())
      OR (sector_id IS NOT NULL AND user_has_permission(sector_id, 'integration', 'manage'))
    )
  );

DROP POLICY IF EXISTS "integration_credentials_update" ON integration_credentials;
CREATE POLICY "integration_credentials_update" ON integration_credentials
  FOR UPDATE TO authenticated
  USING (
    (sector_id IS NULL AND is_global_admin())
    OR (sector_id IS NOT NULL AND user_has_permission(sector_id, 'integration', 'manage'))
  )
  WITH CHECK (
    (sector_id IS NULL AND is_global_admin())
    OR (sector_id IS NOT NULL AND user_has_permission(sector_id, 'integration', 'manage'))
  );

DROP POLICY IF EXISTS "integration_credentials_delete" ON integration_credentials;
CREATE POLICY "integration_credentials_delete" ON integration_credentials
  FOR DELETE TO authenticated
  USING (
    (sector_id IS NULL AND is_global_admin())
    OR (sector_id IS NOT NULL AND user_has_permission(sector_id, 'integration', 'manage'))
  );
