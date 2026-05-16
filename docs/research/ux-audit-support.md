# UX Audit — Support Desk Module

**Auditor:** Senior Product Designer
**Date:** 2026-05-15
**Module:** Support Desk (`apps/web/app/(dashboard)/support`)
**Scope:** Dashboard, Tickets, Base de Conhecimento, Respostas Prontas, Regras SLA, plus the per-sector manager dashboard view.
**Method:** Screen-by-screen review of captured admin screenshots + the gerente-suporte dashboard, cross-read against the module source (pages, components, hooks, validations), and benchmarked against Zendesk, Intercom, Freshdesk and Help Scout.

---

## Module summary & overall rating

The Support Desk is a coherent, well-built MVP. It covers the five core help-desk pillars — a stats dashboard, a ticket queue, a knowledge base, canned responses and SLA rules — and the underlying data model is genuinely solid: per-sector scoping, an SLA engine with response/resolve windows, escalation logging, ticket tags, an activity timeline, and a per-ticket detail sheet with comments. The interaction layer is competent: combobox tag/assignee pickers built on `Command`, debounced search, proper empty/loading/skeleton states, CSV export, and `pt-BR` date formatting.

The gaps are concentrated in **scale, agent ergonomics and conversation**. The module is built as a *management* tool (tables, dialogs, badges) rather than an *agent workspace*. There is no bulk action, no sorting, no pagination, no saved/custom views, no SLA countdown on the list, no requester-facing reply channel, and the ticket "conversation" is an internal-comment thread with no customer email out. Localization is inconsistent: the UI mixes Portuguese with raw English (`all`, `Acoes`) and accents are dropped throughout (`Critica`, `Resolucao`).

**Overall rating: 6.5 / 10** — Strong foundations and clean code, but several high-impact agent-productivity and localization gaps separate it from a best-in-class desk.

| Screen | Rating |
|---|---|
| Dashboard (`19`) | 6.5 / 10 |
| Tickets (`20`) | 6 / 10 |
| Regras SLA (`21`) | 7.5 / 10 |
| Base de Conhecimento (`22`) | 7 / 10 |
| Respostas Prontas (`23`) | 7 / 10 |
| Gerente Suporte dashboard (`00`) | 5.5 / 10 |
| Ticket Detail Sheet (component) | 6.5 / 10 |

---

## Screen 1 — Dashboard

**Screenshot:** `screenshots/audit/admin/19-support-dashboard.png`
**Code:** `app/(dashboard)/support/page.tsx`, `hooks/support/use-support-stats.ts`, `components/support/sla-alert-banner.tsx`

### What works
- Clear hierarchy: SLA alert banner → 4 KPI cards → recent tickets table.
- The red SLA banner ("2 tickets com SLA violado") is a strong, actionable signal and links straight to the filtered ticket queue.
- KPI cards have skeleton loading states; the recent-tickets table has a proper empty state.
- Stats are computed efficiently with `count: "exact", head: true` queries and a 60s `staleTime`.

### Findings

**1. KPI cards are static — no trend, no period, no drill-down.** *(Medium)*
The four cards ("Total Tickets / Abertos / SLA Violados / Resolvidos") show a bare number. There is no comparison vs. last week, no sparkline, and the cards are not clickable. Zendesk and Freshdesk dashboards pair every metric with a period delta and a click-through. **Recommendation:** add a "vs. semana anterior" delta and make each card navigate to the pre-filtered ticket list (e.g. "SLA Violados" → `/support/tickets?sla=breached`).

**2. No operational metrics that a support manager actually steers by.** *(High)*
The dashboard counts tickets but omits the metrics every benchmarked product treats as primary: average first-response time, average resolution time, SLA attainment %, CSAT, backlog age, and tickets-by-agent. The CSAT schema already exists (`submitCSATSchema` in `validations/support.ts`) but is surfaced nowhere. **Recommendation:** add a second KPI row — "Tempo médio 1ª resposta", "Tempo médio de resolução", "% SLA cumprido", "CSAT" — and a "Tickets por responsável" breakdown.

