-- ============================================================
-- ONEmonday Sample Data
-- Run with: psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f supabase/sample_data.sql
-- ============================================================

-- Admin user (must exist first)
INSERT INTO users (id, email, full_name, is_global_admin, is_active)
VALUES ('765672fc-f1ae-408d-9758-68cd0b2269d6', 'admin@onemonday.com', 'Lucas Nobre', true, true)
ON CONFLICT (id) DO NOTHING;

-- Assign admin role to all sectors
INSERT INTO user_sector_roles (user_id, sector_id, role_id)
SELECT
  '765672fc-f1ae-408d-9758-68cd0b2269d6',
  s.id,
  r.id
FROM sectors s, roles r
WHERE r.slug = 'admin'
ON CONFLICT (user_id, sector_id) DO NOTHING;

-- ============================================================
-- BOARDS
-- ============================================================

-- Dev boards
INSERT INTO boards (id, name, description, visibility, is_default, created_by)
VALUES
  ('b0000001-0000-0000-0000-000000000001', 'Sprint Q3 2026', 'Sprint atual do time de desenvolvimento', 'sector', true, '765672fc-f1ae-408d-9758-68cd0b2269d6'),
  ('b0000001-0000-0000-0000-000000000002', 'Backlog Geral', 'Backlog de features e melhorias planejadas', 'sector', false, '765672fc-f1ae-408d-9758-68cd0b2269d6'),
  ('b0000001-0000-0000-0000-000000000003', 'Bugs e Incidentes', 'Rastreamento de bugs e incidentes em producao', 'sector', false, '765672fc-f1ae-408d-9758-68cd0b2269d6');

-- Comercial boards
INSERT INTO boards (id, name, description, visibility, is_default, created_by)
VALUES
  ('b0000002-0000-0000-0000-000000000001', 'Pipeline Vendas', 'Acompanhamento de oportunidades comerciais', 'sector', true, '765672fc-f1ae-408d-9758-68cd0b2269d6'),
  ('b0000002-0000-0000-0000-000000000002', 'Campanhas Ativas', 'Campanhas de marketing e vendas em andamento', 'sector', false, '765672fc-f1ae-408d-9758-68cd0b2269d6');

-- Suporte boards
INSERT INTO boards (id, name, description, visibility, is_default, created_by)
VALUES
  ('b0000003-0000-0000-0000-000000000001', 'Operacoes Diarias', 'Tarefas operacionais do suporte tecnico', 'sector', true, '765672fc-f1ae-408d-9758-68cd0b2269d6'),
  ('b0000003-0000-0000-0000-000000000002', 'Escalonamentos', 'Tickets escalonados que precisam de atencao', 'sector', false, '765672fc-f1ae-408d-9758-68cd0b2269d6');

-- RH boards
INSERT INTO boards (id, name, description, visibility, is_default, created_by)
VALUES
  ('b0000004-0000-0000-0000-000000000001', 'Recrutamento', 'Pipeline de contratacoes e processos seletivos', 'sector', true, '765672fc-f1ae-408d-9758-68cd0b2269d6'),
  ('b0000004-0000-0000-0000-000000000002', 'Onboarding Novos', 'Checklist de onboarding para novos colaboradores', 'sector', false, '765672fc-f1ae-408d-9758-68cd0b2269d6');

-- Cross-sector board
INSERT INTO boards (id, name, description, visibility, is_default, created_by)
VALUES
  ('b0000005-0000-0000-0000-000000000001', 'Projeto Plataforma v2', 'Board cross-sector para o projeto da nova plataforma', 'cross_sector', false, '765672fc-f1ae-408d-9758-68cd0b2269d6');

-- ============================================================
-- BOARD_SECTORS (link boards to sectors)
-- ============================================================

-- Dev boards -> Desenvolvimento
INSERT INTO board_sectors (board_id, sector_id)
SELECT b.id, s.id FROM boards b, sectors s
WHERE b.id IN ('b0000001-0000-0000-0000-000000000001','b0000001-0000-0000-0000-000000000002','b0000001-0000-0000-0000-000000000003')
AND s.slug = 'dev';

-- Comercial boards -> Comercial
INSERT INTO board_sectors (board_id, sector_id)
SELECT b.id, s.id FROM boards b, sectors s
WHERE b.id IN ('b0000002-0000-0000-0000-000000000001','b0000002-0000-0000-0000-000000000002')
AND s.slug = 'comercial';

-- Suporte boards -> Suporte
INSERT INTO board_sectors (board_id, sector_id)
SELECT b.id, s.id FROM boards b, sectors s
WHERE b.id IN ('b0000003-0000-0000-0000-000000000001','b0000003-0000-0000-0000-000000000002')
AND s.slug = 'suporte';

-- RH boards -> RH
INSERT INTO board_sectors (board_id, sector_id)
SELECT b.id, s.id FROM boards b, sectors s
WHERE b.id IN ('b0000004-0000-0000-0000-000000000001','b0000004-0000-0000-0000-000000000002')
AND s.slug = 'rh';

-- Cross-sector board -> Dev + Comercial
INSERT INTO board_sectors (board_id, sector_id)
SELECT 'b0000005-0000-0000-0000-000000000001'::uuid, s.id FROM sectors s
WHERE s.slug IN ('dev', 'comercial');

-- ============================================================
-- BOARD_COLUMNS (4 columns per board)
-- ============================================================

-- Helper: create standard columns for each board
DO $$
DECLARE
  board_rec RECORD;
  col_names text[] := ARRAY['A fazer', 'Em andamento', 'Revisao', 'Concluido'];
  col_colors text[] := ARRAY['#94a3b8', '#3b82f6', '#f59e0b', '#22c55e'];
  col_ids text[];
  i int;
