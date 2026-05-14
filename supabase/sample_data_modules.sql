-- ============================================================
-- ONEmonday Module Sample Data
-- Populates Support Desk, CRM, and HR module tables
-- Run: psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f supabase/sample_data_modules.sql
-- Safe to run multiple times (ON CONFLICT / IF NOT EXISTS)
-- ============================================================

-- ============================================================
-- CONSTANTS (reused throughout)
-- ============================================================
-- Admin user:   765672fc-f1ae-408d-9758-68cd0b2269d6
-- Dev sector:   3826e880-b077-4930-a676-7c5b96d10f63
-- (both come from seed.sql / migrations)

-- ============================================================
-- EXTRA USERS (team members for realistic data)
-- ============================================================

INSERT INTO users (id, email, full_name, is_global_admin, is_active) VALUES
  ('a1111111-1111-1111-1111-111111111111', 'rafaela.santos@onemonday.com', 'Rafaela Santos', false, true),
  ('a2222222-2222-2222-2222-222222222222', 'pedro.oliveira@onemonday.com', 'Pedro Oliveira', false, true),
  ('a3333333-3333-3333-3333-333333333333', 'juliana.costa@onemonday.com', 'Juliana Costa', false, true),
  ('a4444444-4444-4444-4444-444444444444', 'marcos.silva@onemonday.com', 'Marcos Silva', false, true)
ON CONFLICT (id) DO NOTHING;

-- Assign roles to new users in Desenvolvimento sector
INSERT INTO user_sector_roles (user_id, sector_id, role_id)
SELECT u.id, '3826e880-b077-4930-a676-7c5b96d10f63', r.id
FROM (VALUES
  ('a1111111-1111-1111-1111-111111111111'::uuid, 'manager'),
  ('a2222222-2222-2222-2222-222222222222'::uuid, 'analyst'),
  ('a3333333-3333-3333-3333-333333333333'::uuid, 'analyst'),
  ('a4444444-4444-4444-4444-444444444444'::uuid, 'analyst')
) AS u(id, role_slug)
JOIN roles r ON r.slug = u.role_slug
ON CONFLICT (user_id, sector_id) DO NOTHING;


-- ############################################################
--                     SUPPORT DESK MODULE
-- ############################################################

-- ============================================================
-- SUPPORT BOARD + COLUMNS
-- ============================================================

