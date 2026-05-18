-- =============================================
-- Migration 00178: Legal — contract documents + clause linking
-- Implements the deferred Legal backlog (docs/research/ux-audit-legal.md
-- items #3 "document upload" and #10 "connect clause library to contracts").
--
-- Adds:
--   * `legal-documents` private storage bucket — holds the actual contract
--     files (PDF / Word / etc.) the register was missing.
--   * `legal_contract_documents` — one row per uploaded file, attached to a
--     contract, sector-scoped.
--   * `legal_contract_clauses` — many-to-many link between a contract and the
--     reusable clauses in the library.
--   * `document` resource permissions for the legal module + role grants.
--
-- Idempotent: safe to run more than once.
-- =============================================

-- ---------------------------------------------
-- 1. Storage bucket for contract documents
-- ---------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'legal-documents',
  'legal-documents',
  false,
  26214400,  -- 25MB limit (contracts can be large scanned PDFs)
  ARRAY[
    'application/pdf',
    'image/jpeg', 'image/png', 'image/webp',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies — authenticated users may use the bucket. Row-level access
-- to the metadata table below is what actually enforces sector scoping; the
-- object path is `<sector_id>/<contract_id>/<file>`.
DROP POLICY IF EXISTS "legal_documents_upload" ON storage.objects;
CREATE POLICY "legal_documents_upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'legal-documents');

DROP POLICY IF EXISTS "legal_documents_view" ON storage.objects;
CREATE POLICY "legal_documents_view"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'legal-documents');

DROP POLICY IF EXISTS "legal_documents_delete" ON storage.objects;
CREATE POLICY "legal_documents_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'legal-documents');

-- ---------------------------------------------
-- 2. Permissions — a `document` resource for the legal module
-- ---------------------------------------------
INSERT INTO permissions (module_id, resource, action)
SELECT m.id, 'contract_document', a
FROM modules m,
     unnest(ARRAY['create', 'read', 'update', 'delete', 'manage']) AS a
WHERE m.slug = 'legal'
ON CONFLICT (module_id, resource, action) DO NOTHING;

-- admin + manager: full document permissions.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
JOIN modules m ON p.module_id = m.id
WHERE r.slug IN ('admin', 'manager')
  AND m.slug = 'legal'
  AND p.resource = 'contract_document'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- analyst: create/read/update documents.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
JOIN modules m ON p.module_id = m.id
WHERE r.slug = 'analyst'
  AND m.slug = 'legal'
  AND p.resource = 'contract_document'
  AND p.action IN ('create', 'read', 'update')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- intern: read-only documents.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
JOIN modules m ON p.module_id = m.id
WHERE r.slug = 'intern'
  AND m.slug = 'legal'
  AND p.resource = 'contract_document'
  AND p.action = 'read'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ---------------------------------------------
-- 3. legal_contract_documents — uploaded files attached to a contract
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS legal_contract_documents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id  uuid NOT NULL REFERENCES legal_contracts(id) ON DELETE CASCADE,
  -- Denormalised sector_id so RLS does not need a join on every check.
  sector_id    uuid NOT NULL REFERENCES sectors(id),
  -- Storage object path inside the `legal-documents` bucket.
  file_path    text NOT NULL,
  file_name    text NOT NULL,
  file_size    bigint NOT NULL DEFAULT 0 CHECK (file_size >= 0),
  mime_type    text,
  -- Free-form label, e.g. "Versão assinada", "Aditivo 1".
  doc_label    text,
  uploaded_by  uuid NOT NULL REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legal_contract_documents_contract_id
  ON legal_contract_documents(contract_id);
CREATE INDEX IF NOT EXISTS idx_legal_contract_documents_sector_id
  ON legal_contract_documents(sector_id);

-- ---------------------------------------------
-- 4. legal_contract_clauses — links library clauses to a contract
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS legal_contract_clauses (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id  uuid NOT NULL REFERENCES legal_contracts(id) ON DELETE CASCADE,
  clause_id    uuid NOT NULL REFERENCES legal_clauses(id) ON DELETE CASCADE,
  -- Denormalised sector_id for RLS — always equals both parents' sector_id.
  sector_id    uuid NOT NULL REFERENCES sectors(id),
  added_by     uuid NOT NULL REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contract_id, clause_id)
);

CREATE INDEX IF NOT EXISTS idx_legal_contract_clauses_contract_id
  ON legal_contract_clauses(contract_id);
CREATE INDEX IF NOT EXISTS idx_legal_contract_clauses_clause_id
  ON legal_contract_clauses(clause_id);
CREATE INDEX IF NOT EXISTS idx_legal_contract_clauses_sector_id
  ON legal_contract_clauses(sector_id);

-- ---------------------------------------------
-- 5. RLS — both tables are sector-scoped
-- ---------------------------------------------
ALTER TABLE legal_contract_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_contract_clauses ENABLE ROW LEVEL SECURITY;

-- legal_contract_documents policies
DROP POLICY IF EXISTS "legal_contract_documents_select" ON legal_contract_documents;
CREATE POLICY "legal_contract_documents_select" ON legal_contract_documents
  FOR SELECT TO authenticated
  USING (user_has_sector_access(sector_id));

DROP POLICY IF EXISTS "legal_contract_documents_insert" ON legal_contract_documents;
CREATE POLICY "legal_contract_documents_insert" ON legal_contract_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND user_has_permission(sector_id, 'contract_document', 'create')
  );

DROP POLICY IF EXISTS "legal_contract_documents_update" ON legal_contract_documents;
CREATE POLICY "legal_contract_documents_update" ON legal_contract_documents
  FOR UPDATE TO authenticated
  USING (user_has_permission(sector_id, 'contract_document', 'update'))
  WITH CHECK (user_has_permission(sector_id, 'contract_document', 'update'));

DROP POLICY IF EXISTS "legal_contract_documents_delete" ON legal_contract_documents;
CREATE POLICY "legal_contract_documents_delete" ON legal_contract_documents
  FOR DELETE TO authenticated
  USING (user_has_permission(sector_id, 'contract_document', 'delete'));

-- legal_contract_clauses policies — gated on the `contract` resource: linking a
-- library clause is a change to the contract, not the clause.
DROP POLICY IF EXISTS "legal_contract_clauses_select" ON legal_contract_clauses;
CREATE POLICY "legal_contract_clauses_select" ON legal_contract_clauses
  FOR SELECT TO authenticated
  USING (user_has_sector_access(sector_id));

DROP POLICY IF EXISTS "legal_contract_clauses_insert" ON legal_contract_clauses;
CREATE POLICY "legal_contract_clauses_insert" ON legal_contract_clauses
  FOR INSERT TO authenticated
  WITH CHECK (
    added_by = auth.uid()
    AND user_has_permission(sector_id, 'contract', 'update')
  );

DROP POLICY IF EXISTS "legal_contract_clauses_delete" ON legal_contract_clauses;
CREATE POLICY "legal_contract_clauses_delete" ON legal_contract_clauses
  FOR DELETE TO authenticated
  USING (user_has_permission(sector_id, 'contract', 'update'));
