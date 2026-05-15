# Mapeamento de Modulos por Setor -- ONEmonday

## Estado Atual

5 modulos na sidebar como "coming soon": Analytics, CRM, Support Desk, Dev Tools, RH Portal.
Faltam: Financeiro, Marketing, Juridico (sem rotas criadas).

Arquitetura modular via tabelas `modules` e `sector_modules` permite ativar/desativar modulos por setor.

---

## 1. Support Desk -- Prioridade ALTA

**Rota:** `/support` (coming soon)
**Referencia:** Zendesk, Freshdesk, Movidesk, Octadesk

| Funcionalidade | Descricao |
|---|---|
| Tickets | Abertura, categorizacao, atribuicao, prioridade, status |
| SLA | Regras de tempo de resposta/resolucao por prioridade |
| Base de Conhecimento | Artigos de ajuda organizados por categoria |
| Respostas Prontas | Templates de resposta |
| CSAT | Pesquisa de satisfacao apos resolucao |
| Escalacao | Enviar ticket para outro setor (suporte > dev) |

**Reutilizacao do kanban:** Muito alta (tickets = cards, filas = colunas)
**Novas tabelas:** ~4 (sla_rules, kb_articles, canned_responses, csat_ratings)

**Telas:**
1. `/support` -- Dashboard
2. `/support/tickets` -- Lista com filtros
3. `/support/tickets/[id]` -- Detalhe com thread
4. `/support/tickets/new` -- Abertura
5. `/support/knowledge-base` -- Artigos
6. `/support/knowledge-base/[id]` -- Artigo
7. `/support/sla` -- Configuracao SLA
8. `/support/canned-responses` -- Respostas prontas
9. `/support/reports` -- Metricas

---

## 2. CRM -- Prioridade ALTA

**Rota:** `/crm` (coming soon)
**Referencia:** Salesforce, HubSpot, Pipedrive, RD Station CRM, Ploomes

| Funcionalidade | Descricao |
|---|---|
| Pipeline de Vendas | Kanban (Prospeccao > Qualificacao > Proposta > Negociacao > Fechamento) |
| Leads/Contatos | Cadastro com empresa, telefone, email, origem, score |
| Empresas/Contas | Cadastro com contatos vinculados |
| Propostas | Criacao e envio de propostas comerciais |
| Atividades | Registro de ligacoes, emails, reunioes |
| Funil e Metricas | Valor no pipeline, conversao, tempo medio |

**Reutilizacao do kanban:** Muito alta (deals = cards, etapas = colunas)
**Novas tabelas:** ~5 (contacts, companies, deals, activities, proposals)

**Telas:**
1. `/crm` -- Dashboard
2. `/crm/pipeline` -- Kanban de deals
3. `/crm/deals/[id]` -- Detalhe do deal
4. `/crm/contacts` -- Lista de contatos
5. `/crm/contacts/[id]` -- Ficha do contato
6. `/crm/companies` -- Lista de empresas
7. `/crm/companies/[id]` -- Ficha da empresa
8. `/crm/proposals` -- Lista de propostas
9. `/crm/reports` -- Funil, forecast, metricas

---

## 3. RH -- Prioridade ALTA

**Rota:** `/hr` (coming soon)
**Referencia:** BambooHR, Gupy, Convenia, Solides, Factorial

| Funcionalidade | Descricao |
|---|---|
| Ficha de Colaborador | Dados pessoais, cargo, setor, historico |
| Ferias e Ausencias | Solicitacao, aprovacao, calendario, saldo |
| Recrutamento (ATS) | Pipeline kanban de candidatos |
| Avaliacoes | Desempenho, 360, OKRs |
| Onboarding | Checklist de integracao |
| Organograma | Visualizacao hierarquica |

**Reutilizacao do kanban:** Alta (recrutamento = kanban, solicitacoes = cards)
**Novas tabelas:** ~7 (employees, time_off, job_openings, candidates, evaluations, onboarding_checklists)

**Telas:**
1. `/hr` -- Dashboard
2. `/hr/employees` -- Lista de colaboradores
3. `/hr/employees/[id]` -- Ficha completa
4. `/hr/time-off` -- Calendario de ferias/ausencias
5. `/hr/time-off/request` -- Solicitacao
6. `/hr/recruitment` -- Pipeline kanban
7. `/hr/recruitment/[jobId]` -- Detalhes da vaga
8. `/hr/evaluations` -- Ciclos de avaliacao
9. `/hr/onboarding` -- Checklists

---

## 4. Dev Tools -- Prioridade MEDIA

**Rota:** `/dev-tools` (coming soon)
**Referencia:** Jira, Linear, GitHub Projects, Sentry, PagerDuty

