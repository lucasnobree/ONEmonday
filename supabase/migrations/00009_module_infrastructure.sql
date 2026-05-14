-- Module infrastructure: board_type differentiation and module permissions

-- Add board_type to differentiate module boards from generic ones
ALTER TABLE boards ADD COLUMN IF NOT EXISTS board_type text DEFAULT 'general'
  CHECK (board_type IN ('general', 'support_tickets', 'crm_pipeline', 'hr_recruitment'));

-- Add module_id to link boards to their owning module
ALTER TABLE boards ADD COLUMN IF NOT EXISTS module_id uuid REFERENCES modules(id);

-- Index for filtering boards by type
CREATE INDEX IF NOT EXISTS idx_boards_type ON boards(board_type) WHERE board_type != 'general';

-- Register new modules
INSERT INTO modules (slug, name, description, icon, status, category) VALUES
  ('support-desk', 'Support Desk', 'Central de atendimento com tickets, SLA e base de conhecimento', 'Headphones', 'active', 'hub'),
  ('crm', 'CRM', 'Pipeline de vendas, contatos, empresas e propostas', 'Users', 'active', 'hub'),
  ('hr', 'RH Portal', 'Gestao de colaboradores, ferias, recrutamento e onboarding', 'UserCog', 'active', 'hub')
ON CONFLICT (slug) DO UPDATE SET status = 'active', name = EXCLUDED.name, description = EXCLUDED.description;

-- Enable modules for Desenvolvimento sector (for testing)
INSERT INTO sector_modules (sector_id, module_id, is_enabled)
SELECT '3826e880-b077-4930-a676-7c5b96d10f63', m.id, true
FROM modules m WHERE m.slug IN ('support-desk', 'crm', 'hr')
ON CONFLICT (sector_id, module_id) DO UPDATE SET is_enabled = true;

-- Register permissions for Support Desk module
INSERT INTO permissions (module_id, resource, action)
SELECT m.id, r, a
FROM modules m,
     unnest(ARRAY['ticket', 'sla_rule', 'kb_article', 'canned_response']) AS r,
     unnest(ARRAY['create', 'read', 'update', 'delete', 'manage']) AS a
WHERE m.slug = 'support-desk'
ON CONFLICT (module_id, resource, action) DO NOTHING;

-- Register permissions for CRM module
INSERT INTO permissions (module_id, resource, action)
SELECT m.id, r, a
FROM modules m,
     unnest(ARRAY['contact', 'company', 'deal', 'crm_activity', 'proposal']) AS r,
     unnest(ARRAY['create', 'read', 'update', 'delete', 'manage']) AS a
WHERE m.slug = 'crm'
ON CONFLICT (module_id, resource, action) DO NOTHING;

-- Register permissions for RH module
INSERT INTO permissions (module_id, resource, action)
SELECT m.id, r, a
FROM modules m,
     unnest(ARRAY['employee', 'time_off', 'job_opening', 'candidate', 'onboarding']) AS r,
     unnest(ARRAY['create', 'read', 'update', 'delete', 'manage']) AS a
WHERE m.slug = 'hr'
ON CONFLICT (module_id, resource, action) DO NOTHING;

-- Grant all new permissions to admin and manager roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
JOIN modules m ON p.module_id = m.id
WHERE r.slug IN ('admin', 'manager')
AND m.slug IN ('support-desk', 'crm', 'hr')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Grant create/read/update permissions to analyst role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
JOIN modules m ON p.module_id = m.id
WHERE r.slug = 'analyst'
AND p.action IN ('create', 'read', 'update')
AND m.slug IN ('support-desk', 'crm', 'hr')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Grant read-only to intern role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
JOIN modules m ON p.module_id = m.id
WHERE r.slug = 'intern'
AND p.action = 'read'
AND m.slug IN ('support-desk', 'crm', 'hr')
ON CONFLICT (role_id, permission_id) DO NOTHING;