INSERT INTO boards (id, name, description, visibility, is_default, board_type, module_id, created_by)
VALUES (
  'b1000000-5a90-0000-0000-000000000001',
  'Tickets de Suporte',
  'Central de atendimento - tickets internos e de clientes',
  'sector',
  false,
  'support_tickets',
  (SELECT id FROM modules WHERE slug = 'support-desk'),
  '765672fc-f1ae-408d-9758-68cd0b2269d6'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO board_sectors (board_id, sector_id)
VALUES ('b1000000-5a90-0000-0000-000000000001', '3826e880-b077-4930-a676-7c5b96d10f63')
ON CONFLICT (board_id, sector_id) DO NOTHING;

INSERT INTO board_columns (id, board_id, name, color, position, is_done_column) VALUES
  ('c15a9001-c0d0-0000-0000-000000000001', 'b1000000-5a90-0000-0000-000000000001', 'Aberto',        '#ef4444', 1, false),
  ('c15a9001-c0d0-0000-0000-000000000002', 'b1000000-5a90-0000-0000-000000000001', 'Em Andamento',   '#f59e0b', 2, false),
  ('c15a9001-c0d0-0000-0000-000000000003', 'b1000000-5a90-0000-0000-000000000001', 'Aguardando',     '#6366f1', 3, false),
  ('c15a9001-c0d0-0000-0000-000000000004', 'b1000000-5a90-0000-0000-000000000001', 'Resolvido',      '#22c55e', 4, true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- SLA RULES (migration 00010 already seeds 4 rules for dev sector)
-- The existing rules are: critical 1h/4h, high 2h/8h, medium 4h/24h, low 8h/48h
-- We reference those existing ones for tickets below.
-- ============================================================

-- ============================================================
-- SUPPORT CARDS + TICKETS (8 tickets)
-- ============================================================

DO $$
DECLARE
  v_board_id   uuid := 'b1000000-5a90-0000-0000-000000000001';
  v_sector_id  uuid := '3826e880-b077-4930-a676-7c5b96d10f63';
  v_admin      uuid := '765672fc-f1ae-408d-9758-68cd0b2269d6';
  v_rafaela    uuid := 'a1111111-1111-1111-1111-111111111111';
  v_pedro      uuid := 'a2222222-2222-2222-2222-222222222222';
  v_juliana    uuid := 'a3333333-3333-3333-3333-333333333333';
  v_marcos     uuid := 'a4444444-4444-4444-4444-444444444444';

  v_col_aberto     uuid := 'c15a9001-c0d0-0000-0000-000000000001';
  v_col_andamento  uuid := 'c15a9001-c0d0-0000-0000-000000000002';
  v_col_aguardando uuid := 'c15a9001-c0d0-0000-0000-000000000003';
  v_col_resolvido  uuid := 'c15a9001-c0d0-0000-0000-000000000004';

  v_sla_critical uuid;
  v_sla_high     uuid;
  v_sla_medium   uuid;
  v_sla_low      uuid;

  v_card_id uuid;
BEGIN
  -- Fetch existing SLA rule IDs
  SELECT id INTO v_sla_critical FROM sla_rules WHERE sector_id = v_sector_id AND priority = 'critical' LIMIT 1;
  SELECT id INTO v_sla_high     FROM sla_rules WHERE sector_id = v_sector_id AND priority = 'high'     LIMIT 1;
  SELECT id INTO v_sla_medium   FROM sla_rules WHERE sector_id = v_sector_id AND priority = 'medium'   LIMIT 1;
  SELECT id INTO v_sla_low      FROM sla_rules WHERE sector_id = v_sector_id AND priority = 'low'      LIMIT 1;

  -- ---- Ticket 1: CRITICAL, Em Andamento, SLA breached response ----
  v_card_id := 'cd100000-f001-0000-0000-000000000001'::uuid;
  INSERT INTO cards (id, board_id, column_id, sector_id, title, description, position, priority, created_by, created_at)
  VALUES (v_card_id, v_board_id, v_col_andamento, v_sector_id,
    'Sistema fora do ar - erro 503 em producao',
    'Clientes reportando pagina de erro 503 ao acessar o dashboard. Monitoramento Datadog confirma queda do servico principal.',
    1, 'critical', v_admin, now() - interval '6 hours')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO card_assignees (card_id, user_id) VALUES (v_card_id, v_pedro) ON CONFLICT DO NOTHING;
  INSERT INTO support_tickets (card_id, sector_id, category, subcategory, channel, requester_email, sla_rule_id, sla_response_due_at, sla_resolve_due_at, sla_response_breached, first_response_at)
  VALUES (v_card_id, v_sector_id, 'Infraestrutura', 'Indisponibilidade', 'email', 'ti@clientealpha.com.br', v_sla_critical,
    now() - interval '5 hours', now() + interval '2 hours', true, now() - interval '4 hours')
  ON CONFLICT (card_id) DO NOTHING;

  -- ---- Ticket 2: HIGH, Aberto ----
  v_card_id := 'cd100000-f002-0000-0000-000000000002'::uuid;
  INSERT INTO cards (id, board_id, column_id, sector_id, title, description, position, priority, created_by, created_at)
  VALUES (v_card_id, v_board_id, v_col_aberto, v_sector_id,
    'Relatorio financeiro com dados incorretos',
    'O relatorio de faturamento mensal esta mostrando valores divergentes do ERP. Provavel problema na integracao de dados.',
    1, 'high', v_admin, now() - interval '3 hours')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO card_assignees (card_id, user_id) VALUES (v_card_id, v_juliana) ON CONFLICT DO NOTHING;
  INSERT INTO support_tickets (card_id, sector_id, category, subcategory, channel, requester_email, sla_rule_id, sla_response_due_at, sla_resolve_due_at)
  VALUES (v_card_id, v_sector_id, 'Dados', 'Relatorio', 'internal', 'financeiro@onemonday.com', v_sla_high,
    now() + interval '1 hour', now() + interval '21 hours')
  ON CONFLICT (card_id) DO NOTHING;

  -- ---- Ticket 3: MEDIUM, Em Andamento ----
  v_card_id := 'cd100000-f003-0000-0000-000000000003'::uuid;
  INSERT INTO cards (id, board_id, column_id, sector_id, title, description, position, priority, created_by, created_at)
  VALUES (v_card_id, v_board_id, v_col_andamento, v_sector_id,
    'Permissao de acesso negada no modulo CRM',
    'Usuario do setor comercial nao consegue acessar a aba de propostas. Erro 403 ao tentar listar deals.',
    2, 'medium', v_admin, now() - interval '1 day')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO card_assignees (card_id, user_id) VALUES (v_card_id, v_marcos) ON CONFLICT DO NOTHING;
  INSERT INTO support_tickets (card_id, sector_id, category, channel, requester_id, sla_rule_id, sla_response_due_at, sla_resolve_due_at, first_response_at)
  VALUES (v_card_id, v_sector_id, 'Acesso', 'internal', v_rafaela, v_sla_medium,
    now() - interval '20 hours', now() + interval '1 day', now() - interval '22 hours')
  ON CONFLICT (card_id) DO NOTHING;

  -- ---- Ticket 4: LOW, Aguardando ----
  v_card_id := 'cd100000-f004-0000-0000-000000000004'::uuid;
  INSERT INTO cards (id, board_id, column_id, sector_id, title, description, position, priority, created_by, created_at)
  VALUES (v_card_id, v_board_id, v_col_aguardando, v_sector_id,
    'Solicitacao de novo campo customizado no board',
    'Gerente do comercial solicitou campo "Origem do Lead" nos cards do pipeline CRM. Aguardando aprovacao do PO.',
    1, 'low', v_admin, now() - interval '3 days')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO support_tickets (card_id, sector_id, category, channel, requester_id, sla_rule_id, sla_response_due_at, sla_resolve_due_at, first_response_at)
  VALUES (v_card_id, v_sector_id, 'Feature Request', 'chat', v_admin, v_sla_low,
    now() - interval '2 days', now() + interval '2 days', now() - interval '2 days 20 hours')
  ON CONFLICT (card_id) DO NOTHING;

  -- ---- Ticket 5: HIGH, Aberto ----
  v_card_id := 'cd100000-f005-0000-0000-000000000005'::uuid;
  INSERT INTO cards (id, board_id, column_id, sector_id, title, description, position, priority, created_by, created_at)
  VALUES (v_card_id, v_board_id, v_col_aberto, v_sector_id,
    'Notificacoes por email nao estao sendo enviadas',
    'Usuarios reportam que nao recebem emails de notificacao desde segunda-feira. SMTP pode estar com problema.',
    2, 'high', v_admin, now() - interval '2 hours')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO card_assignees (card_id, user_id) VALUES (v_card_id, v_pedro) ON CONFLICT DO NOTHING;
  INSERT INTO support_tickets (card_id, sector_id, category, channel, requester_email, sla_rule_id, sla_response_due_at, sla_resolve_due_at)
  VALUES (v_card_id, v_sector_id, 'Infraestrutura', 'email', 'suporte@clientebeta.com.br', v_sla_high,
    now() + interval '2 hours', now() + interval '22 hours')
  ON CONFLICT (card_id) DO NOTHING;

  -- ---- Ticket 6: MEDIUM, Resolvido, com CSAT ----
  v_card_id := 'cd100000-f006-0000-0000-000000000006'::uuid;
  INSERT INTO cards (id, board_id, column_id, sector_id, title, description, position, priority, completed_at, created_by, created_at)
  VALUES (v_card_id, v_board_id, v_col_resolvido, v_sector_id,
    'Erro ao exportar PDF do kanban',
    'Ao clicar em exportar PDF, o sistema retornava timeout. Corrigido ajustando o tamanho maximo de renderizacao.',
    1, 'medium', now() - interval '1 day', v_admin, now() - interval '4 days')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO card_assignees (card_id, user_id) VALUES (v_card_id, v_juliana) ON CONFLICT DO NOTHING;
  INSERT INTO support_tickets (card_id, sector_id, category, channel, requester_email, sla_rule_id, sla_response_due_at, sla_resolve_due_at, first_response_at, resolved_at, csat_rating, csat_comment, csat_submitted_at)
  VALUES (v_card_id, v_sector_id, 'Bug', 'email', 'gerencia@clientegamma.com.br', v_sla_medium,
    now() - interval '3 days 20 hours', now() - interval '2 days', now() - interval '3 days 22 hours',
    now() - interval '1 day', 5, 'Resolvido rapidamente, excelente atendimento!', now() - interval '12 hours')
  ON CONFLICT (card_id) DO NOTHING;

  -- ---- Ticket 7: CRITICAL, Resolvido, com CSAT ----
  v_card_id := 'cd100000-f007-0000-0000-000000000007'::uuid;
  INSERT INTO cards (id, board_id, column_id, sector_id, title, description, position, priority, completed_at, created_by, created_at)
  VALUES (v_card_id, v_board_id, v_col_resolvido, v_sector_id,
    'Vazamento de memoria no servidor de websocket',
    'O servidor de realtime estava consumindo 98% da RAM apos 48h. Identificado leak no gerenciamento de conexoes.',
    2, 'critical', now() - interval '2 days', v_admin, now() - interval '5 days')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO card_assignees (card_id, user_id) VALUES (v_card_id, v_admin) ON CONFLICT DO NOTHING;
  INSERT INTO support_tickets (card_id, sector_id, category, subcategory, channel, requester_email, sla_rule_id, sla_response_due_at, sla_resolve_due_at, first_response_at, resolved_at, csat_rating, csat_comment, csat_submitted_at)
  VALUES (v_card_id, v_sector_id, 'Infraestrutura', 'Performance', 'phone', 'infra@clientedelta.com.br', v_sla_critical,
    now() - interval '4 days 23 hours', now() - interval '4 days 20 hours', now() - interval '4 days 23 hours 30 minutes',
    now() - interval '2 days', 4, 'Resolvido, mas demorou um pouco mais do que o esperado.', now() - interval '1 day 12 hours')
  ON CONFLICT (card_id) DO NOTHING;

  -- ---- Ticket 8: MEDIUM, Resolvido, com CSAT ruim ----
  v_card_id := 'cd100000-f008-0000-0000-000000000008'::uuid;
  INSERT INTO cards (id, board_id, column_id, sector_id, title, description, position, priority, completed_at, created_by, created_at)
  VALUES (v_card_id, v_board_id, v_col_resolvido, v_sector_id,
    'Layout quebrado no Safari iOS',
    'A visualizacao kanban nao funciona corretamente no Safari do iPhone. Colunas sobrepoem umas nas outras.',
    3, 'medium', now() - interval '6 days', v_admin, now() - interval '10 days')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO card_assignees (card_id, user_id) VALUES (v_card_id, v_marcos) ON CONFLICT DO NOTHING;
  INSERT INTO support_tickets (card_id, sector_id, category, channel, requester_email, sla_rule_id, sla_response_due_at, sla_resolve_due_at, first_response_at, resolved_at, sla_resolve_breached, csat_rating, csat_comment, csat_submitted_at)
  VALUES (v_card_id, v_sector_id, 'Bug', 'chat', 'usuario@clienteepsilon.com.br', v_sla_medium,
    now() - interval '9 days 20 hours', now() - interval '8 days', now() - interval '9 days 22 hours',
    now() - interval '6 days', true, 2, 'Demorou muito para resolver. Tivemos que usar Chrome enquanto isso.', now() - interval '5 days')
  ON CONFLICT (card_id) DO NOTHING;
END;
$$;

-- ============================================================
-- KNOWLEDGE BASE ARTICLES (5)
-- ============================================================

INSERT INTO kb_articles (sector_id, title, content, category, tags, author_id, is_published, view_count) VALUES
  ('3826e880-b077-4930-a676-7c5b96d10f63',
   'Como resetar senha de usuario',
   E'## Resetar Senha\n\n1. Acesse **Configuracoes > Usuarios**\n2. Localize o usuario pelo email\n3. Clique em **Acoes > Resetar Senha**\n4. O usuario recebera um email com link de redefinicao valido por 24h\n\n**Nota:** Se o email nao chegar, verifique a pasta de spam ou contate o suporte tecnico.',
   'FAQ', ARRAY['senha', 'acesso', 'usuario'], '765672fc-f1ae-408d-9758-68cd0b2269d6', true, 142),

  ('3826e880-b077-4930-a676-7c5b96d10f63',
   'Troubleshooting: Erro 403 - Acesso Negado',
   E'## Diagnostico de Erro 403\n\nO erro 403 indica que o usuario esta autenticado mas nao tem permissao para o recurso.\n\n### Causas comuns:\n- Usuario nao esta vinculado ao setor correto\n- Role do usuario nao tem a permissao necessaria\n- Modulo nao esta habilitado para o setor\n\n### Como resolver:\n1. Verifique em **Configuracoes > Usuarios** se o usuario tem role no setor\n2. Confira em **Configuracoes > Modulos** se o modulo esta ativo\n3. Revise as permissoes da role em **Configuracoes > Roles**\n\nSe o problema persistir, escale para o time de desenvolvimento.',
   'Troubleshooting', ARRAY['erro', '403', 'permissao', 'acesso'], 'a1111111-1111-1111-1111-111111111111', true, 87),

  ('3826e880-b077-4930-a676-7c5b96d10f63',
   'Guia: Configurando SLA para novos setores',
   E'## Configuracao de SLA\n\nCada setor pode ter regras de SLA independentes por prioridade.\n\n### Passos:\n1. Acesse **Support Desk > Configuracoes > SLA**\n2. Clique em **Nova Regra**\n3. Defina:\n   - **Prioridade**: Critica, Alta, Media ou Baixa\n   - **Tempo de resposta**: Horas para primeira resposta\n   - **Tempo de resolucao**: Horas para resolucao completa\n   - **Horario comercial**: Se a contagem considera apenas dias uteis\n4. Salve e a regra sera aplicada automaticamente a novos tickets\n\n### Boas praticas:\n- Critico: max 1h resposta / 4h resolucao\n- Alto: max 2h resposta / 8h resolucao\n- Medio: max 4h resposta / 24h resolucao\n- Baixo: max 8h resposta / 48h resolucao',
   'Guia', ARRAY['sla', 'configuracao', 'suporte'], '765672fc-f1ae-408d-9758-68cd0b2269d6', true, 53),

  ('3826e880-b077-4930-a676-7c5b96d10f63',
   'FAQ: Como criar e gerenciar boards',
   E'## Gerenciamento de Boards\n\n### Criar um novo board:\n1. Clique no **+** no menu lateral\n2. Preencha nome e descricao\n3. Selecione a visibilidade (setor, cross-sector ou global)\n4. O board sera criado com 4 colunas padrao\n\n### Personalizar colunas:\n- Arraste para reordenar\n- Clique no nome para renomear\n- Use o menu **...** para alterar cor ou definir limite WIP\n\n### Dicas:\n- Marque um board como **padrao** para que ele abra automaticamente\n- Use **filtros salvos** para criar visoes personalizadas\n- Boards cross-sector permitem colaboracao entre times',
   'FAQ', ARRAY['board', 'kanban', 'colunas'], 'a1111111-1111-1111-1111-111111111111', true, 198),

  ('3826e880-b077-4930-a676-7c5b96d10f63',
   'Guia: Integracao com email para tickets',
   E'## Integracao Email > Tickets\n\nO Support Desk pode converter emails recebidos em tickets automaticamente.\n\n### Configuracao:\n1. Acesse **Support Desk > Configuracoes > Integracao Email**\n2. Configure o endereco de recebimento: suporte@seudominio.com\n3. Defina regras de roteamento:\n   - Por assunto: palavras-chave mapeiam para categorias\n   - Por remetente: dominios conhecidos vao para filas especificas\n4. Ative o processamento automatico\n\n### Comportamento:\n- Cada novo email cria um ticket com prioridade **media** (padrao)\n- Respostas ao ticket sao adicionadas como comentarios\n- Anexos sao salvos automaticamente no card\n\n**Importante:** Configure o SPF/DKIM do seu dominio para evitar rejeicao.',
   'Guia', ARRAY['email', 'integracao', 'ticket', 'automatico'], '765672fc-f1ae-408d-9758-68cd0b2269d6', false, 12)
ON CONFLICT DO NOTHING;

-- ============================================================
-- CANNED RESPONSES (4)
-- ============================================================

INSERT INTO canned_responses (sector_id, title, content, category, shortcut, created_by) VALUES
  ('3826e880-b077-4930-a676-7c5b96d10f63',
   'Saudacao inicial',
   E'Ola! Obrigado por entrar em contato com o suporte ONEmonday.\n\nRecebemos sua solicitacao e ja estamos analisando. Em breve um membro da equipe ira atende-lo.\n\nSe precisar de algo urgente, responda a esta mensagem com "URGENTE" no assunto.',
   'saudacao', '/ola',
   '765672fc-f1ae-408d-9758-68cd0b2269d6'),

  ('3826e880-b077-4930-a676-7c5b96d10f63',
   'Follow-up de ticket',
   E'Ola! Estamos acompanhando o andamento da sua solicitacao.\n\nGostaramos de saber se o problema persiste ou se houve alguma evolucao do seu lado. Caso ja tenha sido resolvido, por favor nos avise para que possamos encerrar o ticket.\n\nAguardamos seu retorno.',
   'follow_up', '/followup',
   'a1111111-1111-1111-1111-111111111111'),

  ('3826e880-b077-4930-a676-7c5b96d10f63',
   'Resolucao de ticket',
   E'Informamos que sua solicitacao foi resolvida.\n\n**Solucao aplicada:** [descrever aqui]\n\nCaso o problema volte a ocorrer, basta responder a esta mensagem e reabriremos o ticket automaticamente.\n\nAgradecemos a paciencia e ficamos a disposicao!',
   'resolucao', '/resolvido',
   '765672fc-f1ae-408d-9758-68cd0b2269d6'),

  ('3826e880-b077-4930-a676-7c5b96d10f63',
   'Escalonamento para equipe tecnica',
   E'Identificamos que sua solicitacao requer analise mais aprofundada da equipe tecnica.\n\nEstamos escalonando o ticket para o time de engenharia, que atuara com prioridade. Voce sera notificado assim que houver uma atualizacao.\n\nPrazo estimado para retorno: [X horas/dias uteis].',
   'escalonamento', '/escalar',
   'a1111111-1111-1111-1111-111111111111')
ON CONFLICT DO NOTHING;


-- ############################################################
--                        CRM MODULE
-- ############################################################

-- ============================================================
-- CRM BOARD + COLUMNS (6 pipeline stages)
-- ============================================================

INSERT INTO boards (id, name, description, visibility, is_default, board_type, module_id, created_by)
VALUES (
  'b2000000-c4e0-0000-0000-000000000001',
  'Pipeline Comercial',
  'Pipeline de vendas do setor de desenvolvimento - novos contratos e upsell',
  'sector',
  false,
  'crm_pipeline',
  (SELECT id FROM modules WHERE slug = 'crm'),
  '765672fc-f1ae-408d-9758-68cd0b2269d6'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO board_sectors (board_id, sector_id)
VALUES ('b2000000-c4e0-0000-0000-000000000001', '3826e880-b077-4930-a676-7c5b96d10f63')
ON CONFLICT (board_id, sector_id) DO NOTHING;

INSERT INTO board_columns (id, board_id, name, color, position, is_done_column) VALUES
  ('c2c4e001-c0d0-0000-0000-000000000001', 'b2000000-c4e0-0000-0000-000000000001', 'Lead',         '#94a3b8', 1, false),
  ('c2c4e001-c0d0-0000-0000-000000000002', 'b2000000-c4e0-0000-0000-000000000001', 'Qualificado',  '#3b82f6', 2, false),
  ('c2c4e001-c0d0-0000-0000-000000000003', 'b2000000-c4e0-0000-0000-000000000001', 'Proposta',     '#8b5cf6', 3, false),
  ('c2c4e001-c0d0-0000-0000-000000000004', 'b2000000-c4e0-0000-0000-000000000001', 'Negociacao',   '#f59e0b', 4, false),
  ('c2c4e001-c0d0-0000-0000-000000000005', 'b2000000-c4e0-0000-0000-000000000001', 'Ganho',        '#22c55e', 5, true),
  ('c2c4e001-c0d0-0000-0000-000000000006', 'b2000000-c4e0-0000-0000-000000000001', 'Perdido',      '#ef4444', 6, false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- CRM COMPANIES (6)
-- ============================================================

INSERT INTO crm_companies (id, sector_id, name, domain, industry, size, phone, email, city, state, owner_id) VALUES
  ('cc000001-c0e9-0000-0000-000000000001', '3826e880-b077-4930-a676-7c5b96d10f63',
   'TechNova Solucoes', 'technova.com.br', 'Tecnologia', 'medium',
   '(11) 3456-7890', 'contato@technova.com.br', 'Sao Paulo', 'SP', '765672fc-f1ae-408d-9758-68cd0b2269d6'),

  ('cc000002-c0e9-0000-0000-000000000002', '3826e880-b077-4930-a676-7c5b96d10f63',
   'DataFlow Consultoria', 'dataflow.io', 'Consultoria', 'small',
   '(21) 2345-6789', 'comercial@dataflow.io', 'Rio de Janeiro', 'RJ', 'a1111111-1111-1111-1111-111111111111'),

  ('cc000003-c0e9-0000-0000-000000000003', '3826e880-b077-4930-a676-7c5b96d10f63',
   'Inova Digital LTDA', 'inovadigital.com.br', 'Marketing Digital', 'small',
   '(31) 3344-5566', 'oi@inovadigital.com.br', 'Belo Horizonte', 'MG', 'a2222222-2222-2222-2222-222222222222'),

  ('cc000004-c0e9-0000-0000-000000000004', '3826e880-b077-4930-a676-7c5b96d10f63',
   'CloudBridge Tecnologia', 'cloudbridge.tech', 'Cloud/SaaS', 'large',
   '(41) 4455-6677', 'vendas@cloudbridge.tech', 'Curitiba', 'PR', '765672fc-f1ae-408d-9758-68cd0b2269d6'),

  ('cc000005-c0e9-0000-0000-000000000005', '3826e880-b077-4930-a676-7c5b96d10f63',
   'Agile Partners', 'agilepartners.com.br', 'Consultoria', 'micro',
   '(51) 5566-7788', 'hello@agilepartners.com.br', 'Porto Alegre', 'RS', 'a3333333-3333-3333-3333-333333333333'),

  ('cc000006-c0e9-0000-0000-000000000006', '3826e880-b077-4930-a676-7c5b96d10f63',
   'FinTech Solutions SA', 'fintechsol.com.br', 'Financeiro', 'enterprise',
   '(11) 5577-8899', 'enterprise@fintechsol.com.br', 'Sao Paulo', 'SP', '765672fc-f1ae-408d-9758-68cd0b2269d6')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- CRM CONTACTS (10)
-- ============================================================

INSERT INTO crm_contacts (id, sector_id, company_id, full_name, email, phone, position, is_primary, owner_id) VALUES
  -- TechNova (2 contacts)
  ('cf000001-c00f-0000-0000-000000000001', '3826e880-b077-4930-a676-7c5b96d10f63',
   'cc000001-c0e9-0000-0000-000000000001', 'Carlos Mendes', 'carlos.mendes@technova.com.br', '(11) 99876-5432', 'CTO', true, '765672fc-f1ae-408d-9758-68cd0b2269d6'),
  ('cf000002-c00f-0000-0000-000000000002', '3826e880-b077-4930-a676-7c5b96d10f63',
   'cc000001-c0e9-0000-0000-000000000001', 'Fernanda Lima', 'fernanda.lima@technova.com.br', '(11) 99765-4321', 'Gerente de Projetos', false, '765672fc-f1ae-408d-9758-68cd0b2269d6'),

  -- DataFlow (2 contacts)
  ('cf000003-c00f-0000-0000-000000000003', '3826e880-b077-4930-a676-7c5b96d10f63',
   'cc000002-c0e9-0000-0000-000000000002', 'Ricardo Alves', 'ricardo@dataflow.io', '(21) 98765-1234', 'CEO', true, 'a1111111-1111-1111-1111-111111111111'),
  ('cf000004-c00f-0000-0000-000000000004', '3826e880-b077-4930-a676-7c5b96d10f63',
   'cc000002-c0e9-0000-0000-000000000002', 'Beatriz Rocha', 'beatriz@dataflow.io', '(21) 98654-3210', 'Diretora Comercial', false, 'a1111111-1111-1111-1111-111111111111'),

  -- Inova Digital (1 contact)
  ('cf000005-c00f-0000-0000-000000000005', '3826e880-b077-4930-a676-7c5b96d10f63',
   'cc000003-c0e9-0000-0000-000000000003', 'Thiago Nascimento', 'thiago@inovadigital.com.br', '(31) 99887-6655', 'Fundador', true, 'a2222222-2222-2222-2222-222222222222'),

  -- CloudBridge (2 contacts)
  ('cf000006-c00f-0000-0000-000000000006', '3826e880-b077-4930-a676-7c5b96d10f63',
   'cc000004-c0e9-0000-0000-000000000004', 'Amanda Ferreira', 'amanda.ferreira@cloudbridge.tech', '(41) 99776-5544', 'VP de Engenharia', true, '765672fc-f1ae-408d-9758-68cd0b2269d6'),
  ('cf000007-c00f-0000-0000-000000000007', '3826e880-b077-4930-a676-7c5b96d10f63',
   'cc000004-c0e9-0000-0000-000000000004', 'Felipe Goncalves', 'felipe.g@cloudbridge.tech', '(41) 99665-4433', 'Gerente de Compras', false, '765672fc-f1ae-408d-9758-68cd0b2269d6'),

  -- Agile Partners (1 contact)
  ('cf000008-c00f-0000-0000-000000000008', '3826e880-b077-4930-a676-7c5b96d10f63',
   'cc000005-c0e9-0000-0000-000000000005', 'Luisa Barbosa', 'luisa@agilepartners.com.br', '(51) 99554-3322', 'Socia-fundadora', true, 'a3333333-3333-3333-3333-333333333333'),

  -- FinTech Solutions (2 contacts)
  ('cf000009-c00f-0000-0000-000000000009', '3826e880-b077-4930-a676-7c5b96d10f63',
   'cc000006-c0e9-0000-0000-000000000006', 'Roberto Dias', 'roberto.dias@fintechsol.com.br', '(11) 99443-2211', 'CIO', true, '765672fc-f1ae-408d-9758-68cd0b2269d6'),
  ('cf000010-c00f-0000-0000-000000000010', '3826e880-b077-4930-a676-7c5b96d10f63',
   'cc000006-c0e9-0000-0000-000000000006', 'Patricia Moura', 'patricia.moura@fintechsol.com.br', '(11) 99332-1100', 'Head de Inovacao', false, '765672fc-f1ae-408d-9758-68cd0b2269d6')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- CRM DEAL CARDS + DEALS (8)
-- ============================================================

DO $$
DECLARE
  v_board_id   uuid := 'b2000000-c4e0-0000-0000-000000000001';
  v_sector_id  uuid := '3826e880-b077-4930-a676-7c5b96d10f63';
  v_admin      uuid := '765672fc-f1ae-408d-9758-68cd0b2269d6';
  v_rafaela    uuid := 'a1111111-1111-1111-1111-111111111111';
  v_pedro      uuid := 'a2222222-2222-2222-2222-222222222222';
  v_juliana    uuid := 'a3333333-3333-3333-3333-333333333333';

  v_col_lead       uuid := 'c2c4e001-c0d0-0000-0000-000000000001';
  v_col_qualif     uuid := 'c2c4e001-c0d0-0000-0000-000000000002';
  v_col_proposta   uuid := 'c2c4e001-c0d0-0000-0000-000000000003';
  v_col_negociacao uuid := 'c2c4e001-c0d0-0000-0000-000000000004';
  v_col_ganho      uuid := 'c2c4e001-c0d0-0000-0000-000000000005';
  v_col_perdido    uuid := 'c2c4e001-c0d0-0000-0000-000000000006';

  v_card_id uuid;
BEGIN
  -- Deal 1: TechNova - Lead (R$45k)
  v_card_id := 'cd200000-d001-0000-0000-000000000001'::uuid;
  INSERT INTO cards (id, board_id, column_id, sector_id, title, description, position, priority, due_date, created_by, created_at)
  VALUES (v_card_id, v_board_id, v_col_lead, v_sector_id,
    'TechNova - Licenciamento Enterprise',
    'TechNova demonstrou interesse no plano Enterprise para 80 usuarios. Primeiro contato via LinkedIn.',
    1, 'medium', CURRENT_DATE + interval '30 days', v_admin, now() - interval '2 days')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO card_assignees (card_id, user_id) VALUES (v_card_id, v_admin) ON CONFLICT DO NOTHING;
  INSERT INTO crm_deals (card_id, sector_id, company_id, contact_id, value, expected_close_date, win_probability, source)
  VALUES (v_card_id, v_sector_id,
    'cc000001-c0e9-0000-0000-000000000001', 'cf000001-c00f-0000-0000-000000000001',
    45000.00, CURRENT_DATE + interval '30 days', 20, 'LinkedIn')
  ON CONFLICT (card_id) DO NOTHING;

  -- Deal 2: DataFlow - Qualificado (R$18k)
  v_card_id := 'cd200000-d002-0000-0000-000000000002'::uuid;
  INSERT INTO cards (id, board_id, column_id, sector_id, title, description, position, priority, due_date, created_by, created_at)
  VALUES (v_card_id, v_board_id, v_col_qualif, v_sector_id,
    'DataFlow - Plano Pro + Support Desk',
    'Consultoria interessada no combo Pro + modulo de suporte. Ja fizemos demo, feedback positivo.',
    1, 'high', CURRENT_DATE + interval '15 days', v_rafaela, now() - interval '7 days')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO card_assignees (card_id, user_id) VALUES (v_card_id, v_rafaela) ON CONFLICT DO NOTHING;
  INSERT INTO crm_deals (card_id, sector_id, company_id, contact_id, value, expected_close_date, win_probability, source)
  VALUES (v_card_id, v_sector_id,
    'cc000002-c0e9-0000-0000-000000000002', 'cf000003-c00f-0000-0000-000000000003',
    18000.00, CURRENT_DATE + interval '15 days', 50, 'Indicacao')
  ON CONFLICT (card_id) DO NOTHING;

  -- Deal 3: Inova Digital - Proposta (R$8.5k)
  v_card_id := 'cd200000-d003-0000-0000-000000000003'::uuid;
  INSERT INTO cards (id, board_id, column_id, sector_id, title, description, position, priority, due_date, created_by, created_at)
  VALUES (v_card_id, v_board_id, v_col_proposta, v_sector_id,
    'Inova Digital - Plano Starter',
    'Startup de marketing digital precisa de kanban + CRM basico. Proposta enviada na segunda.',
    1, 'medium', CURRENT_DATE + interval '10 days', v_pedro, now() - interval '12 days')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO card_assignees (card_id, user_id) VALUES (v_card_id, v_pedro) ON CONFLICT DO NOTHING;
  INSERT INTO crm_deals (card_id, sector_id, company_id, contact_id, value, expected_close_date, win_probability, source)
  VALUES (v_card_id, v_sector_id,
    'cc000003-c0e9-0000-0000-000000000003', 'cf000005-c00f-0000-0000-000000000005',
    8500.00, CURRENT_DATE + interval '10 days', 65, 'Site')
  ON CONFLICT (card_id) DO NOTHING;

  -- Deal 4: CloudBridge - Negociacao (R$120k)
  v_card_id := 'cd200000-d004-0000-0000-000000000004'::uuid;
  INSERT INTO cards (id, board_id, column_id, sector_id, title, description, position, priority, due_date, created_by, created_at)
  VALUES (v_card_id, v_board_id, v_col_negociacao, v_sector_id,
    'CloudBridge - Contrato Enterprise Anual',
    'Negociacao de contrato enterprise para 200 usuarios. Discutindo desconto por volume e SLA customizado.',
    1, 'critical', CURRENT_DATE + interval '7 days', v_admin, now() - interval '20 days')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO card_assignees (card_id, user_id) VALUES (v_card_id, v_admin) ON CONFLICT DO NOTHING;
  INSERT INTO crm_deals (card_id, sector_id, company_id, contact_id, value, expected_close_date, win_probability, source)
  VALUES (v_card_id, v_sector_id,
    'cc000004-c0e9-0000-0000-000000000004', 'cf000006-c00f-0000-0000-000000000006',
    120000.00, CURRENT_DATE + interval '7 days', 75, 'Evento')
  ON CONFLICT (card_id) DO NOTHING;

  -- Deal 5: Agile Partners - Lead (R$5k)
  v_card_id := 'cd200000-d005-0000-0000-000000000005'::uuid;
  INSERT INTO cards (id, board_id, column_id, sector_id, title, description, position, priority, created_by, created_at)
  VALUES (v_card_id, v_board_id, v_col_lead, v_sector_id,
    'Agile Partners - Plano Basico',
    'Consultoria pequena buscando ferramenta de gestao de projetos. Contato inicial por email.',
    2, 'low', v_juliana, now() - interval '1 day')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO card_assignees (card_id, user_id) VALUES (v_card_id, v_juliana) ON CONFLICT DO NOTHING;
  INSERT INTO crm_deals (card_id, sector_id, company_id, contact_id, value, expected_close_date, win_probability, source)
  VALUES (v_card_id, v_sector_id,
    'cc000005-c0e9-0000-0000-000000000005', 'cf000008-c00f-0000-0000-000000000008',
    5000.00, CURRENT_DATE + interval '45 days', 15, 'Email')
  ON CONFLICT (card_id) DO NOTHING;

  -- Deal 6: FinTech - Negociacao (R$200k)
  v_card_id := 'cd200000-d006-0000-0000-000000000006'::uuid;
  INSERT INTO cards (id, board_id, column_id, sector_id, title, description, position, priority, due_date, created_by, created_at)
  VALUES (v_card_id, v_board_id, v_col_negociacao, v_sector_id,
    'FinTech Solutions - Plataforma Completa',
    'Deal estrategico: todos os modulos + API dedicada + SLA Premium. Juridico esta revisando o contrato.',
    2, 'critical', CURRENT_DATE + interval '5 days', v_admin, now() - interval '30 days')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO card_assignees (card_id, user_id) VALUES (v_card_id, v_admin) ON CONFLICT DO NOTHING;
  INSERT INTO crm_deals (card_id, sector_id, company_id, contact_id, value, expected_close_date, win_probability, source)
  VALUES (v_card_id, v_sector_id,
    'cc000006-c0e9-0000-0000-000000000006', 'cf000009-c00f-0000-0000-000000000009',
    200000.00, CURRENT_DATE + interval '5 days', 80, 'Evento')
  ON CONFLICT (card_id) DO NOTHING;

  -- Deal 7: TechNova (2nd deal) - Ganho (R$32k)
  v_card_id := 'cd200000-d007-0000-0000-000000000007'::uuid;
  INSERT INTO cards (id, board_id, column_id, sector_id, title, description, position, priority, completed_at, created_by, created_at)
  VALUES (v_card_id, v_board_id, v_col_ganho, v_sector_id,
    'TechNova - Upgrade Plano Pro',
    'Upgrade do plano Starter para Pro realizado com sucesso. Contrato de 12 meses assinado.',
    1, 'high', now() - interval '5 days', v_admin, now() - interval '45 days')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO card_assignees (card_id, user_id) VALUES (v_card_id, v_admin) ON CONFLICT DO NOTHING;
  INSERT INTO crm_deals (card_id, sector_id, company_id, contact_id, value, expected_close_date, actual_close_date, win_probability, source)
  VALUES (v_card_id, v_sector_id,
    'cc000001-c0e9-0000-0000-000000000001', 'cf000002-c00f-0000-0000-000000000002',
    32000.00, CURRENT_DATE - interval '7 days', CURRENT_DATE - interval '5 days', 100, 'Upsell')
  ON CONFLICT (card_id) DO NOTHING;

  -- Deal 8: DataFlow (2nd deal) - Perdido (R$15k)
  v_card_id := 'cd200000-d008-0000-0000-000000000008'::uuid;
  INSERT INTO cards (id, board_id, column_id, sector_id, title, description, position, priority, created_by, created_at)
  VALUES (v_card_id, v_board_id, v_col_perdido, v_sector_id,
    'DataFlow - Modulo Analytics',
    'Proposta para modulo de Analytics avancado. Perdemos para concorrente com preco menor.',
    1, 'medium', v_rafaela, now() - interval '25 days')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO crm_deals (card_id, sector_id, company_id, contact_id, value, expected_close_date, actual_close_date, lost_reason, win_probability, source)
  VALUES (v_card_id, v_sector_id,
    'cc000002-c0e9-0000-0000-000000000002', 'cf000004-c00f-0000-0000-000000000004',
    15000.00, CURRENT_DATE - interval '10 days', CURRENT_DATE - interval '10 days',
    'Concorrente com preco mais competitivo. Cliente optou por solucao com custo 30% menor.',
    0, 'Indicacao')
  ON CONFLICT (card_id) DO NOTHING;
END;
$$;

-- ============================================================
-- CRM ACTIVITIES (12)
-- ============================================================

DO $$
DECLARE
  v_sector_id uuid := '3826e880-b077-4930-a676-7c5b96d10f63';
  v_admin     uuid := '765672fc-f1ae-408d-9758-68cd0b2269d6';
  v_rafaela   uuid := 'a1111111-1111-1111-1111-111111111111';
  v_pedro     uuid := 'a2222222-2222-2222-2222-222222222222';
  v_juliana   uuid := 'a3333333-3333-3333-3333-333333333333';

  v_deal1 uuid;
  v_deal2 uuid;
  v_deal3 uuid;
  v_deal4 uuid;
  v_deal6 uuid;
  v_deal7 uuid;
BEGIN
  SELECT id INTO v_deal1 FROM crm_deals WHERE card_id = 'cd200000-d001-0000-0000-000000000001';
  SELECT id INTO v_deal2 FROM crm_deals WHERE card_id = 'cd200000-d002-0000-0000-000000000002';
  SELECT id INTO v_deal3 FROM crm_deals WHERE card_id = 'cd200000-d003-0000-0000-000000000003';
  SELECT id INTO v_deal4 FROM crm_deals WHERE card_id = 'cd200000-d004-0000-0000-000000000004';
  SELECT id INTO v_deal6 FROM crm_deals WHERE card_id = 'cd200000-d006-0000-0000-000000000006';
  SELECT id INTO v_deal7 FROM crm_deals WHERE card_id = 'cd200000-d007-0000-0000-000000000007';

  INSERT INTO crm_activities (sector_id, deal_id, contact_id, company_id, type, subject, description, scheduled_at, completed_at, duration_min, performed_by) VALUES
    -- TechNova Lead - ligacao inicial
    (v_sector_id, v_deal1, 'cf000001-c00f-0000-0000-000000000001', 'cc000001-c0e9-0000-0000-000000000001',
     'call', 'Ligacao de qualificacao com Carlos Mendes',
     'Carlos demonstrou interesse em centralizar gestao de projetos. Atualmente usa Trello + Excel. 80 usuarios.',
     now() - interval '1 day', now() - interval '1 day', 25, v_admin),

    -- DataFlow - demo
    (v_sector_id, v_deal2, 'cf000003-c00f-0000-0000-000000000003', 'cc000002-c0e9-0000-0000-000000000002',
     'meeting', 'Demo do produto para DataFlow',
     'Apresentacao completa com foco no kanban e modulo de suporte. Ricardo gostou da integracao entre modulos.',
     now() - interval '5 days', now() - interval '5 days', 60, v_rafaela),

    -- DataFlow - follow-up email
    (v_sector_id, v_deal2, 'cf000003-c00f-0000-0000-000000000003', 'cc000002-c0e9-0000-0000-000000000002',
     'email', 'Follow-up pos-demo DataFlow',
     'Enviado email com resumo da demo, link para trial e comparativo de planos.',
     now() - interval '4 days', now() - interval '4 days', 10, v_rafaela),

    -- Inova Digital - proposta enviada
    (v_sector_id, v_deal3, 'cf000005-c00f-0000-0000-000000000005', 'cc000003-c0e9-0000-0000-000000000003',
     'email', 'Envio de proposta comercial Inova Digital',
     'Proposta do plano Starter com desconto de 10% para pagamento anual antecipado.',
     now() - interval '3 days', now() - interval '3 days', 15, v_pedro),

    -- CloudBridge - reuniao de negociacao
    (v_sector_id, v_deal4, 'cf000006-c00f-0000-0000-000000000006', 'cc000004-c0e9-0000-0000-000000000004',
     'meeting', 'Reuniao de negociacao CloudBridge',
     'Discutido desconto de 15% por volume (200 usuarios). Amanda solicitou SLA customizado com 99.9% uptime.',
     now() - interval '3 days', now() - interval '3 days', 90, v_admin),

    -- CloudBridge - nota interna
    (v_sector_id, v_deal4, NULL, 'cc000004-c0e9-0000-0000-000000000004',
     'note', 'Analise interna: desconto CloudBridge',
     'Desconto de 15% aprovado pela diretoria. Margem ainda em 42%. SLA customizado precisa validar com infra.',
     now() - interval '2 days', now() - interval '2 days', NULL, v_admin),

    -- CloudBridge - call de follow-up
    (v_sector_id, v_deal4, 'cf000007-c00f-0000-0000-000000000007', 'cc000004-c0e9-0000-0000-000000000004',
     'call', 'Alinhamento com Compras CloudBridge',
     'Felipe confirmou que o processo de compra esta com juridico. Previsao de retorno em 5 dias uteis.',
     now() - interval '1 day', now() - interval '1 day', 20, v_admin),

    -- FinTech - reuniao executiva
    (v_sector_id, v_deal6, 'cf000009-c00f-0000-0000-000000000009', 'cc000006-c0e9-0000-0000-000000000006',
     'meeting', 'Apresentacao executiva FinTech Solutions',
     'Reuniao com CIO e Head de Inovacao. Apresentamos roadmap e plano de implantacao em fases.',
     now() - interval '10 days', now() - interval '10 days', 120, v_admin),

    -- FinTech - email de contrato
    (v_sector_id, v_deal6, 'cf000009-c00f-0000-0000-000000000009', 'cc000006-c0e9-0000-0000-000000000006',
     'email', 'Envio de contrato FinTech Solutions',
     'Contrato enviado para revisao juridica. Inclui clausula de SLA Premium e API dedicada.',
     now() - interval '5 days', now() - interval '5 days', 10, v_admin),

    -- FinTech - task de acompanhamento
    (v_sector_id, v_deal6, NULL, 'cc000006-c0e9-0000-0000-000000000006',
     'task', 'Preparar ambiente de POC para FinTech',
     'Criar tenant isolado com dados de exemplo do setor financeiro para validacao tecnica.',
     now() + interval '2 days', NULL, NULL, v_pedro),

    -- TechNova Upgrade - reuniao de fechamento
    (v_sector_id, v_deal7, 'cf000002-c00f-0000-0000-000000000002', 'cc000001-c0e9-0000-0000-000000000001',
     'meeting', 'Reuniao de fechamento upgrade TechNova',
     'Fernanda aprovou o upgrade. Contrato assinado digitalmente via DocuSign.',
     now() - interval '6 days', now() - interval '6 days', 45, v_admin),

    -- Agile Partners - nota
    (v_sector_id, NULL, 'cf000008-c00f-0000-0000-000000000008', 'cc000005-c0e9-0000-0000-000000000005',
     'note', 'Pesquisa sobre Agile Partners',
     'Empresa tem 12 funcionarios. Principal dor: falta de visibilidade de tarefas entre equipes remotas.',
     now() - interval '1 day', now() - interval '1 day', NULL, v_juliana);
END;
$$;

-- ============================================================
-- CRM PROPOSALS (2)
-- ============================================================

DO $$
DECLARE
  v_sector_id uuid := '3826e880-b077-4930-a676-7c5b96d10f63';
  v_admin     uuid := '765672fc-f1ae-408d-9758-68cd0b2269d6';
  v_pedro     uuid := 'a2222222-2222-2222-2222-222222222222';
  v_deal3     uuid;
  v_deal7     uuid;
BEGIN
  SELECT id INTO v_deal3 FROM crm_deals WHERE card_id = 'cd200000-d003-0000-0000-000000000003';
  SELECT id INTO v_deal7 FROM crm_deals WHERE card_id = 'cd200000-d007-0000-0000-000000000007';

  INSERT INTO crm_proposals (deal_id, sector_id, title, content, value, status, sent_at, expires_at, created_by) VALUES
    -- Proposta enviada (Inova Digital)
    (v_deal3, v_sector_id,
     'Proposta Comercial - Inova Digital - Plano Starter',
     E'## Proposta Comercial ONEmonday\n\n### Cliente: Inova Digital LTDA\n\n**Plano:** Starter\n**Usuarios:** 15\n**Valor mensal:** R$ 708,33\n**Valor anual:** R$ 8.500,00 (desconto de 10% para pagamento antecipado)\n\n### Modulos inclusos:\n- ONEmonday (kanban + gestao de tarefas)\n- CRM basico (pipeline + contatos)\n\n### Condicoes:\n- Contrato minimo de 12 meses\n- Suporte via email em horario comercial\n- Treinamento inicial de 2h incluso\n\n**Validade:** 15 dias',
     8500.00, 'sent', now() - interval '3 days', now() + interval '12 days', v_pedro),

    -- Proposta aceita (TechNova upgrade)
    (v_deal7, v_sector_id,
     'Proposta de Upgrade - TechNova Solucoes - Plano Pro',
     E'## Proposta de Upgrade ONEmonday\n\n### Cliente: TechNova Solucoes\n\n**Plano atual:** Starter\n**Novo plano:** Pro\n**Usuarios:** 80\n**Valor mensal:** R$ 2.666,67\n**Valor anual:** R$ 32.000,00\n\n### Novos modulos:\n- Support Desk (tickets + SLA + base de conhecimento)\n- Analytics avancado\n- API de integracao\n\n### Condicoes:\n- Migracao sem custo adicional\n- Treinamento de 4h para equipe\n- Suporte prioritario via chat\n\n**Status:** Aceita em ' || to_char(CURRENT_DATE - interval '5 days', 'DD/MM/YYYY'),
     32000.00, 'accepted', now() - interval '15 days', now() - interval '1 day', v_admin);
END;
$$;


-- ############################################################
--                        HR MODULE
-- ############################################################

-- ============================================================
-- HR EMPLOYEES (12)
-- ============================================================

DO $$
DECLARE
  v_sector_id uuid := '3826e880-b077-4930-a676-7c5b96d10f63';
  v_admin     uuid := '765672fc-f1ae-408d-9758-68cd0b2269d6';
  v_rafaela   uuid := 'a1111111-1111-1111-1111-111111111111';
  v_pedro     uuid := 'a2222222-2222-2222-2222-222222222222';
  v_juliana   uuid := 'a3333333-3333-3333-3333-333333333333';
  v_marcos    uuid := 'a4444444-4444-4444-4444-444444444444';
  v_mgr_id   uuid;
BEGIN
  -- Manager first (referenced by others)
  INSERT INTO hr_employees (id, sector_id, user_id, full_name, email, phone, position, department, hire_date, birth_date, employment_type, status)
  VALUES ('e0000001-a400-0000-0000-000000000001', v_sector_id, v_admin,
    'Lucas Nobre', 'admin@onemonday.com', '(11) 99999-0001', 'CTO', 'Diretoria',
    '2024-01-15', '1990-03-22', 'full_time', 'active')
  ON CONFLICT (id) DO NOTHING;
  v_mgr_id := 'e0000001-a400-0000-0000-000000000001';

  INSERT INTO hr_employees (id, sector_id, user_id, full_name, email, phone, position, department, hire_date, birth_date, manager_id, employment_type, status) VALUES
    ('e0000002-a400-0000-0000-000000000002', v_sector_id, v_rafaela,
     'Rafaela Santos', 'rafaela.santos@onemonday.com', '(11) 99999-0002', 'Gerente de Produto', 'Produto',
     '2024-03-01', '1992-07-15', v_mgr_id, 'full_time', 'active'),

    ('e0000003-a400-0000-0000-000000000003', v_sector_id, v_pedro,
     'Pedro Oliveira', 'pedro.oliveira@onemonday.com', '(11) 99999-0003', 'Desenvolvedor Senior', 'Engenharia',
     '2024-06-10', '1991-11-08', v_mgr_id, 'full_time', 'active'),

    ('e0000004-a400-0000-0000-000000000004', v_sector_id, v_juliana,
     'Juliana Costa', 'juliana.costa@onemonday.com', '(11) 99999-0004', 'Desenvolvedora Plena', 'Engenharia',
     '2024-09-15', '1994-05-20', v_mgr_id, 'full_time', 'active'),

    ('e0000005-a400-0000-0000-000000000005', v_sector_id, v_marcos,
     'Marcos Silva', 'marcos.silva@onemonday.com', '(11) 99999-0005', 'Analista de Suporte Senior', 'Suporte',
     '2024-04-01', '1993-09-12', v_mgr_id, 'full_time', 'active'),

    ('e0000006-a400-0000-0000-000000000006', v_sector_id, NULL,
     'Ana Carolina Ribeiro', 'ana.ribeiro@onemonday.com', '(11) 99999-0006', 'Designer UX/UI', 'Produto',
     '2026-05-19', '1995-01-30', 'e0000002-a400-0000-0000-000000000002', 'full_time', 'active'),

    ('e0000007-a400-0000-0000-000000000007', v_sector_id, NULL,
     'Gabriel Martins', 'gabriel.martins@onemonday.com', '(11) 99999-0007', 'Desenvolvedor Junior', 'Engenharia',
     '2025-08-01', '1998-12-05', v_mgr_id, 'full_time', 'active'),

    ('e0000008-a400-0000-0000-000000000008', v_sector_id, NULL,
     'Camila Ferreira', 'camila.ferreira@onemonday.com', '(11) 99999-0008', 'Analista de RH', 'Recursos Humanos',
     '2025-02-10', '1993-04-18', v_mgr_id, 'full_time', 'active'),

    ('e0000009-a400-0000-0000-000000000009', v_sector_id, NULL,
     'Bruno Almeida', 'bruno.almeida@onemonday.com', '(11) 99999-0009', 'Executivo de Vendas', 'Comercial',
     '2025-05-20', '1991-08-25', 'e0000002-a400-0000-0000-000000000002', 'full_time', 'active'),

    ('e0000010-a400-0000-0000-000000000010', v_sector_id, NULL,
     'Larissa Souza', 'larissa.souza@onemonday.com', '(11) 99999-0010', 'Estagiaria de Desenvolvimento', 'Engenharia',
     '2026-02-01', '2002-06-14', v_mgr_id, 'intern', 'active'),

    ('e0000011-a400-0000-0000-000000000011', v_sector_id, NULL,
     'Diego Nascimento', 'diego.nascimento@onemonday.com', '(11) 99999-0011', 'DevOps Engineer', 'Infraestrutura',
     '2025-10-15', '1990-02-28', v_mgr_id, 'full_time', 'on_leave'),

    ('e0000012-a400-0000-0000-000000000012', v_sector_id, NULL,
     'Tatiana Borges', 'tatiana.borges@onemonday.com', '(11) 99999-0012', 'Analista de QA', 'Engenharia',
     '2025-07-01', '1996-10-03', v_mgr_id, 'contractor', 'active')
  ON CONFLICT (id) DO NOTHING;
END;
$$;

-- ============================================================
-- HR TIME-OFF POLICIES (3)
-- ============================================================

INSERT INTO hr_time_off_policies (id, sector_id, name, days_per_year, requires_approval, max_consecutive_days) VALUES
  ('f9000001-90d1-0000-0000-000000000001', '3826e880-b077-4930-a676-7c5b96d10f63',
   'Ferias', 30, true, 30),
  ('f9000002-90d1-0000-0000-000000000002', '3826e880-b077-4930-a676-7c5b96d10f63',
   'Licenca Medica', 15, true, 15),
  ('f9000003-90d1-0000-0000-000000000003', '3826e880-b077-4930-a676-7c5b96d10f63',
   'Pessoal', 5, true, 3)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- HR TIME-OFF REQUESTS (6)
-- ============================================================

INSERT INTO hr_time_off_requests (sector_id, employee_id, policy_id, start_date, end_date, days_count, reason, status, approved_by, approved_at) VALUES
  -- Pedro: ferias aprovadas (futuro)
  ('3826e880-b077-4930-a676-7c5b96d10f63',
   'e0000003-a400-0000-0000-000000000003', 'f9000001-90d1-0000-0000-000000000001',
   CURRENT_DATE + interval '30 days', CURRENT_DATE + interval '44 days', 15,
   'Ferias de meio de ano - viagem com familia', 'approved',
   '765672fc-f1ae-408d-9758-68cd0b2269d6', now() - interval '5 days'),

  -- Juliana: dia pessoal aprovado (proximo)
  ('3826e880-b077-4930-a676-7c5b96d10f63',
   'e0000004-a400-0000-0000-000000000004', 'f9000003-90d1-0000-0000-000000000003',
   CURRENT_DATE + interval '3 days', CURRENT_DATE + interval '3 days', 1,
   'Consulta medica agendada', 'approved',
   '765672fc-f1ae-408d-9758-68cd0b2269d6', now() - interval '2 days'),

  -- Diego: licenca medica em andamento (explica status on_leave)
  ('3826e880-b077-4930-a676-7c5b96d10f63',
   'e0000011-a400-0000-0000-000000000011', 'f9000002-90d1-0000-0000-000000000002',
   CURRENT_DATE - interval '5 days', CURRENT_DATE + interval '10 days', 15,
   'Cirurgia e recuperacao', 'approved',
   '765672fc-f1ae-408d-9758-68cd0b2269d6', now() - interval '7 days'),

  -- Gabriel: ferias pendentes
  ('3826e880-b077-4930-a676-7c5b96d10f63',
   'e0000007-a400-0000-0000-000000000007', 'f9000001-90d1-0000-0000-000000000001',
   CURRENT_DATE + interval '60 days', CURRENT_DATE + interval '74 days', 15,
   'Ferias de julho', 'pending', NULL, NULL),

  -- Camila: pessoal pendente
  ('3826e880-b077-4930-a676-7c5b96d10f63',
   'e0000008-a400-0000-0000-000000000008', 'f9000003-90d1-0000-0000-000000000003',
   CURRENT_DATE + interval '7 days', CURRENT_DATE + interval '8 days', 2,
   'Mudanca de apartamento', 'pending', NULL, NULL),

  -- Bruno: ferias rejeitadas (conflito)
  ('3826e880-b077-4930-a676-7c5b96d10f63',
   'e0000009-a400-0000-0000-000000000009', 'f9000001-90d1-0000-0000-000000000001',
   CURRENT_DATE + interval '14 days', CURRENT_DATE + interval '28 days', 15,
   'Ferias de meio de ano', 'rejected',
   '765672fc-f1ae-408d-9758-68cd0b2269d6', now() - interval '3 days')
ON CONFLICT DO NOTHING;

-- Update rejection reason separately (clean approach)
UPDATE hr_time_off_requests
SET rejection_reason = 'Periodo conflita com fechamento trimestral do comercial. Favor reagendar para apos 15/07.'
WHERE employee_id = 'e0000009-a400-0000-0000-000000000009'
  AND status = 'rejected'
  AND rejection_reason IS NULL;

-- ============================================================
-- HR TIME-OFF BALANCES (3 employees, current year)
-- ============================================================

INSERT INTO hr_time_off_balances (employee_id, policy_id, year, total_days, used_days, pending_days) VALUES
  -- Pedro: ferias
  ('e0000003-a400-0000-0000-000000000003', 'f9000001-90d1-0000-0000-000000000001',
   EXTRACT(YEAR FROM CURRENT_DATE)::int, 30, 0, 15),
  -- Juliana: pessoal
  ('e0000004-a400-0000-0000-000000000004', 'f9000003-90d1-0000-0000-000000000003',
   EXTRACT(YEAR FROM CURRENT_DATE)::int, 5, 2, 1),
  -- Diego: licenca medica
  ('e0000011-a400-0000-0000-000000000011', 'f9000002-90d1-0000-0000-000000000002',
   EXTRACT(YEAR FROM CURRENT_DATE)::int, 15, 15, 0)
ON CONFLICT (employee_id, policy_id, year) DO NOTHING;

-- ============================================================
-- HR JOB OPENINGS (2) - hiring_manager_id is NOT NULL
-- ============================================================

INSERT INTO hr_job_openings (id, sector_id, title, department, description, requirements, employment_type, location, salary_range, status, hiring_manager_id) VALUES
  ('da000001-09e0-0000-0000-000000000001', '3826e880-b077-4930-a676-7c5b96d10f63',
   'Desenvolvedor(a) Backend Senior',
   'Engenharia',
   'Buscamos um(a) desenvolvedor(a) backend senior para liderar a arquitetura de microservicos da plataforma ONEmonday. Atuara no design de APIs, otimizacao de banco de dados e mentoria de devs juniores.',
   E'- 5+ anos de experiencia com Node.js/TypeScript\n- Experiencia com PostgreSQL e modelagem relacional\n- Conhecimento em Docker, CI/CD e cloud (AWS ou GCP)\n- Desejavel: experiencia com Supabase ou Firebase\n- Boa comunicacao e experiencia em code review',
   'full_time', 'Remoto (Brasil)', 'R$ 14.000 - R$ 20.000',
   'open', '765672fc-f1ae-408d-9758-68cd0b2269d6'),

  ('da000002-09e0-0000-0000-000000000002', '3826e880-b077-4930-a676-7c5b96d10f63',
   'Analista de Suporte Tecnico Pleno',
   'Suporte',
   'Vaga para analista de suporte tecnico que atuara na triagem e resolucao de tickets, atendimento ao cliente e manutencao da base de conhecimento.',
   E'- 2+ anos de experiencia em suporte tecnico de software SaaS\n- Conhecimento basico em SQL e APIs REST\n- Experiencia com ferramentas de ticketing\n- Portugues fluente, ingles intermediario\n- Perfil analitico e boa escrita',
   'full_time', 'Hibrido (Sao Paulo/SP)', 'R$ 5.000 - R$ 7.500',
   'filled', 'a1111111-1111-1111-1111-111111111111')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- HR RECRUITMENT BOARD + CANDIDATE CARDS (3)
-- ============================================================

-- Use the existing RH Recrutamento board for candidate cards
-- Board: b0000004-0000-0000-0000-000000000001 (Recrutamento, RH sector)
-- But candidates need to be in the Dev sector board, so we create a recruitment board for Dev

INSERT INTO boards (id, name, description, visibility, is_default, board_type, module_id, created_by)
VALUES (
  'b3000000-a444-0000-0000-000000000001',
  'Recrutamento Engenharia',
  'Pipeline de recrutamento para vagas de engenharia',
  'sector',
  false,
  'hr_recruitment',
  (SELECT id FROM modules WHERE slug = 'hr'),
  '765672fc-f1ae-408d-9758-68cd0b2269d6'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO board_sectors (board_id, sector_id)
VALUES ('b3000000-a444-0000-0000-000000000001', '3826e880-b077-4930-a676-7c5b96d10f63')
ON CONFLICT (board_id, sector_id) DO NOTHING;

INSERT INTO board_columns (id, board_id, name, color, position, is_done_column) VALUES
  ('c3a40001-c0d0-0000-0000-000000000001', 'b3000000-a444-0000-0000-000000000001', 'Triagem',      '#94a3b8', 1, false),
  ('c3a40001-c0d0-0000-0000-000000000002', 'b3000000-a444-0000-0000-000000000001', 'Entrevista',    '#3b82f6', 2, false),
  ('c3a40001-c0d0-0000-0000-000000000003', 'b3000000-a444-0000-0000-000000000001', 'Teste Tecnico', '#f59e0b', 3, false),
  ('c3a40001-c0d0-0000-0000-000000000004', 'b3000000-a444-0000-0000-000000000001', 'Finalista',     '#8b5cf6', 4, false),
  ('c3a40001-c0d0-0000-0000-000000000005', 'b3000000-a444-0000-0000-000000000001', 'Contratado',    '#22c55e', 5, true)
ON CONFLICT (id) DO NOTHING;

-- Link job openings to the board
UPDATE hr_job_openings SET board_id = 'b3000000-a444-0000-0000-000000000001'
WHERE id IN ('da000001-09e0-0000-0000-000000000001', 'da000002-09e0-0000-0000-000000000002')
  AND board_id IS NULL;

-- Candidate cards
DO $$
DECLARE
  v_board_id  uuid := 'b3000000-a444-0000-0000-000000000001';
  v_sector_id uuid := '3826e880-b077-4930-a676-7c5b96d10f63';
  v_admin     uuid := '765672fc-f1ae-408d-9758-68cd0b2269d6';

  v_col_triagem     uuid := 'c3a40001-c0d0-0000-0000-000000000001';
  v_col_entrevista  uuid := 'c3a40001-c0d0-0000-0000-000000000002';
  v_col_teste       uuid := 'c3a40001-c0d0-0000-0000-000000000003';

  v_card_id uuid;
BEGIN
  -- Candidate 1: Triagem (Backend Senior)
  v_card_id := 'cd300000-ca0d-0000-0000-000000000001'::uuid;
  INSERT INTO cards (id, board_id, column_id, sector_id, title, description, position, priority, created_by, created_at)
  VALUES (v_card_id, v_board_id, v_col_triagem, v_sector_id,
    'Candidato: Felipe Rodrigues - Backend Senior',
    '8 anos de experiencia com Node.js e Go. Atualmente na VTEX. Curriculo muito forte.',
    1, 'high', v_admin, now() - interval '3 days')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO hr_candidates (card_id, job_opening_id, sector_id, full_name, email, phone, linkedin_url, source, current_company, current_position, expected_salary, rating, notes)
  VALUES (v_card_id, 'da000001-09e0-0000-0000-000000000001', v_sector_id,
    'Felipe Rodrigues', 'felipe.rodrigues@email.com', '(11) 98765-4321',
    'linkedin.com/in/feliperodrigues', 'LinkedIn',
    'VTEX', 'Senior Software Engineer', 18000.00, 4,
    'Perfil alinhado com a vaga. Experiencia solida com microservicos e PostgreSQL.')
  ON CONFLICT (card_id) DO NOTHING;

  -- Candidate 2: Entrevista (Backend Senior)
  v_card_id := 'cd300000-ca0d-0000-0000-000000000002'::uuid;
  INSERT INTO cards (id, board_id, column_id, sector_id, title, description, position, priority, created_by, created_at)
  VALUES (v_card_id, v_board_id, v_col_entrevista, v_sector_id,
    'Candidata: Marina Carvalho - Backend Senior',
    '6 anos de experiencia, foco em TypeScript e AWS. Entrevista tecnica agendada para quinta.',
    1, 'high', v_admin, now() - interval '7 days')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO hr_candidates (card_id, job_opening_id, sector_id, full_name, email, phone, linkedin_url, source, current_company, current_position, expected_salary, rating, notes)
  VALUES (v_card_id, 'da000001-09e0-0000-0000-000000000001', v_sector_id,
    'Marina Carvalho', 'marina.carvalho@email.com', '(21) 97654-3210',
    'linkedin.com/in/marinacarvalho', 'Indicacao interna',
    'Nubank', 'Software Engineer II', 16000.00, 5,
    'Excelente comunicacao na entrevista inicial. Conhece Supabase e tem experiencia com RLS.')
  ON CONFLICT (card_id) DO NOTHING;

  -- Candidate 3: Teste Tecnico (Backend Senior)
  v_card_id := 'cd300000-ca0d-0000-0000-000000000003'::uuid;
  INSERT INTO cards (id, board_id, column_id, sector_id, title, description, position, priority, created_by, created_at)
  VALUES (v_card_id, v_board_id, v_col_teste, v_sector_id,
    'Candidato: Andre Takahashi - Backend Senior',
    '7 anos de experiencia. Teste tecnico entregue, aguardando avaliacao do time.',
    1, 'medium', v_admin, now() - interval '10 days')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO hr_candidates (card_id, job_opening_id, sector_id, full_name, email, phone, linkedin_url, source, current_company, current_position, expected_salary, rating, notes)
  VALUES (v_card_id, 'da000001-09e0-0000-0000-000000000001', v_sector_id,
    'Andre Takahashi', 'andre.takahashi@email.com', '(41) 96543-2109',
    'linkedin.com/in/andretakahashi', 'Gupy',
    'PagSeguro', 'Tech Lead', 20000.00, 3,
    'Bom perfil tecnico mas pretensao salarial acima da faixa. Teste tecnico precisa ser avaliado.')
  ON CONFLICT (card_id) DO NOTHING;
END;
$$;

-- ============================================================
-- HR ONBOARDING TEMPLATE (1 with 5 items stored in items jsonb)
-- ============================================================

INSERT INTO hr_onboarding_templates (id, sector_id, position, name, description, items) VALUES
  ('0f000001-fe9d-0000-0000-000000000001', '3826e880-b077-4930-a676-7c5b96d10f63',
   'Desenvolvedor', 'Onboarding Padrao - Engenharia',
   'Template completo de onboarding para novos desenvolvedores, cobrindo acessos, treinamentos e integracao.',
   '[
     {"title": "Criar contas (email, Slack, GitHub, ONEmonday)", "description": "Provisionar todas as contas corporativas necessarias", "due_days": 1},
     {"title": "Configurar ambiente de desenvolvimento", "description": "Setup do ambiente local: Node.js, Docker, VS Code, extensoes, clone do repositorio", "due_days": 2},
     {"title": "Treinamento de seguranca e compliance", "description": "Completar modulo de seguranca da informacao e assinar termo de confidencialidade", "due_days": 3},
     {"title": "Reuniao com lider tecnico e pair programming", "description": "Sessao de 2h com o tech lead para entender arquitetura e fluxos principais", "due_days": 5},
     {"title": "Primeiro PR: task de warmup", "description": "Completar uma task simples do backlog para familiarizacao com o fluxo de desenvolvimento", "due_days": 10}
   ]')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- HR ONBOARDING INSTANCE (1 for Ana Carolina, the new designer)
-- ============================================================

INSERT INTO hr_onboarding_instances (id, employee_id, template_id, sector_id, start_date, status)
VALUES (
  '01000001-105f-0000-0000-000000000001',
  'e0000006-a400-0000-0000-000000000006',
  '0f000001-fe9d-0000-0000-000000000001',
  '3826e880-b077-4930-a676-7c5b96d10f63',
  CURRENT_DATE - interval '5 days',
  'in_progress'
)
ON CONFLICT (id) DO NOTHING;

-- Onboarding items (from template, some completed)
INSERT INTO hr_onboarding_items (onboarding_id, title, description, due_date, is_completed, completed_at, completed_by, assigned_to, position) VALUES
  ('01000001-105f-0000-0000-000000000001',
   'Criar contas (email, Slack, GitHub, ONEmonday)',
   'Provisionar todas as contas corporativas necessarias',
   CURRENT_DATE - interval '4 days', true, now() - interval '4 days 18 hours',
   '765672fc-f1ae-408d-9758-68cd0b2269d6', '765672fc-f1ae-408d-9758-68cd0b2269d6', 1),

  ('01000001-105f-0000-0000-000000000001',
   'Configurar ambiente de desenvolvimento',
   'Setup do ambiente local: Figma Pro, Adobe CC, design system, clone do repositorio de assets',
   CURRENT_DATE - interval '3 days', true, now() - interval '3 days 10 hours',
   'a2222222-2222-2222-2222-222222222222', 'a2222222-2222-2222-2222-222222222222', 2),

  ('01000001-105f-0000-0000-000000000001',
   'Treinamento de seguranca e compliance',
   'Completar modulo de seguranca da informacao e assinar termo de confidencialidade',
   CURRENT_DATE - interval '2 days', true, now() - interval '2 days 14 hours',
   NULL, 'a1111111-1111-1111-1111-111111111111', 3),

  ('01000001-105f-0000-0000-000000000001',
   'Reuniao com lider tecnico e pair design',
   'Sessao de 2h com a gerente de produto para entender design system e fluxos de UX',
   CURRENT_DATE, false, NULL,
   NULL, 'a1111111-1111-1111-1111-111111111111', 4),

  ('01000001-105f-0000-0000-000000000001',
   'Primeiro entregavel: redesign de componente',
   'Redesenhar um componente existente do design system para familiarizacao com padroes visuais',
   CURRENT_DATE + interval '5 days', false, NULL,
   NULL, 'a1111111-1111-1111-1111-111111111111', 5)
ON CONFLICT DO NOTHING;


-- ============================================================
-- DONE!
-- Run: psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f supabase/sample_data_modules.sql
-- ============================================================