BEGIN
  FOR board_rec IN
    SELECT id FROM boards
    WHERE id IN (
      'b0000001-0000-0000-0000-000000000001','b0000001-0000-0000-0000-000000000002','b0000001-0000-0000-0000-000000000003',
      'b0000002-0000-0000-0000-000000000001','b0000002-0000-0000-0000-000000000002',
      'b0000003-0000-0000-0000-000000000001','b0000003-0000-0000-0000-000000000002',
      'b0000004-0000-0000-0000-000000000001','b0000004-0000-0000-0000-000000000002',
      'b0000005-0000-0000-0000-000000000001'
    )
  LOOP
    FOR i IN 1..4 LOOP
      INSERT INTO board_columns (board_id, name, color, position, is_done_column)
      VALUES (
        board_rec.id,
        col_names[i],
        col_colors[i],
        i,
        (i = 4)
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END;
$$;

-- ============================================================
-- TAGS
-- ============================================================

INSERT INTO tags (id, name, color, sector_id)
SELECT gen_random_uuid(), t.name, t.color, s.id
FROM (VALUES
  ('Bug', '#ef4444'),
  ('Feature', '#3b82f6'),
  ('Melhoria', '#8b5cf6'),
  ('Urgente', '#dc2626'),
  ('Documentacao', '#6b7280')
) AS t(name, color),
sectors s WHERE s.slug = 'dev'
ON CONFLICT (name, sector_id) DO NOTHING;

INSERT INTO tags (id, name, color, sector_id)
SELECT gen_random_uuid(), t.name, t.color, s.id
FROM (VALUES
  ('Lead Quente', '#ef4444'),
  ('Proposta', '#3b82f6'),
  ('Follow-up', '#f59e0b'),
  ('Fechado', '#22c55e')
) AS t(name, color),
sectors s WHERE s.slug = 'comercial'
ON CONFLICT (name, sector_id) DO NOTHING;

INSERT INTO tags (id, name, color, sector_id)
SELECT gen_random_uuid(), t.name, t.color, s.id
FROM (VALUES
  ('Critico', '#ef4444'),
  ('Recorrente', '#f59e0b'),
  ('Resolvido', '#22c55e')
) AS t(name, color),
sectors s WHERE s.slug = 'suporte'
ON CONFLICT (name, sector_id) DO NOTHING;

INSERT INTO tags (id, name, color, sector_id)
SELECT gen_random_uuid(), t.name, t.color, s.id
FROM (VALUES
  ('Vaga Aberta', '#3b82f6'),
  ('Entrevista', '#f59e0b'),
  ('Contratado', '#22c55e')
) AS t(name, color),
sectors s WHERE s.slug = 'rh'
ON CONFLICT (name, sector_id) DO NOTHING;

-- ============================================================
-- CARDS - Dev: Sprint Q3 2026
-- ============================================================

DO $$
DECLARE
  v_board_id uuid := 'b0000001-0000-0000-0000-000000000001';
  v_sector_id uuid;
  v_col_afazer uuid;
  v_col_andamento uuid;
  v_col_revisao uuid;
  v_col_concluido uuid;
  v_admin uuid := '765672fc-f1ae-408d-9758-68cd0b2269d6';
  v_card_id uuid;
BEGIN
  SELECT id INTO v_sector_id FROM sectors WHERE slug = 'dev';
  SELECT id INTO v_col_afazer FROM board_columns WHERE board_id = v_board_id AND position = 1 LIMIT 1;
  SELECT id INTO v_col_andamento FROM board_columns WHERE board_id = v_board_id AND position = 2 LIMIT 1;
  SELECT id INTO v_col_revisao FROM board_columns WHERE board_id = v_board_id AND position = 3 LIMIT 1;
  SELECT id INTO v_col_concluido FROM board_columns WHERE board_id = v_board_id AND position = 4 LIMIT 1;

  -- Card 1: A fazer
  INSERT INTO cards (id, board_id, column_id, sector_id, title, description, position, priority, due_date, created_by)
  VALUES ('c0000001-0001-0000-0000-000000000001', v_board_id, v_col_afazer, v_sector_id,
    'Implementar autenticacao SSO com Google', 'Integrar login via Google OAuth 2.0 para facilitar o acesso dos colaboradores. Deve suportar dominio corporativo.',
    1, 'high', '2026-06-15', v_admin);
  INSERT INTO card_assignees (card_id, user_id) VALUES ('c0000001-0001-0000-0000-000000000001', v_admin);

  -- Card 2: A fazer
  INSERT INTO cards (id, board_id, column_id, sector_id, title, description, position, priority, due_date, created_by)
  VALUES ('c0000001-0001-0000-0000-000000000002', v_board_id, v_col_afazer, v_sector_id,
    'Criar endpoint de exportacao CSV dos boards', 'Permitir que gerentes exportem dados do board em formato CSV para relatorios.',
    2, 'medium', '2026-06-20', v_admin);

  -- Card 3: A fazer
  INSERT INTO cards (id, board_id, column_id, sector_id, title, description, position, priority, due_date, created_by)
  VALUES ('c0000001-0001-0000-0000-000000000003', v_board_id, v_col_afazer, v_sector_id,
    'Adicionar filtro por data no kanban', 'Usuarios pediram filtro por intervalo de datas na visualizacao kanban.',
    3, 'low', NULL, v_admin);

  -- Card 4: Em andamento
  INSERT INTO cards (id, board_id, column_id, sector_id, title, description, position, priority, start_date, due_date, created_by)
  VALUES ('c0000001-0001-0000-0000-000000000004', v_board_id, v_col_andamento, v_sector_id,
    'Refatorar componente de drag-and-drop', 'O componente atual tem problemas de performance com muitos cards. Migrar para @dnd-kit.',
    1, 'high', '2026-05-10', '2026-05-25', v_admin);
  INSERT INTO card_assignees (card_id, user_id) VALUES ('c0000001-0001-0000-0000-000000000004', v_admin);

  -- Card 5: Em andamento
  INSERT INTO cards (id, board_id, column_id, sector_id, title, description, position, priority, start_date, created_by)
  VALUES ('c0000001-0001-0000-0000-000000000005', v_board_id, v_col_andamento, v_sector_id,
    'Configurar pipeline CI/CD no GitHub Actions', 'Automatizar build, testes e deploy para staging.',
    2, 'critical', '2026-05-12', v_admin);
  INSERT INTO card_assignees (card_id, user_id) VALUES ('c0000001-0001-0000-0000-000000000005', v_admin);

  -- Card 6: Revisao
  INSERT INTO cards (id, board_id, column_id, sector_id, title, description, position, priority, start_date, due_date, created_by)
  VALUES ('c0000001-0001-0000-0000-000000000006', v_board_id, v_col_revisao, v_sector_id,
    'Implementar notificacoes in-app', 'Sistema de notificacoes com badge no header e dropdown com lista de notificacoes.',
    1, 'medium', '2026-05-05', '2026-05-18', v_admin);
  INSERT INTO card_assignees (card_id, user_id) VALUES ('c0000001-0001-0000-0000-000000000006', v_admin);

  -- Card 7: Concluido
  INSERT INTO cards (id, board_id, column_id, sector_id, title, description, position, priority, start_date, due_date, completed_at, created_by)
  VALUES ('c0000001-0001-0000-0000-000000000007', v_board_id, v_col_concluido, v_sector_id,
    'Setup inicial do projeto Next.js 16', 'Scaffold do projeto com Next.js 16, shadcn/ui, Tailwind CSS 4 e Supabase.',
    1, 'critical', '2026-05-01', '2026-05-10', '2026-05-09 18:30:00+00', v_admin);
  INSERT INTO card_assignees (card_id, user_id) VALUES ('c0000001-0001-0000-0000-000000000007', v_admin);

  -- Card 8: Concluido
  INSERT INTO cards (id, board_id, column_id, sector_id, title, description, position, priority, start_date, due_date, completed_at, created_by)
  VALUES ('c0000001-0001-0000-0000-000000000008', v_board_id, v_col_concluido, v_sector_id,
    'Modelagem do banco de dados e migrations', 'Criar todas as tabelas, RLS policies e seed data.',
    2, 'high', '2026-05-03', '2026-05-12', '2026-05-11 14:00:00+00', v_admin);
  INSERT INTO card_assignees (card_id, user_id) VALUES ('c0000001-0001-0000-0000-000000000008', v_admin);
END;
$$;

-- ============================================================
-- CARDS - Dev: Backlog Geral
-- ============================================================

DO $$
DECLARE
  v_board_id uuid := 'b0000001-0000-0000-0000-000000000002';
  v_sector_id uuid;
  v_col_afazer uuid;
  v_admin uuid := '765672fc-f1ae-408d-9758-68cd0b2269d6';
BEGIN
  SELECT id INTO v_sector_id FROM sectors WHERE slug = 'dev';
  SELECT id INTO v_col_afazer FROM board_columns WHERE board_id = v_board_id AND position = 1 LIMIT 1;

  INSERT INTO cards (id, board_id, column_id, sector_id, title, description, position, priority, created_by)
  VALUES
    ('c0000001-0002-0000-0000-000000000001', v_board_id, v_col_afazer, v_sector_id,
     'Modo escuro (dark mode)', 'Implementar toggle de tema claro/escuro com persistencia no localStorage.',
     1, 'low', v_admin),
    ('c0000001-0002-0000-0000-000000000002', v_board_id, v_col_afazer, v_sector_id,
     'Integrar com API do Slack', 'Enviar notificacoes de cards para canais do Slack configurados por setor.',
     2, 'medium', v_admin),
    ('c0000001-0002-0000-0000-000000000003', v_board_id, v_col_afazer, v_sector_id,
     'Dashboard com graficos de velocidade', 'Adicionar graficos de burndown e velocity no dashboard do setor.',
     3, 'medium', v_admin),
    ('c0000001-0002-0000-0000-000000000004', v_board_id, v_col_afazer, v_sector_id,
     'Funcionalidade de templates de cards', 'Permitir criar e usar templates pre-definidos ao criar novos cards.',
     4, 'low', v_admin),
    ('c0000001-0002-0000-0000-000000000005', v_board_id, v_col_afazer, v_sector_id,
     'App mobile com React Native', 'Versao mobile para acompanhamento de tarefas em campo.',
     5, 'low', v_admin);
END;
$$;

-- ============================================================
-- CARDS - Dev: Bugs e Incidentes
-- ============================================================

DO $$
DECLARE
  v_board_id uuid := 'b0000001-0000-0000-0000-000000000003';
  v_sector_id uuid;
  v_col_afazer uuid;
  v_col_andamento uuid;
  v_col_concluido uuid;
  v_admin uuid := '765672fc-f1ae-408d-9758-68cd0b2269d6';
BEGIN
  SELECT id INTO v_sector_id FROM sectors WHERE slug = 'dev';
  SELECT id INTO v_col_afazer FROM board_columns WHERE board_id = v_board_id AND position = 1 LIMIT 1;
  SELECT id INTO v_col_andamento FROM board_columns WHERE board_id = v_board_id AND position = 2 LIMIT 1;
  SELECT id INTO v_col_concluido FROM board_columns WHERE board_id = v_board_id AND position = 4 LIMIT 1;

  INSERT INTO cards (id, board_id, column_id, sector_id, title, description, position, priority, due_date, created_by)
  VALUES
    ('c0000001-0003-0000-0000-000000000001', v_board_id, v_col_andamento, v_sector_id,
     'Erro 500 ao mover card entre colunas', 'Usuarios reportaram erro intermitente ao arrastar cards. Logs indicam timeout na query de update.',
     1, 'critical', '2026-05-14', v_admin),
    ('c0000001-0003-0000-0000-000000000002', v_board_id, v_col_afazer, v_sector_id,
     'Sidebar nao fecha no mobile', 'Em telas menores que 768px, a sidebar fica sobreposta e nao fecha ao clicar fora.',
     1, 'high', '2026-05-20', v_admin),
    ('c0000001-0003-0000-0000-000000000003', v_board_id, v_col_afazer, v_sector_id,
     'Notificacao duplicada ao comentar', 'O webhook dispara duas notificacoes por comentario. Provavelmente trigger duplicado.',
     2, 'medium', NULL, v_admin),
    ('c0000001-0003-0000-0000-000000000004', v_board_id, v_col_concluido, v_sector_id,
     'Corrigir encoding de caracteres no CSV', 'Exportacao CSV com acentos quebrados em Excel. Ajustado para BOM UTF-8.',
     1, 'low', '2026-05-10', v_admin);

  INSERT INTO card_assignees (card_id, user_id) VALUES ('c0000001-0003-0000-0000-000000000001', v_admin);
END;
$$;

-- ============================================================
-- CARDS - Comercial: Pipeline Vendas
-- ============================================================

DO $$
DECLARE
  v_board_id uuid := 'b0000002-0000-0000-0000-000000000001';
  v_sector_id uuid;
  v_col_afazer uuid;
  v_col_andamento uuid;
  v_col_revisao uuid;
  v_col_concluido uuid;
  v_admin uuid := '765672fc-f1ae-408d-9758-68cd0b2269d6';
BEGIN
  SELECT id INTO v_sector_id FROM sectors WHERE slug = 'comercial';
  SELECT id INTO v_col_afazer FROM board_columns WHERE board_id = v_board_id AND position = 1 LIMIT 1;
  SELECT id INTO v_col_andamento FROM board_columns WHERE board_id = v_board_id AND position = 2 LIMIT 1;
  SELECT id INTO v_col_revisao FROM board_columns WHERE board_id = v_board_id AND position = 3 LIMIT 1;
  SELECT id INTO v_col_concluido FROM board_columns WHERE board_id = v_board_id AND position = 4 LIMIT 1;

  INSERT INTO cards (id, board_id, column_id, sector_id, title, description, position, priority, due_date, created_by)
  VALUES
    ('c0000002-0001-0000-0000-000000000001', v_board_id, v_col_afazer, v_sector_id,
     'Proposta Empresa Alpha - Licenciamento', 'Preparar proposta de licenciamento anual para 50 usuarios. Contato: Maria Silva.',
     1, 'high', '2026-05-20', v_admin),
    ('c0000002-0001-0000-0000-000000000002', v_board_id, v_col_afazer, v_sector_id,
     'Follow-up Beta Consultoria', 'Retornar contato apos demo da semana passada. Interessados no modulo de suporte.',
     2, 'medium', '2026-05-16', v_admin),
    ('c0000002-0001-0000-0000-000000000003', v_board_id, v_col_andamento, v_sector_id,
     'Negociacao Gamma Corp - Enterprise', 'Negociacao em fase final. Desconto de 15% aprovado pela diretoria. Aguardando retorno juridico.',
     1, 'critical', '2026-05-25', v_admin),
    ('c0000002-0001-0000-0000-000000000004', v_board_id, v_col_andamento, v_sector_id,
     'Demo para Delta Tecnologia', 'Agendar e preparar demo personalizada focando no kanban e relatorios.',
     2, 'medium', '2026-05-18', v_admin),
    ('c0000002-0001-0000-0000-000000000005', v_board_id, v_col_revisao, v_sector_id,
     'Contrato Epsilon SA - Revisao juridica', 'Contrato enviado para analise do juridico do cliente. Prazo de retorno: 5 dias uteis.',
     1, 'high', '2026-05-22', v_admin),
    ('c0000002-0001-0000-0000-000000000006', v_board_id, v_col_concluido, v_sector_id,
     'Fechamento Zeta Ltda - Plano Pro', 'Contrato assinado! 25 usuarios, plano Pro anual. Valor: R$ 18.000/ano.',
     1, 'high', '2026-05-08', v_admin);

  INSERT INTO card_assignees (card_id, user_id)
  VALUES
    ('c0000002-0001-0000-0000-000000000001', v_admin),
    ('c0000002-0001-0000-0000-000000000003', v_admin),
    ('c0000002-0001-0000-0000-000000000005', v_admin),
    ('c0000002-0001-0000-0000-000000000006', v_admin);
END;
$$;

-- ============================================================
-- CARDS - Comercial: Campanhas Ativas
-- ============================================================

DO $$
DECLARE
  v_board_id uuid := 'b0000002-0000-0000-0000-000000000002';
  v_sector_id uuid;
  v_col_afazer uuid;
  v_col_andamento uuid;
  v_col_concluido uuid;
  v_admin uuid := '765672fc-f1ae-408d-9758-68cd0b2269d6';
BEGIN
  SELECT id INTO v_sector_id FROM sectors WHERE slug = 'comercial';
  SELECT id INTO v_col_afazer FROM board_columns WHERE board_id = v_board_id AND position = 1 LIMIT 1;
  SELECT id INTO v_col_andamento FROM board_columns WHERE board_id = v_board_id AND position = 2 LIMIT 1;
  SELECT id INTO v_col_concluido FROM board_columns WHERE board_id = v_board_id AND position = 4 LIMIT 1;

  INSERT INTO cards (id, board_id, column_id, sector_id, title, description, position, priority, due_date, created_by)
  VALUES
    ('c0000002-0002-0000-0000-000000000001', v_board_id, v_col_andamento, v_sector_id,
     'Campanha LinkedIn - Lancamento Q3', 'Serie de posts sobre novidades da plataforma. Meta: 500 leads qualificados.',
     1, 'high', '2026-06-30', v_admin),
    ('c0000002-0002-0000-0000-000000000002', v_board_id, v_col_andamento, v_sector_id,
     'Webinar: Gestao de projetos para PMEs', 'Webinar gratuito para gerar leads. Data: 28/05. Meta: 200 inscritos.',
     2, 'medium', '2026-05-28', v_admin),
    ('c0000002-0002-0000-0000-000000000003', v_board_id, v_col_afazer, v_sector_id,
     'Email marketing - Base inativa', 'Reengajar leads que nao interagiram nos ultimos 90 dias.',
     1, 'low', '2026-06-10', v_admin),
    ('c0000002-0002-0000-0000-000000000004', v_board_id, v_col_concluido, v_sector_id,
     'Landing page produto - v2', 'Nova landing page com depoimentos e calculadora de ROI.',
     1, 'medium', '2026-05-05', v_admin),
    ('c0000002-0002-0000-0000-000000000005', v_board_id, v_col_afazer, v_sector_id,
     'Parceria com influenciadores tech', 'Mapear 10 influenciadores do nicho de produtividade para parceria.',
     2, 'low', NULL, v_admin);
END;
$$;

-- ============================================================
-- CARDS - Suporte: Operacoes Diarias
-- ============================================================

DO $$
DECLARE
  v_board_id uuid := 'b0000003-0000-0000-0000-000000000001';
  v_sector_id uuid;
  v_col_afazer uuid;
  v_col_andamento uuid;
  v_col_revisao uuid;
  v_col_concluido uuid;
  v_admin uuid := '765672fc-f1ae-408d-9758-68cd0b2269d6';
BEGIN
  SELECT id INTO v_sector_id FROM sectors WHERE slug = 'suporte';
  SELECT id INTO v_col_afazer FROM board_columns WHERE board_id = v_board_id AND position = 1 LIMIT 1;
  SELECT id INTO v_col_andamento FROM board_columns WHERE board_id = v_board_id AND position = 2 LIMIT 1;
  SELECT id INTO v_col_revisao FROM board_columns WHERE board_id = v_board_id AND position = 3 LIMIT 1;
  SELECT id INTO v_col_concluido FROM board_columns WHERE board_id = v_board_id AND position = 4 LIMIT 1;

  INSERT INTO cards (id, board_id, column_id, sector_id, title, description, position, priority, due_date, created_by)
  VALUES
    ('c0000003-0001-0000-0000-000000000001', v_board_id, v_col_afazer, v_sector_id,
     'Atualizar base de conhecimento - FAQ', 'Revisar e atualizar as 20 perguntas mais frequentes com informacoes do ultimo release.',
     1, 'medium', '2026-05-22', v_admin),
    ('c0000003-0001-0000-0000-000000000002', v_board_id, v_col_afazer, v_sector_id,
     'Treinar equipe no novo fluxo de escalonamento', 'Workshop interno sobre o novo processo de escalonamento entre setores.',
     2, 'high', '2026-05-19', v_admin),
    ('c0000003-0001-0000-0000-000000000003', v_board_id, v_col_andamento, v_sector_id,
     'Ticket #4521 - Cliente Omega sem acesso', 'Cliente reporta erro 403 ao acessar dashboard. Verificar RLS policies.',
     1, 'critical', '2026-05-14', v_admin),
    ('c0000003-0001-0000-0000-000000000004', v_board_id, v_col_andamento, v_sector_id,
     'Configurar respostas automaticas no chat', 'Implementar chatbot basico para triagem de tickets fora do horario.',
     2, 'medium', '2026-05-30', v_admin),
    ('c0000003-0001-0000-0000-000000000005', v_board_id, v_col_revisao, v_sector_id,
     'Relatorio mensal de SLA - Abril 2026', 'Compilar metricas de tempo de resposta, resolucao e satisfacao.',
     1, 'medium', '2026-05-15', v_admin),
    ('c0000003-0001-0000-0000-000000000006', v_board_id, v_col_concluido, v_sector_id,
     'Migrar tickets do Zendesk para ONEmonday', 'Importacao concluida: 1.247 tickets migrados com historico completo.',
     1, 'high', '2026-05-08', v_admin);

  INSERT INTO card_assignees (card_id, user_id)
  VALUES
    ('c0000003-0001-0000-0000-000000000003', v_admin),
    ('c0000003-0001-0000-0000-000000000005', v_admin);
END;
$$;

-- ============================================================
-- CARDS - Suporte: Escalonamentos
-- ============================================================

DO $$
DECLARE
  v_board_id uuid := 'b0000003-0000-0000-0000-000000000002';
  v_sector_id uuid;
  v_col_afazer uuid;
  v_col_andamento uuid;
  v_admin uuid := '765672fc-f1ae-408d-9758-68cd0b2269d6';
BEGIN
  SELECT id INTO v_sector_id FROM sectors WHERE slug = 'suporte';
  SELECT id INTO v_col_afazer FROM board_columns WHERE board_id = v_board_id AND position = 1 LIMIT 1;
  SELECT id INTO v_col_andamento FROM board_columns WHERE board_id = v_board_id AND position = 2 LIMIT 1;

  INSERT INTO cards (id, board_id, column_id, sector_id, title, description, position, priority, due_date, created_by)
  VALUES
    ('c0000003-0002-0000-0000-000000000001', v_board_id, v_col_andamento, v_sector_id,
     'Escalonamento: Integracao API falha para cliente Kappa', 'Cliente enterprise com integracao customizada. Endpoint retorna 502 desde atualizacao de sexta.',
     1, 'critical', '2026-05-14', v_admin),
    ('c0000003-0002-0000-0000-000000000002', v_board_id, v_col_afazer, v_sector_id,
     'Escalonamento: Perda de dados em board compartilhado', 'Dois usuarios editaram simultaneamente e houve perda de dados. Investigar locking.',
     1, 'critical', '2026-05-15', v_admin);

  INSERT INTO card_assignees (card_id, user_id)
  VALUES
    ('c0000003-0002-0000-0000-000000000001', v_admin),
    ('c0000003-0002-0000-0000-000000000002', v_admin);
END;
$$;

-- ============================================================
-- CARDS - RH: Recrutamento
-- ============================================================

DO $$
DECLARE
  v_board_id uuid := 'b0000004-0000-0000-0000-000000000001';
  v_sector_id uuid;
  v_col_afazer uuid;
  v_col_andamento uuid;
  v_col_revisao uuid;
  v_col_concluido uuid;
  v_admin uuid := '765672fc-f1ae-408d-9758-68cd0b2269d6';
BEGIN
  SELECT id INTO v_sector_id FROM sectors WHERE slug = 'rh';
  SELECT id INTO v_col_afazer FROM board_columns WHERE board_id = v_board_id AND position = 1 LIMIT 1;
  SELECT id INTO v_col_andamento FROM board_columns WHERE board_id = v_board_id AND position = 2 LIMIT 1;
  SELECT id INTO v_col_revisao FROM board_columns WHERE board_id = v_board_id AND position = 3 LIMIT 1;
  SELECT id INTO v_col_concluido FROM board_columns WHERE board_id = v_board_id AND position = 4 LIMIT 1;

  INSERT INTO cards (id, board_id, column_id, sector_id, title, description, position, priority, due_date, created_by)
  VALUES
    ('c0000004-0001-0000-0000-000000000001', v_board_id, v_col_afazer, v_sector_id,
     'Vaga: Desenvolvedor Frontend Senior', 'React/Next.js, 5+ anos de experiencia. Remoto. Faixa: R$ 12-18k.',
     1, 'high', '2026-06-01', v_admin),
    ('c0000004-0001-0000-0000-000000000002', v_board_id, v_col_andamento, v_sector_id,
     'Vaga: Analista de Suporte Pleno', 'Triagem de curriculos em andamento. 23 candidatos, 8 pre-selecionados.',
     1, 'medium', '2026-05-25', v_admin),
    ('c0000004-0001-0000-0000-000000000003', v_board_id, v_col_revisao, v_sector_id,
     'Vaga: Executivo de Vendas', 'Finalistas: 3 candidatos. Aguardando decisao do gerente comercial.',
     1, 'high', '2026-05-18', v_admin),
    ('c0000004-0001-0000-0000-000000000004', v_board_id, v_col_andamento, v_sector_id,
     'Revisao do plano de cargos e salarios', 'Pesquisa de mercado em andamento. Benchmark com 15 empresas do setor.',
     2, 'medium', '2026-06-30', v_admin),
    ('c0000004-0001-0000-0000-000000000005', v_board_id, v_col_concluido, v_sector_id,
     'Contratacao: Designer UX/UI', 'Ana Costa contratada. Inicio: 19/05/2026. Enviar kit de boas-vindas.',
     1, 'medium', '2026-05-12', v_admin);
END;
$$;

-- ============================================================
-- CARDS - RH: Onboarding Novos
-- ============================================================

DO $$
DECLARE
  v_board_id uuid := 'b0000004-0000-0000-0000-000000000002';
  v_sector_id uuid;
  v_col_afazer uuid;
  v_col_andamento uuid;
  v_admin uuid := '765672fc-f1ae-408d-9758-68cd0b2269d6';
BEGIN
  SELECT id INTO v_sector_id FROM sectors WHERE slug = 'rh';
  SELECT id INTO v_col_afazer FROM board_columns WHERE board_id = v_board_id AND position = 1 LIMIT 1;
  SELECT id INTO v_col_andamento FROM board_columns WHERE board_id = v_board_id AND position = 2 LIMIT 1;

  INSERT INTO cards (id, board_id, column_id, sector_id, title, description, position, priority, due_date, created_by)
  VALUES
    ('c0000004-0002-0000-0000-000000000001', v_board_id, v_col_afazer, v_sector_id,
     'Onboarding Ana Costa - Preparar acessos', 'Criar conta no ONEmonday, email corporativo, Slack e VPN. Inicio: 19/05.',
     1, 'high', '2026-05-17', v_admin),
    ('c0000004-0002-0000-0000-000000000002', v_board_id, v_col_afazer, v_sector_id,
     'Onboarding Ana Costa - Kit de boas-vindas', 'Montar kit com notebook, headset, camiseta e manual do colaborador.',
     2, 'medium', '2026-05-18', v_admin),
    ('c0000004-0002-0000-0000-000000000003', v_board_id, v_col_andamento, v_sector_id,
     'Atualizar manual do colaborador 2026', 'Incluir novas politicas de trabalho remoto e beneficios atualizados.',
     1, 'low', '2026-05-30', v_admin);
END;
$$;

-- ============================================================
-- CARDS - Cross-sector: Projeto Plataforma v2
-- ============================================================

DO $$
DECLARE
  v_board_id uuid := 'b0000005-0000-0000-0000-000000000001';
  v_sector_dev uuid;
  v_sector_comercial uuid;
  v_col_afazer uuid;
  v_col_andamento uuid;
  v_col_revisao uuid;
  v_admin uuid := '765672fc-f1ae-408d-9758-68cd0b2269d6';
BEGIN
  SELECT id INTO v_sector_dev FROM sectors WHERE slug = 'dev';
  SELECT id INTO v_sector_comercial FROM sectors WHERE slug = 'comercial';
  SELECT id INTO v_col_afazer FROM board_columns WHERE board_id = v_board_id AND position = 1 LIMIT 1;
  SELECT id INTO v_col_andamento FROM board_columns WHERE board_id = v_board_id AND position = 2 LIMIT 1;
  SELECT id INTO v_col_revisao FROM board_columns WHERE board_id = v_board_id AND position = 3 LIMIT 1;

  INSERT INTO cards (id, board_id, column_id, sector_id, title, description, position, priority, due_date, created_by)
  VALUES
    ('c0000005-0001-0000-0000-000000000001', v_board_id, v_col_andamento, v_sector_dev,
     'Arquitetura de microservicos - RFC', 'Documento de arquitetura para migracao de monolito para microservicos.',
     1, 'high', '2026-06-01', v_admin),
    ('c0000005-0001-0000-0000-000000000002', v_board_id, v_col_afazer, v_sector_dev,
     'POC: Migrar autenticacao para Auth0', 'Testar viabilidade de migrar do Supabase Auth para Auth0 Enterprise.',
     1, 'medium', '2026-06-15', v_admin),
    ('c0000005-0001-0000-0000-000000000003', v_board_id, v_col_afazer, v_sector_comercial,
     'Pesquisa de mercado: pricing v2', 'Levantar precos da concorrencia e propor nova tabela de precos.',
     2, 'high', '2026-05-30', v_admin),
    ('c0000005-0001-0000-0000-000000000004', v_board_id, v_col_revisao, v_sector_comercial,
     'Material de vendas - Nova plataforma', 'Criar apresentacao e one-pager para o time comercial usar nas demos.',
     1, 'medium', '2026-05-20', v_admin),
    ('c0000005-0001-0000-0000-000000000005', v_board_id, v_col_andamento, v_sector_dev,
     'Setup ambiente de staging v2', 'Provisionar infraestrutura de staging para a nova versao da plataforma.',
     2, 'high', '2026-05-25', v_admin);

  INSERT INTO card_assignees (card_id, user_id)
  VALUES
    ('c0000005-0001-0000-0000-000000000001', v_admin),
    ('c0000005-0001-0000-0000-000000000005', v_admin);
END;
$$;

-- ============================================================
-- PROJECTS
-- ============================================================

INSERT INTO projects (id, name, description, status, start_date, target_date, created_by)
VALUES
  ('a0000001-0000-0000-0000-000000000001', 'Plataforma ONEmonday v2',
   'Reescrita completa da plataforma com Next.js 16, nova arquitetura e modulos expandidos.',
   'active', '2026-05-01', '2026-09-30', '765672fc-f1ae-408d-9758-68cd0b2269d6'),
  ('a0000002-0000-0000-0000-000000000001', 'Expansao Comercial Q3',
   'Metas de vendas e campanhas para o terceiro trimestre de 2026. Objetivo: 50 novos clientes.',
   'active', '2026-07-01', '2026-09-30', '765672fc-f1ae-408d-9758-68cd0b2269d6'),
  ('a0000003-0000-0000-0000-000000000001', 'Reestruturacao de Suporte',
   'Modernizar o atendimento ao cliente com automacao, base de conhecimento e SLA revisado.',
   'active', '2026-05-01', '2026-07-31', '765672fc-f1ae-408d-9758-68cd0b2269d6');

-- Link projects to sectors
INSERT INTO project_sectors (project_id, sector_id)
SELECT 'a0000001-0000-0000-0000-000000000001'::uuid, id FROM sectors WHERE slug IN ('dev', 'comercial');

INSERT INTO project_sectors (project_id, sector_id)
SELECT 'a0000002-0000-0000-0000-000000000001'::uuid, id FROM sectors WHERE slug = 'comercial';

INSERT INTO project_sectors (project_id, sector_id)
SELECT 'a0000003-0000-0000-0000-000000000001'::uuid, id FROM sectors WHERE slug IN ('suporte', 'dev');

-- Link some cards to projects
INSERT INTO project_cards (project_id, card_id)
VALUES
  -- Plataforma v2 project
  ('a0000001-0000-0000-0000-000000000001', 'c0000005-0001-0000-0000-000000000001'),
  ('a0000001-0000-0000-0000-000000000001', 'c0000005-0001-0000-0000-000000000002'),
  ('a0000001-0000-0000-0000-000000000001', 'c0000005-0001-0000-0000-000000000005'),
  ('a0000001-0000-0000-0000-000000000001', 'c0000001-0001-0000-0000-000000000004'),
  -- Expansao Comercial
  ('a0000002-0000-0000-0000-000000000001', 'c0000002-0001-0000-0000-000000000003'),
  ('a0000002-0000-0000-0000-000000000001', 'c0000002-0002-0000-0000-000000000001'),
  ('a0000002-0000-0000-0000-000000000001', 'c0000002-0002-0000-0000-000000000002'),
  -- Reestruturacao de Suporte
  ('a0000003-0000-0000-0000-000000000001', 'c0000003-0001-0000-0000-000000000001'),
  ('a0000003-0000-0000-0000-000000000001', 'c0000003-0001-0000-0000-000000000004'),
  ('a0000003-0000-0000-0000-000000000001', 'c0000003-0001-0000-0000-000000000006');

-- ============================================================
-- CARD COMMENTS
-- ============================================================

INSERT INTO card_comments (card_id, user_id, content)
VALUES
  ('c0000001-0001-0000-0000-000000000004', '765672fc-f1ae-408d-9758-68cd0b2269d6',
   'Comecei a migrar para @dnd-kit. A API e bem mais limpa que o react-beautiful-dnd. Deve ficar pronto ate quinta.'),
  ('c0000001-0001-0000-0000-000000000005', '765672fc-f1ae-408d-9758-68cd0b2269d6',
   'Pipeline de CI configurado. Falta ajustar os testes E2E que estao falhando por timeout no Playwright.'),
  ('c0000001-0001-0000-0000-000000000006', '765672fc-f1ae-408d-9758-68cd0b2269d6',
   'Notificacoes in-app funcionando. Preciso de review no PR #47 antes de mergear.'),
  ('c0000002-0001-0000-0000-000000000003', '765672fc-f1ae-408d-9758-68cd0b2269d6',
   'Reuniao com o juridico da Gamma Corp marcada para quarta-feira. Levar versao final do contrato.'),
  ('c0000002-0001-0000-0000-000000000005', '765672fc-f1ae-408d-9758-68cd0b2269d6',
   'Juridico pediu ajuste na clausula de SLA. Encaminhei para nosso advogado revisar.'),
  ('c0000003-0001-0000-0000-000000000003', '765672fc-f1ae-408d-9758-68cd0b2269d6',
   'Problema identificado: o trigger de notificacao no Supabase esta com AFTER INSERT duplicado. Abrindo PR para corrigir.'),
  ('c0000003-0002-0000-0000-000000000001', '765672fc-f1ae-408d-9758-68cd0b2269d6',
   'Escalonado para o time de dev. O endpoint /api/v1/sync esta com problema no rate limiting.'),
  ('c0000004-0001-0000-0000-000000000001', '765672fc-f1ae-408d-9758-68cd0b2269d6',
   'Publicada no LinkedIn e Gupy. Ja recebemos 12 curriculos nas primeiras 24h.');

-- ============================================================
-- CARD ACTIVITY LOG
-- ============================================================

INSERT INTO card_activity_log (card_id, user_id, action, metadata, created_at)
VALUES
  -- Sprint board activities
  ('c0000001-0001-0000-0000-000000000007', '765672fc-f1ae-408d-9758-68cd0b2269d6', 'card_created',
   '{"title": "Setup inicial do projeto Next.js 16"}', '2026-05-01 09:00:00+00'),
  ('c0000001-0001-0000-0000-000000000007', '765672fc-f1ae-408d-9758-68cd0b2269d6', 'card_moved',
   '{"from_column": "A fazer", "to_column": "Em andamento"}', '2026-05-02 10:30:00+00'),
  ('c0000001-0001-0000-0000-000000000007', '765672fc-f1ae-408d-9758-68cd0b2269d6', 'card_moved',
   '{"from_column": "Em andamento", "to_column": "Revisao"}', '2026-05-08 16:00:00+00'),
  ('c0000001-0001-0000-0000-000000000007', '765672fc-f1ae-408d-9758-68cd0b2269d6', 'card_moved',
   '{"from_column": "Revisao", "to_column": "Concluido"}', '2026-05-09 18:30:00+00'),

  ('c0000001-0001-0000-0000-000000000008', '765672fc-f1ae-408d-9758-68cd0b2269d6', 'card_created',
   '{"title": "Modelagem do banco de dados e migrations"}', '2026-05-03 08:00:00+00'),
  ('c0000001-0001-0000-0000-000000000008', '765672fc-f1ae-408d-9758-68cd0b2269d6', 'card_moved',
   '{"from_column": "A fazer", "to_column": "Em andamento"}', '2026-05-04 09:00:00+00'),
  ('c0000001-0001-0000-0000-000000000008', '765672fc-f1ae-408d-9758-68cd0b2269d6', 'card_moved',
   '{"from_column": "Em andamento", "to_column": "Concluido"}', '2026-05-11 14:00:00+00'),

  ('c0000001-0001-0000-0000-000000000004', '765672fc-f1ae-408d-9758-68cd0b2269d6', 'card_created',
   '{"title": "Refatorar componente de drag-and-drop"}', '2026-05-08 11:00:00+00'),
  ('c0000001-0001-0000-0000-000000000004', '765672fc-f1ae-408d-9758-68cd0b2269d6', 'card_moved',
   '{"from_column": "A fazer", "to_column": "Em andamento"}', '2026-05-10 09:00:00+00'),
  ('c0000001-0001-0000-0000-000000000004', '765672fc-f1ae-408d-9758-68cd0b2269d6', 'card_comment',
   '{"comment": "Comecei a migrar para @dnd-kit"}', '2026-05-11 15:30:00+00'),

  ('c0000001-0001-0000-0000-000000000005', '765672fc-f1ae-408d-9758-68cd0b2269d6', 'card_created',
   '{"title": "Configurar pipeline CI/CD no GitHub Actions"}', '2026-05-12 08:00:00+00'),
  ('c0000001-0001-0000-0000-000000000005', '765672fc-f1ae-408d-9758-68cd0b2269d6', 'card_moved',
   '{"from_column": "A fazer", "to_column": "Em andamento"}', '2026-05-12 10:00:00+00'),

  -- Comercial activities
  ('c0000002-0001-0000-0000-000000000003', '765672fc-f1ae-408d-9758-68cd0b2269d6', 'card_created',
   '{"title": "Negociacao Gamma Corp - Enterprise"}', '2026-05-05 14:00:00+00'),
  ('c0000002-0001-0000-0000-000000000003', '765672fc-f1ae-408d-9758-68cd0b2269d6', 'card_moved',
   '{"from_column": "A fazer", "to_column": "Em andamento"}', '2026-05-07 09:30:00+00'),
  ('c0000002-0001-0000-0000-000000000003', '765672fc-f1ae-408d-9758-68cd0b2269d6', 'card_comment',
   '{"comment": "Reuniao com o juridico marcada para quarta"}', '2026-05-12 11:00:00+00'),

  ('c0000002-0001-0000-0000-000000000006', '765672fc-f1ae-408d-9758-68cd0b2269d6', 'card_created',
   '{"title": "Fechamento Zeta Ltda - Plano Pro"}', '2026-05-01 10:00:00+00'),
  ('c0000002-0001-0000-0000-000000000006', '765672fc-f1ae-408d-9758-68cd0b2269d6', 'card_moved',
   '{"from_column": "Revisao", "to_column": "Concluido"}', '2026-05-08 17:00:00+00'),

  -- Suporte activities
  ('c0000003-0001-0000-0000-000000000003', '765672fc-f1ae-408d-9758-68cd0b2269d6', 'card_created',
   '{"title": "Ticket #4521 - Cliente Omega sem acesso"}', '2026-05-13 08:00:00+00'),
  ('c0000003-0001-0000-0000-000000000003', '765672fc-f1ae-408d-9758-68cd0b2269d6', 'card_moved',
   '{"from_column": "A fazer", "to_column": "Em andamento"}', '2026-05-13 08:30:00+00'),

  ('c0000003-0002-0000-0000-000000000001', '765672fc-f1ae-408d-9758-68cd0b2269d6', 'card_created',
   '{"title": "Escalonamento: Integracao API falha para cliente Kappa"}', '2026-05-13 09:00:00+00'),
  ('c0000003-0002-0000-0000-000000000001', '765672fc-f1ae-408d-9758-68cd0b2269d6', 'card_moved',
   '{"from_column": "A fazer", "to_column": "Em andamento"}', '2026-05-13 09:15:00+00'),
  ('c0000003-0002-0000-0000-000000000001', '765672fc-f1ae-408d-9758-68cd0b2269d6', 'card_comment',
   '{"comment": "Escalonado para o time de dev"}', '2026-05-13 09:30:00+00'),

  -- RH activities
  ('c0000004-0001-0000-0000-000000000005', '765672fc-f1ae-408d-9758-68cd0b2269d6', 'card_created',
   '{"title": "Contratacao: Designer UX/UI"}', '2026-04-20 09:00:00+00'),
  ('c0000004-0001-0000-0000-000000000005', '765672fc-f1ae-408d-9758-68cd0b2269d6', 'card_moved',
   '{"from_column": "Revisao", "to_column": "Concluido"}', '2026-05-12 16:00:00+00');

-- ============================================================
-- CARD CHECKLISTS (for a few cards)
-- ============================================================

DO $$
DECLARE
  v_checklist_id uuid;
BEGIN
  -- Checklist for SSO card
  v_checklist_id := gen_random_uuid();
  INSERT INTO card_checklists (id, card_id, title, position)
  VALUES (v_checklist_id, 'c0000001-0001-0000-0000-000000000001', 'Etapas da implementacao', 1);

  INSERT INTO checklist_items (checklist_id, content, is_completed, position)
  VALUES
    (v_checklist_id, 'Configurar projeto no Google Cloud Console', false, 1),
    (v_checklist_id, 'Implementar OAuth 2.0 flow', false, 2),
    (v_checklist_id, 'Validar dominio corporativo', false, 3),
    (v_checklist_id, 'Testes de integracao', false, 4),
    (v_checklist_id, 'Documentar no wiki', false, 5);

  -- Checklist for onboarding card
  v_checklist_id := gen_random_uuid();
  INSERT INTO card_checklists (id, card_id, title, position)
  VALUES (v_checklist_id, 'c0000004-0002-0000-0000-000000000001', 'Acessos necessarios', 1);

  INSERT INTO checklist_items (checklist_id, content, is_completed, position)
  VALUES
    (v_checklist_id, 'Email corporativo @onemonday.com', false, 1),
    (v_checklist_id, 'Conta no ONEmonday (setor: Dev)', false, 2),
    (v_checklist_id, 'Acesso ao Slack (canais: #geral, #design)', false, 3),
    (v_checklist_id, 'VPN configurada', false, 4),
    (v_checklist_id, 'GitHub adicionada ao time', false, 5),
    (v_checklist_id, 'Figma com licenca Pro', false, 6);
END;
$$;

-- ============================================================
-- NOTIFICATIONS (sample)
-- ============================================================

INSERT INTO notifications (user_id, type, title, content, resource_type, resource_id, is_read)
VALUES
  ('765672fc-f1ae-408d-9758-68cd0b2269d6', 'card_assigned', 'Card atribuido a voce',
   'Voce foi atribuido ao card "Erro 500 ao mover card entre colunas".',
   'card', 'c0000001-0003-0000-0000-000000000001', false),
  ('765672fc-f1ae-408d-9758-68cd0b2269d6', 'card_due_soon', 'Card vencendo',
   'O card "Ticket #4521 - Cliente Omega sem acesso" vence amanha.',
   'card', 'c0000003-0001-0000-0000-000000000003', false),
  ('765672fc-f1ae-408d-9758-68cd0b2269d6', 'card_comment', 'Novo comentario',
   'Novo comentario no card "Negociacao Gamma Corp - Enterprise".',
   'card', 'c0000002-0001-0000-0000-000000000003', true),
  ('765672fc-f1ae-408d-9758-68cd0b2269d6', 'card_moved', 'Card movido',
   'O card "Fechamento Zeta Ltda" foi movido para Concluido.',
   'card', 'c0000002-0001-0000-0000-000000000006', true);

-- Done!
-- Run: psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f supabase/sample_data.sql
