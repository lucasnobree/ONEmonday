# ONEmonday — Trabalho Pendente

Documento vivo. Consolida tudo o que **não** está feito, na data de **2026-05-18**,
após a profissionalização, a migração total, os backlogs de módulo e as Waves
4 e 5 de UX. Serve de fila de trabalho para as próximas iterações.

## Estado atual (concluído)

`master` sincronizada no GitHub, CI verde. Suíte: **1146 testes** unitários
(107 arquivos), lint 0, typecheck 0, build OK. Migrations até `00207`.

Concluído: fundação (testes/CI/versionamento) · 3 waves de profissionalização ·
migração total em 6 fases (camada de integração, CRM, RH, financeiro interno,
marketing, comunicação) · backlogs adiados dos 9 módulos · UX Audit Wave 4
(quick wins) · UX Wave 5 (itens High-impact) · 3 revisões sênior com correções
(`00100`, `00180`, `00207`).

---

## 1. Pendências operacionais (go-live — não é código)

Detalhadas em [`migration-go-live-runbook.md`](./migration-go-live-runbook.md).
Nenhuma é tarefa de programação; são provisionamento e validação.

- [ ] Variáveis de produção: `INTEGRATION_ENCRYPTION_KEY`,
      `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, URL/anon-key do Supabase de
      produção.
- [ ] Contas dos provedores: Microsoft Teams (webhook), WhatsApp Cloud API,
      Resend (+ domínio verificado SPF/DKIM/DMARC), Focus NFe (+ certificado
      A1 e-CNPJ, ~R$220-275/ano), Pluggy, Asaas.
- [ ] Configurar credenciais em **Configurações → Integrações** (admin).
- [ ] Configurar a URL base dos jobs `pg_cron` e confirmar `cron.job`.
- [ ] Dual-run por fornecedor antes de cancelar (Pipedrive/RD CRM, Sólides,
      Omie, RD Marketing) — ver §7 do runbook.
- [ ] Verificar a cobertura de município(s) NFS-e na Focus NFe.

---

## 2. Pendências de produto por módulo

Itens deliberadamente adiados nas Waves 4/5 (esforço maior que um quick win ou
que uma fatia focada). Prioridade sugerida: **Alta / Média / Baixa**.

### Core
- [ ] **Média** — Aba Board/Timeline na página de detalhe do projeto sobre os
      cards vinculados; marcos (milestones).
- [ ] **Baixa** — Reordenar colunas do Kanban por drag-and-drop (hoje há mover
      por teclado, acessível e testado).
- [ ] **Baixa** — "Launchpad" no dashboard; export CSV por relatório do
      Analytics; enriquecer metadados nos cartões de board.

### CRM
- [ ] **Alta** — Roteamento de leads: atribuição automática / round-robin
      (hoje só atribuição manual de responsável).
- [ ] **Média** — UI de configuração do SLA de lead por setor
      (`sectors.crm_lead_sla_hours`; hoje default 24h, sem tela).
- [ ] **Média** — Lógica condicional nos formulários de captura.
- [ ] **Média** — Status de entrega por mensagem (bolha) no painel de
      Comunicação; analytics de uso de templates.
- [ ] **Baixa** — Triagem em massa de leads na inbox; detalhe de lead ainda
      lista o `payload` por chave crua (cosmético).
- [ ] **Baixa** — Loading por widget no dashboard do CRM (hoje a tela toda
      entra em skeleton).

### HR
- [ ] **Alta** — Performance: avaliação por pares / 360, calibração,
      competências/perguntas por ciclo (hoje há autoavaliação + top-down).
- [ ] **Média** — Surveys: segmentação de audiência por departamento,
      recorrência; split eNPS (promotor/neutro/detrator) + gráfico de
      distribuição.
- [ ] **Média** — Recrutamento: placar (scorecard) agregado, upload de
      currículo, captura via página pública de vagas; vincular o candidato
      contratado quando a vaga é preenchida.
- [ ] **Baixa** — DnD do pipeline de recrutamento: impor progressão só para
      frente (helper `isForwardMove` existe, não aplicado).
- [ ] **Baixa** — Calendário de ausências da equipe; tabelas ordenáveis;
      foto/autoatendimento de perfil; entrevista de desligamento estruturada.

### Support Desk
- [ ] **Alta** — Runner de varredura de violação de SLA: a lógica de decisão
      (`lib/support/breach.ts`) está pronta e testada, mas falta o job
      agendado que varre tickets, grava `support_notifications` e marca
      `sla_breach_actioned_at`.
- [ ] **Alta** — Threading de e-mail de entrada: a resposta pública sai pelo
      Resend, mas a resposta do cliente não é reingerida no ticket (faltam
      rota de webhook como a `crm-email-inbound`).
- [ ] **Média** — `business-hours.ts` interpreta o horário no relógio local
      do servidor; `business_timezone` é armazenado mas não convertido
      (correto só em ambiente UTC).
- [ ] **Média** — Filtros sincronizados na URL / visões salvas; vincular
      artigo da KB a um ticket; seletor `/` de respostas prontas no compositor.

### Finance
- [ ] **Média** — Pré-preenchimento de recibo por OCR; política de
      "recibo obrigatório" aplicada na aprovação.
- [ ] **Média** — Busca/paginação nas listas de faturas e despesas; faixa de
      resumo na conciliação; export do DRE.
- [ ] **Baixa** — Reflow do grid de 5 KPIs no dashboard; resolver `approved_by`
      para o nome no detail sheet de despesa.

### Legal
- [ ] **Alta** — Workflow de aprovação multi-estágio de contrato (hoje há um
      passo leve submeter→aprovar/rejeitar); o histórico de status existe mas
      ainda não alimenta o dashboard.
- [ ] **Média** — Visualizador de PDF in-app (hoje o documento abre em nova
      aba); extração de metadados por IA; rastreamento de obrigações;
      versionamento de cláusulas.
- [ ] **Baixa** — Assinatura eletrônica (e-signature) — frontier CLM, integra
      provedor externo.

### Marketing / Dev-Tools / Settings
- [ ] **Média** — Página de detalhe/analytics de campanha de e-mail; busca/
      filtro nas listas de campanha.
- [ ] **Média** — Matriz de roteamento unificada em Integrações; dedup de
      rotas; carregamento gated por permissão.
- [ ] **Baixa** — Feed de atividade recente no Dev-Tools.

### Escopo regulado — fora de escopo permanente
Folha de pagamento (eSocial), ponto eletrônico (Portaria 671), cartão de
benefícios (fintech Bacen), SPED/livros fiscais oficiais. Permanecem com
Folha Flash / Tangerino / cartão Flash / contador — ver §9 do runbook.

---

## 3. Pendências técnicas (nice-to-have das revisões sênior)

Da revisão da Wave 5 — itens N1-N5, nenhum bloqueante:

- [ ] **N1** — `lib/actions/support/messages.ts` tem um `textToHtml` local que
      escapa só `& < > \n` (não `"`/`'`); consolidar no `escapeHtml`
      compartilhado de `lib/marketing/email-body.ts`. Não explorável hoje
      (o corpo vai num `<div>` sem atributos).