**3. "Recent tickets" table omits assignee, channel and SLA.** *(Medium)*
The dashboard table shows Título / Prioridade / Status / Categoria / Criado em, but not the responsável or SLA state that the full Tickets table already carries. A manager scanning the dashboard cannot tell who owns what or what is at risk. **Recommendation:** add Responsável and an SLA pill to the recent-tickets rows, consistent with the Tickets screen.

**4. "Resolvido" status is binary — no in-progress / pending / escalated state on the dashboard.** *(Medium)*
The dashboard derives status purely from `resolved_at` (Aberto vs. Resolvido). The Tickets table additionally shows an "Escalado" badge; the dashboard does not. Real desks use a richer status set (New / Open / Pending / On-hold / Solved). **Recommendation:** align the dashboard status rendering with the Tickets table and consider a proper status enum (see Tickets finding 2).

**5. Date column shows only the date, all rows identical.** *(Low)*
Every row reads `15/05/2026` because the seed data is same-day. With real data this is fine, but consider a relative format ("há 3h") as the detail sheet already does via `formatRelativeTime`, for faster scanning.

---

## Screen 2 — Tickets

**Screenshot:** `screenshots/audit/admin/20-support-tickets.png`
**Code:** `app/(dashboard)/support/tickets/page.tsx`, `hooks/support/use-tickets.ts`, `components/support/ticket-detail-sheet.tsx`

### What works
- Four working filters (Status, Prioridade, Categoria, Tag) plus CSV export and a prominent "Novo Ticket" CTA.
- Rich row content: title, inline tag badges, priority badge, status + escalation badge, assignee, channel, a colour-graded SLA pill, created date, and a one-click resolve action.
- The whole row opens the detail sheet (`cursor-pointer`); the resolve button correctly `stopPropagation()`s.
- The SLA indicator is well-designed: `getSlaIndicator` maps `remaining_pct` to four states (OK / Alerta / Crítico / Violado) with sensible colours.
- Good state coverage: skeleton, true empty state (`EmptyState` with CTA), and a distinct "no results for these filters" message.

### Findings

**1. Filter selects display the raw value `"all"` instead of a localized label.** *(High)*
Every `SelectTrigger` uses a `placeholder` ("Status", "Prioridade"…) but the state initializes to `"all"`, so the trigger renders the literal string **`all`** — visible four times across the top of the screenshot. There is no visible label telling the user what each dropdown filters. **Recommendation:** render the selected option's label, not the value; the `SelectItem` for `all` should show "Todos"/"Todas", and add a small caption or icon per filter. This is the single most jarring polish defect on the screen.

**2. Status is binary (Aberto/Resolvido) — no New / Pending / On-hold.** *(High)*
`useTickets` derives status only from `resolved_at`. Zendesk, Freshdesk and Help Scout all ship a multi-state status (New, Open, Pending/waiting-on-customer, On-hold, Solved, Closed) because "pending on customer" must not count against agent SLA. With a binary model the desk cannot represent "waiting for the requester". **Recommendation:** introduce a `status` enum on `support_tickets` and pause SLA while pending.

