-- Default roles
INSERT INTO roles (name, slug, level, scope, is_system) VALUES
  ('Administrador', 'admin', 100, 'global', true),
  ('Gerente', 'manager', 80, 'sector', true),
  ('Analista', 'analyst', 50, 'sector', true),
  ('Estagiario', 'intern', 20, 'sector', true);

-- Default sectors
INSERT INTO sectors (name, slug, icon, color) VALUES
  ('Desenvolvimento', 'dev', 'Code', '#818cf8'),
  ('Suporte', 'suporte', 'MessageSquare', '#fbbf24'),
  ('Comercial', 'comercial', 'Layers', '#34d399'),
  ('RH', 'rh', 'Users', '#f472b6');

-- Modules
INSERT INTO modules (slug, name, description, icon, status, category) VALUES
  ('onemonday', 'ONEmonday', 'Gestao de tarefas e projetos', 'LayoutGrid', 'active', 'core'),
  ('analytics', 'Analytics', 'Metricas e dashboards avancados', 'BarChart3', 'coming_soon', 'hub'),
  ('crm', 'CRM', 'Gestao de relacionamento com clientes', 'Users', 'coming_soon', 'hub'),
  ('support-desk', 'Support Desk', 'Central de atendimento', 'Headphones', 'coming_soon', 'hub'),
  ('dev-tools', 'Dev Tools', 'Ferramentas para desenvolvimento', 'Terminal', 'coming_soon', 'hub'),
  ('hr-portal', 'RH Portal', 'Gestao de pessoas', 'UserCog', 'coming_soon', 'hub');

-- Enable ONEmonday for all sectors
INSERT INTO sector_modules (sector_id, module_id, is_enabled)
SELECT s.id, m.id, true
FROM sectors s, modules m
WHERE m.slug = 'onemonday';

-- Permissions for ONEmonday module
INSERT INTO permissions (module_id, resource, action)
SELECT m.id, r.resource, r.action
FROM modules m,
(VALUES
  ('board', 'create'), ('board', 'read'), ('board', 'update'), ('board', 'delete'), ('board', 'export'),
  ('board_column', 'create'), ('board_column', 'read'), ('board_column', 'update'), ('board_column', 'delete'), ('board_column', 'manage'),
  ('card', 'create'), ('card', 'read'), ('card', 'update'), ('card', 'delete'), ('card', 'move'), ('card', 'assign'), ('card', 'escalate'),
  ('card_comment', 'create'), ('card_comment', 'read'), ('card_comment', 'update'), ('card_comment', 'delete'),
  ('card_attachment', 'create'), ('card_attachment', 'read'), ('card_attachment', 'delete'),
  ('card_checklist', 'create'), ('card_checklist', 'read'), ('card_checklist', 'update'), ('card_checklist', 'delete'),
  ('card_template', 'create'), ('card_template', 'read'), ('card_template', 'update'), ('card_template', 'delete'),
  ('project', 'create'), ('project', 'read'), ('project', 'update'), ('project', 'delete'),
  ('dashboard', 'read'), ('dashboard', 'export'),
  ('settings', 'read'), ('settings', 'update'),
  ('user', 'invite'), ('user', 'read'), ('user', 'update'), ('user', 'deactivate'),
  ('notification', 'read'), ('notification', 'update'),
  ('saved_view', 'create'), ('saved_view', 'read'), ('saved_view', 'update'), ('saved_view', 'delete')
) AS r(resource, action)
WHERE m.slug = 'onemonday';

-- Admin gets all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.slug = 'admin';

-- Manager gets all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.slug = 'manager';

-- Analyst permissions (subset)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON true
WHERE r.slug = 'analyst'
AND (
  (p.resource = 'board' AND p.action IN ('read', 'export'))
  OR (p.resource = 'board_column' AND p.action = 'read')
  OR (p.resource = 'card' AND p.action IN ('create', 'read', 'update', 'move', 'assign'))
  OR (p.resource = 'card_comment' AND p.action IN ('create', 'read', 'update'))
  OR (p.resource = 'card_attachment' AND p.action IN ('create', 'read'))
  OR (p.resource = 'card_checklist' AND p.action IN ('create', 'read', 'update'))
  OR (p.resource = 'card_template' AND p.action = 'read')
  OR (p.resource = 'project' AND p.action = 'read')
  OR (p.resource = 'dashboard' AND p.action = 'read')
  OR (p.resource = 'user' AND p.action = 'read')
  OR (p.resource IN ('notification', 'saved_view'))
);

-- Intern permissions (minimal)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON true
WHERE r.slug = 'intern'
AND (
  (p.resource = 'board' AND p.action = 'read')
  OR (p.resource = 'board_column' AND p.action = 'read')
  OR (p.resource = 'card' AND p.action IN ('create', 'read'))
  OR (p.resource = 'card_comment' AND p.action IN ('create', 'read'))
  OR (p.resource = 'card_attachment' AND p.action = 'read')
  OR (p.resource = 'card_checklist' AND p.action = 'read')
  OR (p.resource = 'card_template' AND p.action = 'read')
  OR (p.resource = 'project' AND p.action = 'read')
  OR (p.resource = 'dashboard' AND p.action = 'read')
  OR (p.resource IN ('notification', 'saved_view'))
);