| Funcionalidade | Descricao |
|---|---|
| Sprint Board | Kanban com sprint cycles |
| Bug Tracker | Cards com severidade, steps to reproduce |
| Releases | Agrupamento por versao |
| Integracao Git | Webhook para linkar commits/PRs a cards |
| Metricas | Velocity, burndown, cycle time |
| Incidentes | Registro com severidade e postmortem |

**Reutilizacao do kanban:** Alta (sprints = boards)
**Novas tabelas:** ~4 (sprints, incidents, releases, card_story_points)

**Telas:**
1. `/dev-tools` -- Dashboard com metricas de sprint
2. `/dev-tools/sprints` -- Lista de sprints
3. `/dev-tools/sprints/[id]` -- Sprint board
4. `/dev-tools/bugs` -- Lista de bugs
5. `/dev-tools/releases` -- Historico de releases
6. `/dev-tools/incidents` -- Registro de incidentes

---

## 5. Analytics -- Prioridade MEDIA

**Rota:** `/analytics` (coming soon)
**Referencia:** Power BI, Metabase, Looker, Grafana

| Funcionalidade | Descricao |
|---|---|
| Dashboards Customizaveis | Drag-and-drop de widgets |
| KPIs por Setor | Metricas especificas de cada modulo |
| Relatorios | Geracao com filtros de periodo, setor |
| Exportacao | PDF, CSV, Excel |
| Comparativos | Periodo vs periodo, meta vs realizado |
| Alertas | Notificacao quando KPI cruza threshold |

**Reutilizacao do kanban:** Consome dados existentes
**Novas tabelas:** ~3 (dashboards, widgets, saved_reports)

**Telas:**
1. `/analytics` -- Hub de dashboards
2. `/analytics/dashboards/[id]` -- Dashboard customizavel
3. `/analytics/dashboards/new` -- Criacao
4. `/analytics/reports` -- Biblioteca
5. `/analytics/reports/[id]` -- Visualizacao
6. `/analytics/exports` -- Historico
7. `/analytics/kpis` -- Configuracao de KPIs

---

## 6. Financeiro -- Prioridade MEDIA-BAIXA

**Rota:** `/finance` (a criar)
**Referencia:** ContaAzul, Omie, Bling, Granatum

| Funcionalidade | Descricao |
|---|---|
| Contas a Pagar | Despesas, fornecedores, vencimentos |
| Contas a Receber | Faturas, clientes, recebimentos |
| Fluxo de Caixa | Entradas/saidas projetadas e realizadas |
| Categorias | Plano de contas (DRE simplificado) |
| Conciliacao Bancaria | Importacao de extrato |
| Notas Fiscais | Emissao/consulta NF-e |

**Novas tabelas:** ~5
**Telas:** 8

---

## 7. Marketing -- Prioridade BAIXA

**Rota:** `/marketing` (a criar)
**Referencia:** HubSpot, RD Station, mLabs, Mailchimp

| Funcionalidade | Descricao |
|---|---|
| Campanhas | Planejamento e acompanhamento |
| Calendario Editorial | Visao mensal de publicacoes |
| Social Media | Agendamento de posts |
| Email Marketing | Emails, listas, envios |
| Metricas | ROI, alcance, conversoes |

**Novas tabelas:** ~4
**Telas:** 7

---

## 8. Juridico -- Prioridade BAIXA

**Rota:** `/legal` (a criar)
**Referencia:** Clio, Projuris, Ironclad, DocuSign

| Funcionalidade | Descricao |
|---|---|
| Contratos | Cadastro, vigencia, alertas |
| Processos Judiciais | Acompanhamento com etapas |
| Documentos | Repositorio com versionamento |
| Compliance | Checklists regulatorios |
| Aprovacoes | Workflow de aprovacao |

**Novas tabelas:** ~5
**Telas:** 8

---

## Ordem de Implementacao Sugerida

| # | Modulo | Prioridade | Reutilizacao Kanban | Novas Tabelas | Telas |
|---|--------|-----------|-------------------|--------------|-------|
| 1 | Support Desk | Alta | Muito alta | ~4 | 9 |
| 2 | CRM | Alta | Muito alta | ~5 | 9 |
| 3 | RH | Alta | Alta | ~7 | 9 |
| 4 | Analytics | Media | Consome dados | ~3 | 7 |
| 5 | Dev Tools | Media | Alta | ~4 | 6 |
| 6 | Financeiro | Media-Baixa | Media | ~5 | 8 |
| 7 | Marketing | Baixa | Alta | ~4 | 7 |
| 8 | Juridico | Baixa | Media-Alta | ~5 | 8 |

**Total:** 8 modulos, ~37 novas tabelas, ~63 telas
