# Analise Competitiva: monday.com vs ONEmonday

## PARTE 1 -- Pontos Fracos do monday.com

### 1.1 Precificacao Predatoria

- Minimo obrigatorio de 3 seats nos planos pagos
- Blocos de cobranca pre-definidos (3, 5, 10, 15, 20...). Time de 7 paga por 10
- Precos no Brasil: R$41/user/mes (Basico), R$53 (Padrao), R$89 (Pro) -- cobranca anual
- 100 usuarios no plano Padrao = R$63.600/ano
- Funcionalidades essenciais (time tracking, portfolios, permissoes granulares) so nos planos Pro/Enterprise
- Banner diario de aviso ao cancelar plano

**Oportunidade ONEmonday:** Custo zero de licenciamento por usuario (apenas infraestrutura).

### 1.2 Permissoes Insuficientes (Ponto Critico)

- Permissoes a nivel de item (card/tarefa) so no plano Enterprise
- No plano Pro nao e possivel restringir acesso a itens especificos dentro de um board
- API nao tem endpoints de gerenciamento de permissoes
- Sem automacao de permissoes via Zapier/Make
- Modelo: Account Role > Workspace Role > Board Permissions. Sem conceito de "setor"

**Oportunidade ONEmonday:** RBAC por setor ja e o pilar central (RLS + API guards + UI gates).

### 1.3 Performance e Escalabilidade

- Boards com 500+ itens: 10-15s para carregar
- Filtros levam 3-5s
- Times com 60-70 colunas: >25s por item
- Renderizacao client-side degrada com volume

**Oportunidade ONEmonday:** Paginacao server-side, virtualizacao, schema consistente.

### 1.4 Automacoes Limitadas por Cota

| Plano | Automacoes/mes | Integracoes/mes |
|-------|---------------|-----------------|
| Standard | 250 | 250 |
| Pro | 25.000 | 25.000 |
| Enterprise | 250.000 | 250.000 |

**Oportunidade ONEmonday:** Automacoes sem limites artificiais.

### 1.5 App Mobile Fraco

App mobile significativamente inferior a versao desktop. Sem automacoes, dashboards ou gestao complexa no celular.

### 1.6 Suporte ao Cliente Problematico

Tempo medio de 2h para resolver questoes simples. Agentes fazem perguntas repetitivas e irrelevantes.

### 1.7 Dashboard e Reporting Limitados

- Sem drill-down multi-nivel
- Analytics preditivos exigem ferramentas externas
- Dashboards multi-board so nos planos superiores

---

## PARTE 2 -- Como o monday.com e Hoje (2025-2026)

### 2.1 Modulos Principais

1. **monday Work Management** -- Boards, views, automacoes, dashboards (nucleo)
2. **monday CRM** -- Pipeline de vendas, leads, email tracking
3. **monday Service** -- Tickets de suporte, portal de clientes
4. **monday Dev** -- Sprints, bugs, roadmaps

### 2.2 Modelo de Precificacao

| Plano | USD/user/mes | BRL/user/mes | Destaques |
|-------|-------------|-------------|-----------|
| Free | $0 (ate 2) | R$0 | Features minimas |
| Basic | $9 | ~R$41 | 5GB/seat |
| Standard | $12 | ~R$53 | Timeline, 250 automacoes |
| Pro | $19 | ~R$89 | Time tracking, formulas |
| Enterprise | Custom | Custom | Permissoes granulares, SSO |

### 2.3 Pontos Fortes a Igualar

- Interface visual intuitiva com boards coloridos e drag-and-drop
- Onboarding rapido com templates prontos
- 8 visualizacoes (Kanban, Timeline, Calendar, Gantt, Chart, Workload, Map)
- Automacoes no-code ("quando X, faca Y")
- Realtime collaboration
- 200+ integracoes, 827+ apps no marketplace

### 2.4 Integracoes Mais Usadas

Slack, Google Drive, Google Calendar, Zoom, Teams, Gmail, Jira, Salesforce, Zendesk, GitHub, Outlook, Dropbox, HubSpot, Twilio, Zapier/Make.

---

## PARTE 3 -- Diferenciais Estrategicos do ONEmonday

### 3.1 Isolamento por Setor (RBAC)

No monday.com: workspaces separados + configuracao manual + plano Enterprise.
No ONEmonday: nativo com RLS no banco, API guards, permission gates na UI.

### 3.2 Custo Zero por Usuario

100 usuarios Standard no monday.com: R$63.600/ano. ONEmonday: apenas custo de infra.

### 3.3 Mercado Brasileiro

- Interface 100% pt-BR como padrao
- Integracoes futuras com sistemas brasileiros (NF-e, ponto eletronico, e-Social)
- Calendario com feriados brasileiros nativos
- Fuso horario brasileiro como padrao

### 3.4 Performance Controlada

- Paginacao server-side com Supabase (cursor-based)
- TanStack Table com virtualizacao
- Schema consistente no banco
- Realtime via Supabase Realtime

### 3.5 Game-Changers Futuros

1. Automacoes sem limites artificiais
2. Permissoes a nivel de item para todos
3. Cross-sector escalation nativo
4. Dashboard com drill-down real (panorama > setor > projeto > board > card)
5. Modulos plugaveis no mesmo sistema (vs produtos separados do monday)
6. PWA com sync offline
7. AI nativo para triagem de cards

---

## Resumo Executivo

| Aspecto | monday.com | ONEmonday |
|---------|-----------|-----------|
| Custo 100 usuarios | R$63.600-106.800/ano | Custo de infra apenas |
| RBAC por setor | Enterprise only | Nativo desde o MVP |
| Permissao por item | Enterprise only | Disponivel para todos |
| Cross-sector escalation | Workaround | Feature nativa |
| Automacoes | 250-250k/mes por plano | Sem limites artificiais |
| Performance boards grandes | Degrada com 500+ itens | Paginacao server-side |
| Localizacao BR | Superficial | First-class |
| Drill-down reporting | Limitado | Multi-nivel |
| Extensibilidade | Produtos separados | Modulos plugaveis |