- [ ] **N2** — `sendEmailCampaign` envia destinatários num loop sequencial
      (um `await` por destinatário); adicionar batching/rate-limit quando os
      segmentos crescerem.
- [x] **N4** — Verificado: a policy `analytics_reports_insert` mantém
      `created_by = auth.uid()` no WITH CHECK, então afrouxar o `NOT NULL`
      (migration 00183) não permite o cliente inserir linha com autor nulo.
- [ ] **N5** — Índices de FK ausentes (sem query quente hoje, adicionar se
      surgir uma visão "atividade por usuário"): `ticket_messages.author_id`,
      `legal_status_history.changed_by`, `legal_matter_comments.author_id`.

### Bug latente pré-existente já corrigido
A migration `00207` corrigiu as policies de escrita de `support_tickets` que
referenciavam um recurso de permissão `support_ticket` nunca semeado (o certo
é `ticket`) — antes disso, criar/editar ticket caía só para admin global.

---

## 4. Higiene de repositório

- [ ] **Baixa** — Podar as branches `feat/*` já mescladas (waves 1-5,
      migração, backlogs — ~45 branches) e os worktrees de agente obsoletos
      em `.claude/worktrees/`.
- [ ] **Baixa** — Considerar cortar a release **v0.2.0**: a seção
      `[Unreleased]` do CHANGELOG acumulou toda a profissionalização +
      migração + waves; fechar como versão e taggear dá um marco limpo.
- [ ] **Baixa** — O script de captura de prints escreve em
      `apps/screenshots/` por um `../../` a menos; a Wave 4 já corrigiu o
      script novo (`-wave4`) para `../../../`. Sem ação se não houver Wave 6.

---

## 5. Reformulação de navegação estilo Monday — follow-ups

As Fases 1, 2, 2b e 3 estão entregues (sidebar Setor▸Módulo, landing por
perfil, Meu Trabalho, dashboard global, filtro de setor, polimento do board).
O que ficou pendente dela:

- [x] **Alta** — Filtro de setor "Todos": os dashboards de módulo movidos a
      RPC single-sector (Financeiro, Marketing, Analytics, Jurídico,
      Dev-Tools, métricas do Support, documentos/headcount de RH, lead
      stats/aging do CRM) mostravam KPIs **vazios** quando o admin escolhia
      "Todos". Resolvido: migrations `00209`-`00216` recriam cada RPC com
      `p_sector_id` anulável (`NULL` = todos os setores, exigindo
      `is_global_admin()`); os hooks passam `null` sob o escopo all-sectors
      e renderizam o agregado real.
- [ ] **Média** — Fase 2b: telas secundárias ainda não ligadas ao filtro de
      setor (leem `useCurrentSector` direto): CRM pipeline/atividades/
      propostas/formulários; RH onboarding/offboarding/férias/desempenho/
      recrutamento/pesquisas/organograma; Support KB/SLA/respostas;
      Financeiro orçamentos/relatórios/conciliação; Jurídico cláusulas;
      Marketing audiências/automações/calendário/e-mail.
- [ ] **Baixa** — `InvoicePrintButton` usa o setor da sidebar em vez do setor
      da própria fatura.
- [ ] **Baixa** — Dev-Tools ainda usa abas por estado (`<Tabs>`) em vez de
      sub-páginas roteadas no submenu lateral.
- [ ] **Baixa** — Fase 3: ordenação por grupo na lista; faixa de imagem de
      capa no card; reações/respostas aninhadas nos Updates e pills inline no
      Activity Log do Item Card.

---

## 6. Próxima auditoria

Quando os itens de produto da §2 avançarem, vale uma **UX Audit Wave 6** das
telas novas/alteradas (organograma, performance, surveys, conciliação,
detail sheets, automações, e a navegação nova) — mesmo método das Waves 3-4
(agentes ux-auditor + prints + relatórios `docs/research/ux-audit-*-waveN.md`).