**3. No bulk actions, no row selection.** *(High)*
There are no checkboxes. An agent cannot multi-select to reassign, re-prioritize, tag, escalate or resolve. Zendesk supports bulk updates of up to 100 tickets and treats it as core triage workflow ([Zendesk — Managing tickets in bulk](https://support.zendesk.com/hc/en-us/articles/4408886890906-Managing-tickets-in-bulk)). **Recommendation:** add a selection column with a bulk-action bar (Atribuir / Resolver / Escalar / Adicionar tag).

**4. No column sorting and no pagination.** *(High)*
The table renders every active ticket for the sector with no `<th>` sort handlers and no pagination/virtualization. It works for the 8 seeded tickets but will not survive a real backlog of hundreds. **Recommendation:** add sortable headers (priority, created, SLA remaining) and server-side pagination or infinite scroll.

**5. No free-text search on the ticket queue.** *(High)*
The Knowledge Base has a search box but the Tickets queue has none — there is no way to find a ticket by title, requester or ID. Every benchmarked product makes ticket search primary. **Recommendation:** add a search input that filters by title / requester email / ticket ID.

**6. No saved or custom views.** *(Medium)*
The four filters are not persistable. Zendesk's entire triage model is built on saved Views ("My open tickets", "Unassigned", "Breaching SLA") ([Zendesk — Creating views](https://support.zendesk.com/hc/en-us/articles/4408888828570-Creating-views-to-build-customized-lists-of-tickets)). **Recommendation:** allow saving a filter combination as a named view, and ship defaults like "Não atribuídos" and "SLA em risco".

**7. Filter state is not URL-synced.** *(Medium)*
Filters live in `useState`; the SLA banner links to `/support/tickets?status=open` but the Tickets page never reads `searchParams`, so the deep link silently does nothing. **Recommendation:** hydrate filters from `searchParams` and write them back so links, refresh and back-button all work.

**8. No assignment from the list.** *(Medium)*
The only inline action is "resolve". Reassigning requires opening the detail sheet → Detalhes tab → assignee popover (3+ clicks). Freshdesk exposes assignment directly in the list row. **Recommendation:** add an inline assignee avatar/picker in the Responsável cell.

**9. `"Acoes"` column header and accent loss throughout.** *(Medium)*
The header reads `Acoes`, and the page consistently drops diacritics — `Critica`, `Media`, `Responsavel`, `Resolucao`, `Notificacoes`. ONEmonday is a pt-BR product; this looks unfinished. **Recommendation:** restore correct Portuguese ("Ações", "Crítica", "Média", "Responsável") across all support strings.

**10. CSV export ignores tags and assignee.** *(Low)*
`exportToCSV` writes título, prioridade, status, categoria, canal, criado_em — but not the responsável or tags shown in the table. **Recommendation:** include Responsável and Tags columns so the export matches the view.

**11. "Novo Ticket" passes empty `boardId`/`columnId`.** *(Low)*
`<TicketCreateDialog boardId="" columnId="" />` — the schema permits empty strings, but the ticket is created without an explicit board/column placement. Verify the server action assigns a sensible default board so tickets are not orphaned from the kanban.

---

## Screen 3 — Regras SLA

**Screenshot:** `screenshots/audit/admin/21-support-sla-rules.png`
**Code:** `app/(dashboard)/support/sla-rules/page.tsx`, `components/support/sla-rule-form-dialog.tsx`, `hooks/support/use-sla-rules.ts`

### What works
- Clean, readable table: Nome, Prioridade, Categoria, Tempo de Resposta, Tempo de Resolução, Horário Comercial, Ativo, Ações.
- `formatHours` is a nice touch — renders `4h`, `2d`, `1d 4h` instead of raw hour counts; response/resolve times are mono-spaced for alignment.
- Inline `Switch` for active/inactive is the right control and updates optimistically via `useToggleSlaRule`.
- Edit/delete per row; a good empty state with `ShieldCheck` icon.

### Findings

**1. Delete has no confirmation dialog.** *(High)*
`handleDelete` calls the mutation directly from the trash icon — one click permanently removes an SLA policy with no "Tem certeza?" guard. Every other destructive action benefits from a confirm step. **Recommendation:** wrap deletion in an `AlertDialog` confirmation.

**2. No SLA escalation / breach actions.** *(Medium)*
The rule defines response and resolve windows but nothing about *what happens* on breach — no notify-manager, no auto-escalate, no priority bump. Freshdesk and Zendesk SLA policies include escalation tiers (warn at X%, escalate at breach). **Recommendation:** add optional breach actions (notificar gestor, escalar automaticamente) to the rule form.

**3. "Horário Comercial" is a yes/no with no schedule definition.** *(Medium)*
A rule can say "business hours only" but there is no UI to define what business hours *are* (timezone, working days, holidays). The SLA countdown therefore cannot actually honour the flag accurately. **Recommendation:** add a business-hours/calendar configuration, or document the assumed schedule.

**4. Category column always shows "Todas".** *(Low)*
All four seeded rules are priority-only. The schema supports `category`, but with one rule per priority a more granular category × priority matrix is hard to reason about as a flat table. **Recommendation:** when category-specific rules exist, group or indicate rule precedence (which rule wins when several match).

**5. No first-response vs. resolution distinction in breach reporting.** *(Low)*
The rule cleanly separates the two times, and the data model has `sla_response_breached` / `sla_resolve_breached` — but the dashboard's "SLA Violados" merges them with an `or`. A manager cannot tell whether response or resolution SLAs are failing. **Recommendation:** split the breach metric.

---

## Screen 4 — Base de Conhecimento

**Screenshot:** `screenshots/audit/admin/22-support-knowledge-base.png`
**Code:** `app/(dashboard)/support/knowledge-base/page.tsx`, `components/support/kb-article-sheet.tsx`, `kb-article-form-sheet.tsx`, `hooks/support/use-kb-articles.ts`

### What works
- Good layout: segmented filter (Todos / Publicados / Rascunhos) + debounced search + "Novo Artigo", then a responsive 3-column card grid.
- Cards show title, Publicado/Rascunho status badge, category, date, and a content preview.
- Hover-revealed actions (edit / publish-toggle / delete) keep cards clean; `EyeOff`/`Eye` clearly communicate the publish toggle.
- Detail sheet shows author, formatted long date (`02 de maio de 2026`), full content and tags.
- Proper skeleton grid and a search-aware empty state.

### Findings

**1. Article content is raw Markdown shown as plain text.** *(High)*
The card previews and the `KBArticleSheet` body render `## Resetar Senha 1. Acesse **Configuracoes**...` literally — the `##` and `**` are visible in the screenshot. The form stores Markdown but nothing renders it. The sheet even wraps content in `prose prose-sm` classes, implying rendered HTML was intended. **Recommendation:** render Markdown (e.g. `react-markdown`) in the sheet, and strip Markdown syntax from card previews.

**2. No category filter — search only.** *(Medium)*
`categories` is computed from articles and passed to the form, but the list page has no category dropdown; users can only free-text search. Help Scout and Zendesk Guide organize KBs by category/collection. **Recommendation:** add a category filter and/or a collection grouping.

**3. No usage signals — views, helpfulness, last-updated.** *(Medium)*
Cards show only created date. There is no view count, no "was this helpful?", and no updated-at. KB value depends on knowing which articles are used and stale. **Recommendation:** track and surface view counts and an "atualizado em" date; add article feedback.

**4. Hover-only actions are not keyboard/touch accessible.** *(Medium)*
Edit/publish/delete sit in an `opacity-0 group-hover:opacity-100` container — invisible without a mouse hover, so keyboard and touch users cannot reach them, and they have no focus-visible state. **Recommendation:** make actions `focus-within`-visible and always visible on touch, or move them into a `DropdownMenu` (kebab) that is keyboard-reachable.

**5. KB is not linked to tickets or canned responses.** *(Medium)*
Articles live in isolation — an agent in the ticket detail sheet cannot search/insert a KB article, and the public-facing reuse (self-service portal) is absent. Intercom and Zendesk tightly couple KB suggestions into the agent reply. **Recommendation:** add a KB search/insert in the ticket detail sheet, and consider a customer-facing help center.

**6. Delete has no confirmation.** *(Medium)*
Same as SLA rules — the trash icon deletes immediately. **Recommendation:** add an `AlertDialog` confirm.

---

## Screen 5 — Respostas Prontas

**Screenshot:** `screenshots/audit/admin/23-support-canned-responses.png`
**Code:** `app/(dashboard)/support/canned-responses/page.tsx`, `components/support/canned-response-form-dialog.tsx`, `hooks/support/use-canned-responses.ts`

### What works
- Card grid with title, an optional `/shortcut` badge, an optional category badge, and a content preview.
- Click-to-expand (`line-clamp-3` → full) is a nice low-friction way to preview long responses.
- One-click "Copiar" with a `Check` confirmation and toast — good micro-feedback.
- Hover edit/delete actions; clean empty state.

### Findings

**1. Shortcuts are not actually usable inside a reply.** *(High)*
Responses define a `/escalar`, `/followup` shortcut, but the ticket comment box (`CommentsTab`) is a plain `Textarea` with no shortcut autocomplete and no "insert canned response" picker. The shortcut is decorative. In Freshdesk/Help Scout, typing `/` in the reply box surfaces canned responses inline. **Recommendation:** wire a `/`-triggered canned-response picker into the ticket comment composer.

**2. Inconsistent shortcut display.** *(Low)*
The list page renders the shortcut badge as `/{shortcut}` (one slash) while the screenshot shows `//escalar`, `//followup` — meaning the stored value already contains a leading slash, producing a double slash. "Resposta E2E" has no shortcut at all. **Recommendation:** normalize shortcut storage (strip leading slashes on save) so display is always single-slash and consistent.

**3. No template variables / placeholders.** *(Medium)*
Content is static text; one response literally contains `[descrever aqui]` as a manual fill-in. Benchmarked desks support merge fields like `{{requester.name}}`, `{{agent.name}}`, `{{ticket.id}}`. **Recommendation:** support variable interpolation that resolves on insert.

**4. No search, filter or category grouping.** *(Medium)*
The KB has search; canned responses do not, despite a `category` field on every response. A growing library becomes unscannable. **Recommendation:** add search + category filter.

**5. Delete has no confirmation.** *(Medium)* — same pattern as KB / SLA.

**6. No usage analytics.** *(Low)*
No "used N times" signal, so admins cannot prune dead templates. **Recommendation:** track insert counts.

---

## Component — Ticket Detail Sheet

**Screenshot:** opens over `20-support-tickets.png` (no dedicated capture)
**Code:** `components/support/ticket-detail-sheet.tsx`, `escalate-ticket-dialog.tsx`, `ticket-tag-editor.tsx`, `ticket-assignee-picker.tsx`

### What works
- Three-tab structure (Detalhes / Comentários / Atividade) in a right-side `Sheet` — a familiar pattern.
- Detalhes tab is information-dense and well-organized: description, tag editor, a 2-col info grid, SLA response/resolve pills with colour grading and live countdown (`formatSlaTime`), assignees, escalation info and an escalation timeline.
- Tag editor and assignee picker are proper `Command` comboboxes — searchable, with create-on-the-fly for tags ("Criar 'x'"), `Check` marks for assigned members, and `X` to remove.
- Footer actions are contextual: "Marcar primeira resposta" only before first response; "Escalar"/"Resolver" when open; "Reabrir" when resolved.
- Activity timeline has a vertical rail with action-coloured dots and relative timestamps; loading skeleton and not-found states are handled.

### Findings

**1. The "conversation" never reaches the requester.** *(High)*
`CommentsTab` posts internal `card_comments` only — there is no public reply, no email-out, no requester-visible thread, and no internal-note vs. public-reply toggle. For a desk where `channel` can be `email`, the requester literally cannot be answered from the product. This is the biggest functional gap versus every benchmarked tool, all of which center on a public reply composer. **Recommendation:** add a public reply path (email-out for `email`-channel tickets) with an explicit "Nota interna" vs. "Responder cliente" switch.

**2. "Marcar primeira resposta" is a manual button.** *(Medium)*
First-response SLA is satisfied by clicking a button rather than by actually replying. It can be gamed and can be forgotten. **Recommendation:** once a real public reply exists (finding 1), set `first_response_at` automatically on the first outbound message.

**3. Priority, category and channel are read-only in the sheet.** *(Medium)*
The Detalhes grid shows priority/category/channel as static badges/text. `updateTicketSchema` supports editing category, subcategory and channel, but no UI exposes it, and priority lives on the card with no editor here. An agent who needs to re-triage must leave the desk. **Recommendation:** make priority/category/channel editable inline in the sheet.

**4. Escalation can only target sectors the current user belongs to.** *(Medium)*
`EscalateTicketForm` queries `user_sector_roles` for the *current user*, so escalation targets are limited to sectors the agent is a member of — not necessarily the correct destination team. A support agent often needs to escalate to a team they have no membership in. **Recommendation:** drive the target list from organisation sectors (with permission), not the agent's own memberships.

**5. No attachments anywhere in the ticket flow.** *(High)*
Neither ticket creation, the detail sheet, nor comments support file attachments. Screenshots and logs are essential to support; all four benchmarked products support attachments. **Recommendation:** add attachment upload to ticket creation and comments.

**6. No requester / contact panel.** *(Medium)*
The sheet shows only `requester_email` as a text field. There is no contact identity, no history of that requester's other tickets, no organisation. Help Scout's and Intercom's sidebars surface exactly this context. **Recommendation:** add a requester panel with prior-ticket history.

**7. SLA pills in the sheet and in the list use different thresholds.** *(Low)*
`ticket-detail-sheet.tsx` `formatSlaTime` grades by absolute hours remaining (>4h green, 1–4h yellow, <1h red), while `tickets/page.tsx` `getSlaIndicator` grades by `remaining_pct` (>50/25–50/<25/≤0). The same ticket can show green in the list and yellow in the sheet. **Recommendation:** unify on one threshold model (percentage-based is the better choice).

**8. `formatSlaTime` red/green classes are not dark-mode aware.** *(Low)*
It returns hard-coded `bg-red-50` / `bg-green-50` / `text-red-600` with no `dark:` variants, unlike the rest of the module which carefully pairs `dark:` classes. In dark mode these pills will be low-contrast. **Recommendation:** add `dark:` variants.

---

## Screen 6 — Gerente Suporte dashboard (per-sector view)

**Screenshot:** `screenshots/audit/gerente-suporte/00-dashboard.png`

### What works
- The sector switcher is correctly scoped to "Suporte" and the generic dashboard renders board/card metrics for that sector.
- Cards-by-priority bars and a recent-activity feed give the manager a quick pulse.

### Findings

**1. The support sector manager lands on the generic board dashboard, not the Support Desk.** *(High)*
The gerente-suporte's home is the kanban/board dashboard ("Total de Cards", "Cards por Prioridade", "Distribuição por Coluna" — empty). The role most defined by the Support Desk does not land on it. **Recommendation:** route the support-sector manager to `/support` (the Support Desk dashboard) as their default, or surface the Support KPIs on their home dashboard.

**2. "Distribuição por Coluna" shows "Nenhum card encontrado" while "Total de Cards" says 8.** *(Medium)*
A visible data inconsistency: the column-distribution widget is empty even though 8 cards exist. **Recommendation:** fix the column-distribution query for this sector or hide the widget when it cannot resolve.

**3. Vocabulary mismatch — "Cards" vs. "Tickets".** *(Medium)*
The support manager's dashboard talks in "Cards" while the Support Desk talks in "Tickets". Although tickets are backed by cards, the manager-facing language should be ticket-centric. **Recommendation:** relabel to "Tickets" for support-sector context, or give support its own manager dashboard.

**4. Recent activity mixes escalations, tickets and tasks with no filtering.** *(Low)*
The feed shows "Escalamento…", "Ticket #4521…", "Configurar respostas…", "Relatório mensal de SLA…" — useful, but undifferentiated and not clickable into the Support Desk. **Recommendation:** make activity items deep-link to the relevant ticket/screen.

---

## Cross-cutting findings

- **Localization is inconsistent (High).** Raw English (`all` in filters) and stripped accents (`Critica`, `Media`, `Acoes`, `Responsavel`, `Resolucao`, `Notificacoes`, `Vazamento de memoria`) appear across every screen. Validation messages, by contrast, *do* use correct accents ("Título é obrigatório"). Pick one standard — correct pt-BR with diacritics — and apply it everywhere.
- **Destructive actions lack confirmation (High).** SLA rules, KB articles and canned responses all delete on a single icon click. Add `AlertDialog` confirmation consistently.
- **No bulk operations anywhere (High).** Tickets, KB and canned responses are all single-item-at-a-time. At minimum the Tickets queue needs bulk triage.
- **No notification surface for SLA breaches (Medium).** The dashboard banner is the only alert; there is no email/push to the responsible agent when a ticket is breaching. SLA value depends on proactive alerting.
- **Sorting/pagination absent on every table (Medium).** Tickets and SLA-rules tables render all rows unsorted; fine for seed data, not for production.
- **Accessibility (Medium).** Hover-only card actions (KB, canned responses) are not keyboard/touch reachable; filter selects lack visible labels; SLA pills in the detail sheet miss dark-mode contrast.

---

## Prioritized backlog (value / effort)

| # | Improvement | Impact | Effort | Rationale |
|---|---|---|---|---|
| 1 | Fix filter dropdowns to show localized labels instead of raw `all`; restore pt-BR accents app-wide | High | Low | Most visible polish defect; trivial fix |
| 2 | Add confirmation dialogs to all delete actions (SLA, KB, canned) | High | Low | Prevents irreversible data loss |
| 3 | Add free-text search to the Tickets queue | High | Low | Core triage capability, currently absent |
| 4 | Render Markdown in KB article sheet + strip syntax from previews | High | Low | Content is unreadable today |
| 5 | Public reply path on tickets (email-out + internal-note vs. reply toggle) | High | High | Biggest functional gap vs. Zendesk/Freshdesk/Help Scout |
| 6 | Bulk actions + row selection on the Tickets queue | High | Medium | Essential at real backlog volume |
| 7 | Multi-state ticket status (New/Open/Pending/On-hold/Solved) + pause SLA on pending | High | High | Binary status misrepresents "waiting on customer" |
| 8 | Attachments on ticket creation and comments | High | Medium | Support cannot function without screenshots/logs |
| 9 | URL-synced filters + saved/custom views; sortable headers; pagination | Medium | Medium | Makes the queue scale; fixes the dead SLA-banner deep link |
| 10 | Operational KPIs on dashboard (1st-response, resolution, SLA %, CSAT) + clickable cards | Medium | Medium | Gives managers metrics they actually steer by |
| 11 | Wire canned-response `/`-shortcut picker into the comment composer; add template variables | Medium | Medium | Makes the canned-response library functional |
| 12 | Editable priority/category/channel in the detail sheet | Medium | Low | Re-triage without leaving the desk |
| 13 | Route support-sector manager to the Support Desk; fix "Distribuição por Coluna" data gap | Medium | Low | Correct per-sector landing experience |
| 14 | Unify SLA threshold logic between list and detail sheet; add dark-mode SLA pill variants | Low | Low | Consistency + accessibility |
| 15 | SLA breach actions (notify/auto-escalate) + business-hours calendar config | Medium | High | Completes the SLA engine |

---

## Sources
- [Zendesk — Managing tickets in bulk](https://support.zendesk.com/hc/en-us/articles/4408886890906-Managing-tickets-in-bulk)
- [Zendesk — Creating views to build customized lists of tickets](https://support.zendesk.com/hc/en-us/articles/4408888828570-Creating-views-to-build-customized-lists-of-tickets)
- [Zendesk — About the Zendesk Agent Workspace](https://support.zendesk.com/hc/en-us/articles/4408821259930-About-the-Zendesk-Agent-Workspace)
- [Zendesk — 2025 recap: What's new in Zendesk](https://support.zendesk.com/hc/en-us/articles/10140103140122-2025-recap-What-s-new-in-Zendesk)
- [HappyFox — Freshdesk vs Help Scout vs Intercom comparison](https://www.happyfox.com/compare/freshdesk-vs-help-scout-vs-intercom/)
- [Freshworks — Help Scout vs Freshdesk](https://www.freshworks.com/freshdesk/compare-helpdesks/helpscout-vs-freshdesk/)
- [Fini Labs — Intercom vs Freshdesk 2026 comparison](https://www.usefini.com/guides/intercom-vs-freshdesk-comparison)
