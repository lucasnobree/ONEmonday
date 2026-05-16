# UX Audit — CRM Module

**Module:** CRM (`/crm`)
**Auditor:** Senior Product Designer
**Date:** 2026-05-15
**Method:** Screen-by-screen review of captured screenshots (`screenshots/audit/admin/07–12`,
`screenshots/audit/gerente-comercial/00`) cross-referenced with source code in
`apps/web/app/(dashboard)/crm`, `apps/web/components/crm`, `apps/web/hooks/crm`,
`apps/web/lib/actions/crm` and `apps/web/lib/validations/crm.ts`.

---

## Module summary & overall rating

The CRM module covers the right surface area for a B2B sales team: a dashboard with
weighted-pipeline forecasting, a kanban pipeline with deal-rotting indicators, proposals
with line items, companies, contacts and an activity timeline. The data model is
genuinely thoughtful — weighted forecast, probability lock/unlock, stage-level rotting
thresholds, structured lost-reason categories — and matches concepts found in Pipedrive
and HubSpot. CSV export exists on every list. This is well above a typical first-pass CRM.

However, the **interaction layer is underbuilt** and the module is held back by a set of
recurring, systemic problems:

- **No inline editing, no row/card selection, no bulk actions** anywhere. Companies and
  Contacts are read-only card grids: you cannot edit or delete a company or a contact
  from the UI at all (the edit dialogs exist in code but are never wired to a trigger).
- **Filtering is minimal.** Companies and Contacts have only a free-text search; the
  Pipeline has no filter at all; Activities has type + date but no owner/company filter.
- **Every `<Select>` is unclearable and unsearchable.** Company/contact/deal pickers in
  the create dialogs are plain selects with no "None" option and no type-ahead — unusable
  once the account list grows past ~20 rows.
- **Loading states leak.** The Dashboard and Pipeline screenshots show grey skeleton
  blocks (the captures landed mid-load), which itself signals slow first paint and a
  hard dependency on `currentSector` before anything renders.
- **The Proposals status filter shows the raw value `all`** instead of "Todos".
- Several **pt-BR / accent defects**: "Gestao", "Reuniao", "Atividades" headings and
  many labels are missing diacritics; "all" is untranslated.

**Overall rating: 6.0 / 10** — Strong domain model and a competitive feature checklist,
let down by shallow interactions, missing edit/delete paths, and weak filtering. The gap
to Pipedrive/HubSpot is almost entirely in *usability*, not *features*.

---

## Screen 1 — CRM Dashboard

**Reference:** `screenshots/audit/admin/07-crm-dashboard.png` · code: `crm/page.tsx`,
`hooks/crm/use-crm-stats.ts`, `components/crm/pipeline-funnel.tsx`

The screenshot shows the page **mid-load**: four grey stat skeletons and one large grey
block, with no content. The code (lines 135–146) confirms a full-page skeleton gated on
`dealsLoading || statsLoading`.

### What works
- Four well-chosen KPIs: Deals Ativos, Valor no Pipeline, **Previsão Ponderada**
  (value × win-probability — a real forecasting signal, on par with Pipedrive's weighted
  pipeline) and Deals Ganhos. The weighted-forecast card even carries an inline `hint`.
- Secondary panels are genuinely useful: a pipeline funnel, "Fechamento Próximo" (deals
  closing in 7 days, with `Hoje`/`Amanhã`/`Nd` badges), a "Top Performers" ranking and a
  recent-deals table. Currency is correctly `Intl.NumberFormat('pt-BR', 'BRL')`.

### Findings

| # | Impact | Finding | Recommendation |
|---|--------|---------|----------------|
| D1 | **High** | Full-page skeleton blocks the *entire* dashboard until both `useDeals` and `useCRMStats` resolve. Stat cards depend only on `stats`; the funnel only on `deals`. One slow query freezes everything. | Render each card/panel with its own local skeleton (Suspense-style per-widget loading), as HubSpot's dashboard does. KPI tiles should paint as soon as `stats` is back. |
| D2 | **High** | No date-range / period control. Every figure is all-time. A sales manager cannot ask "this quarter vs last". | Add a period selector (Este mês / Trimestre / Ano / Custom) driving all KPIs and the funnel — table stakes in Pipedrive and Salesforce dashboards. |
| D3 | **Medium** | The funnel (`pipeline-funnel.tsx`) is a bar chart keyed on **count**, and `pipelineStages` is built from a `Map` with no ordering — `position` is hard-coded to `0`. Stages render in arbitrary insertion order, so the "funnel" is not funnel-shaped. | Sort stages by `board_columns.position`; consider value-weighted bar width and a stage-to-stage conversion-rate label, as Pipedrive shows. |
| D4 | **Medium** | "Top Performers" is grouped by `cards.created_by` (the deal *creator*), not a deal owner — the code comment admits `crm_deals has no owner_id`. Creator ≠ owner; the ranking is misleading. | Add an explicit deal owner (or use `card.assignees`) and rank on that. |
| D5 | **Low** | Nothing on the dashboard is clickable — recent-deal rows and closing-soon items don't open the deal sheet. | Make rows navigate to the deal detail sheet (the component already exists). |
| D6 | **Low** | KPI cards have no trend/delta indicator (e.g. "▲ 12% vs mês anterior"). | Add period-over-period deltas once D2 lands. |

---

## Screen 2 — Pipeline

**Reference:** `screenshots/audit/admin/10-crm-pipeline.png` · code: `crm/pipeline/page.tsx`

The screenshot again shows the page **mid-load** — one header skeleton and a 4-column grid
of grey card placeholders. Code review of the loaded state follows.

### What works
- A real kanban with **native HTML5 drag-and-drop**: drag start/over/leave/drop handlers,
  a `dragOverColumnId` ring highlight, `opacity-40 scale-95` on the dragged card, and an
  `isMoving` lock to prevent double-drops. Drop calls `moveDealToColumn` then invalidates
  `crm-deals`/`crm-stats`.
- Deal cards are well-designed and competitive with Pipedrive: priority left-border,
  **deal-rotting badge** ("Sem movimentação há N dias" with stage-specific thresholds),
  value, company, close date and a colour-coded probability badge.
- Header summary shows deal count and total pipeline value.

### Findings

| # | Impact | Finding | Recommendation |
|---|--------|---------|----------------|
| P1 | **High** | **No optimistic UI on drag-drop.** `handleDrop` awaits the server action and only then invalidates; the whole board is frozen by `isMoving` for the full round-trip, and the card visibly snaps back to its origin until the refetch lands. Pipedrive moves the card instantly. | Apply an optimistic cache update on drop; reconcile/rollback on error. Remove the global `isMoving` freeze — lock only the dragged card. |
| P2 | **High** | **Drag-drop is mouse-only and inaccessible.** Native `draggable` has no keyboard equivalent, no ARIA, no screen-reader announcement. A keyboard user cannot move a deal at all. | Adopt `@dnd-kit` (keyboard sensor + live-region announcements) or add a "Mover para…" menu on each card as a non-drag fallback. |
| P3 | **High** | Drop errors are **silently swallowed** — `handleDrop` only `console.error`s `result.error`. The user sees the card snap back with no explanation. | Show a `toast.error` on failure (the `sonner` toaster is already used across the module). |
| P4 | **High** | **No filtering or grouping.** The pipeline cannot be filtered by owner, company, value, priority or close date, and there is no search. With more than ~30 deals the board is unusable. Stage columns are also built from a `Map` with `position: 0`, so **column order is non-deterministic**. | Add a filter bar (owner, value range, close-date, priority, search) and order columns by `board_columns.position`. Stage ordering is a correctness bug, not a nicety. |
| P5 | **Medium** | "Pipeline" depends on a board whose name contains "crm"/"pipeline"/"vendas" (`crm/pipeline/page.tsx:183`). If no such board exists the user gets a dead-end empty state telling them to go create a board — a fragile, magic-string coupling. | Let the sector explicitly designate its pipeline board in settings; don't match on name substrings. |
| P6 | **Medium** | The card "owner" avatar (lines 443–449) is a placeholder showing the **first letter of the contact or company name** — not an owner at all. Misleading. | Show the real deal owner's initials/avatar once an owner field exists (see D4). |
| P7 | **Low** | No per-column value sort, no collapsed columns, no "add deal" affordance inside a column header. | Add a `+` in each column header to create a deal pre-set to that stage; allow column collapse. |
| P8 | **Low** | The board is `overflow-x-auto` with fixed `w-75` columns and no horizontal-scroll affordance — hidden columns are easy to miss. | Add scroll shadows or a stage-jump control. |

---

## Screen 3 — Proposals

**Reference:** `screenshots/audit/admin/11-crm-proposals.png` · code: `crm/proposals/page.tsx`,
`components/crm/proposal-form-dialog.tsx`, `proposal-detail-sheet.tsx`

### What works
- Clean table: Título, Deal, Valor (right-aligned), Expira em, Status. Currency and dates
  are correctly pt-BR formatted; status badges are colour-coded with a full status map
  (Rascunho/Enviada/Visualizada/Aceita/Rejeitada/Expirada).
- Row click opens a solid detail sheet with a **line-item table** (Qtd × Preço Unit. →
  Total) and contextual status actions (Enviar / Editar / Excluir for drafts; Aceitar /
  Rejeitar for sent/viewed).
- The create/edit dialog has a proper repeatable line-item editor with a live total.

### Findings

| # | Impact | Finding | Recommendation |
|---|--------|---------|----------------|
| PR1 | **High** | The status filter trigger displays the raw value **`all`** instead of "Todos" (visible in the screenshot). `statusFilter` is initialised to `"all"` but `<SelectValue placeholder="Status" />` only shows the placeholder when empty — `all` is a real value, so the raw string renders. | Render a label for the `all` option, or seed the trigger with the matching `SelectItem` label. Also: the dropdown lists Rascunho…Rejeitada but omits **Expirada**, which exists in `statusConfig`. |
| PR2 | **High** | **No PDF export / shareable proposal link.** A proposal that can't be sent to the client as a document is half a feature — this is the headline capability in PandaDoc/HubSpot Quotes/Proposify. "Enviar" only flips a status; nothing is actually sent. | Add PDF generation and a public, trackable proposal link; wire "Visualizada" to a real view event. |
| PR3 | **Medium** | Proposal value = sum of line items only. No discount, tax, or per-line discount fields, despite the Activities data referencing "desconto de 10%". | Add discount + tax rows to the line-item editor and totals. |
| PR4 | **Medium** | The "Deal" select in the create dialog lists only **open deals** with no search and no company context — two deals with similar titles are indistinguishable. | Make it a searchable combobox showing `deal — company`. |
| PR5 | **Medium** | "Excluir" in the detail sheet deletes immediately with no confirmation dialog. | Add an `AlertDialog` confirmation. |
| PR6 | **Low** | No empty-state CTA when a status filter returns nothing (just "Nenhuma proposta encontrada"). Acceptable, but no "limpar filtro" affordance. | Add a clear-filter link in the empty result. |

---

## Screen 4 — Contacts

**Reference:** `screenshots/audit/admin/09-crm-contacts.png` · code: `crm/contacts/page.tsx`,
`components/crm/contact-form-dialog.tsx`, `contact-detail-sheet.tsx`

### What works
- A clean 3-column card grid; each card shows name, "Principal" badge, role, email, phone
  and linked company. Click opens a detail sheet with Informações + Atividades tabs.
- Search covers name, email, company and position. CSV export present. The form dialog
  is well-built (re-seeds on open via the render-time pattern, has a Switch for "principal").

### Findings

| # | Impact | Finding | Recommendation |
|---|--------|---------|----------------|
| C1 | **High** | **Contacts can't be edited or deleted from the UI.** `ContactFormDialog` fully supports edit mode (`useUpdateContact`, `isEdit`), but the page never passes a `contact` prop and the detail sheet has **no Edit/Delete buttons**. The edit path is dead code. | Add Editar / Excluir actions in the contact detail sheet header (and a card kebab menu). This is a basic, missing CRUD path. |
| C2 | **High** | **No card/row selection and no bulk actions.** You cannot multi-select contacts to export a subset, reassign, or delete. Salesforce list views and HubSpot both treat checkbox bulk-edit as core. | Add a list/table view with checkboxes + a bulk toolbar (export, delete, assign owner). |
| C3 | **Medium** | A pure card grid does not scale — the screenshot already shows 10 contacts and the last row is clipped. No pagination, no sorting, no density toggle, no table view. | Offer a sortable, paginated table view as the default once contacts exceed ~12; keep cards as an optional layout. |
| C4 | **Medium** | The only filter is free-text search. No filter by company, owner, "principal", or "has open deal". | Add a filter bar (company, owner, principal-only). |
| C5 | **Medium** | The "Empresa" picker in the contact form is an unsearchable `<Select>` with **no "Nenhuma" option** — once a company is chosen it cannot be cleared. Same defect in the deal and activity dialogs. | Replace with a searchable combobox that includes a clear/"Nenhuma" entry. |
| C6 | **Low** | No email/phone affordance — addresses are plain text, not `mailto:`/`tel:` links, and there's no "registrar atividade" shortcut from a contact. | Make email/phone actionable; add a quick-activity button in the detail sheet. |
| C7 | **Low** | Detail sheet's Atividades tab is read-only — you cannot log a call/note from the contact you're looking at. | Add "Nova Atividade" inside the contact sheet pre-linked to that contact. |

---

## Screen 5 — Companies

**Reference:** `screenshots/audit/admin/08-crm-companies.png` · code: `crm/companies/page.tsx`,
`components/crm/company-form-dialog.tsx`, `company-detail-sheet.tsx`

### What works
- 3-column card grid; cards show name, a porte badge (Micro/Pequena/Média/Grande/
  Enterprise), industry, domain, city/state and contact count (correctly pluralised).
- Detail sheet is the strongest in the module: Informações / Contatos / Deals tabs, with
  **"Pipeline aberto" and "Receita ganha" roll-up metrics** computed from the company's
  deals — a genuinely useful account view.
- Proper `EmptyState` with CTA when no companies exist.

### Findings

| # | Impact | Finding | Recommendation |
|---|--------|---------|----------------|
| CO1 | **High** | Same as C1 — **companies cannot be edited or deleted from the UI.** `CompanyFormDialog` supports edit mode but the page never uses it and the detail sheet has no actions. | Add Editar / Excluir to the company detail sheet header. |
| CO2 | **High** | Same as C2 — no selection, no bulk actions. | Add list view + checkboxes + bulk toolbar. |
| CO3 | **Medium** | No filtering beyond text search (no filter by porte, industry, or has-open-deal); no sort; no pagination. | Add a filter bar and a sortable table view. |
| CO4 | **Medium** | The detail sheet's Contatos and Deals tabs are read-only — you cannot add a contact or a deal from the company you're viewing, which is the natural workflow. | Add "Novo Contato" / "Novo Deal" buttons inside the respective tabs, pre-linked to the company. |
| CO5 | **Low** | `createCompanySchema` validates `email` but `domain`, `phone`, `state` are free strings — `state` has only a `maxLength={2}` UI hint, no UF validation. | Add light format validation (UF enum, domain/phone shape) with inline error feedback. |
| CO6 | **Low** | No company logo / favicon; the detail sheet uses a generic building icon. | Pull a favicon from `domain` for quick visual recognition (HubSpot does this). |

---

## Screen 6 — Activities

**Reference:** `screenshots/audit/admin/12-crm-activities.png` · code: `crm/activities/page.tsx`,
`components/crm/activity-create-dialog.tsx`

### What works
- A clean vertical **timeline** with a connecting rail, colour-coded type icons
  (call/email/meeting/note/task) and type badges. Each entry shows author, full pt-BR
  date-time, optional duration, description and Deal/Contato/Empresa links.
- A real filter row: a segmented type filter (Todos/Chamadas/Emails/Reuniões/Notas/
  Tarefas) plus De/Até date inputs with a "Limpar" button.
- The create dialog is type-aware — it reveals From/To email fields for emails and a
  Local field for meetings, then folds them into the description.

### Findings

| # | Impact | Finding | Recommendation |
|---|--------|---------|----------------|
| A1 | **High** | Activities are **append-only** — no edit, no delete, no complete/reschedule. There is no concept of a *pending* task with a due date: `task` is just a log type. The screen is titled "Atividades Recentes" but functions as an immutable feed. | Split into "Tarefas pendentes" (open, due-dated, completable) and "Histórico". Pipedrive's activity model — scheduled, overdue, done — is the benchmark. |
| A2 | **High** | The `createActivitySchema` has `scheduledAt`, but the create dialog **never exposes a date/time field** — every activity is implicitly "now". You cannot schedule a future call or meeting. | Add a date-time picker to the activity dialog and surface upcoming/overdue activities on the dashboard and deal sheet. |
| A3 | **Medium** | No filter by owner, deal, contact or company; the date inputs are raw `dd/mm/yyyy` browser inputs with no range presets (Hoje/Semana/Mês). | Add owner/entity filters and quick date-range presets. |
| A4 | **Medium** | No pagination or virtualisation — `useActivities` loads the whole list and renders every node. The feed grows unbounded. | Paginate or infinite-scroll. |
| A5 | **Medium** | Email/meeting metadata (From/To/Local) is concatenated into a free-text `description` string with a `---` separator. It is unstructured, unsearchable and unfilterable. | Persist these as real columns/JSON fields. |
| A6 | **Low** | Timeline entries are not clickable — you can't jump to the linked Deal/Contato/Empresa. | Make the entity references links. |
| A7 | **Low** | The type filter is a segmented control while Proposals uses a dropdown for its filter — inconsistent filter UI across the module. | Standardise on one filter pattern. |

---

## Per-sector access — Gerente Comercial

**Reference:** `screenshots/audit/gerente-comercial/00-dashboard.png`

The sector-manager (`gerente.comercial@onemonday.local`) lands on the **generic Boards
dashboard** ("Total de Cards / Atrasados / Criados na Semana / Cards por Prioridade"),
**not** the CRM dashboard — even though this is the *commercial* manager whose primary job
is the sales pipeline. CRM is reachable, but only as one item in the "Módulos" sidebar.

### Findings

| # | Impact | Finding | Recommendation |
|---|--------|---------|----------------|
| S1 | **High** | The commercial manager's default landing page surfaces zero sales data — no pipeline value, no forecast, no closing-soon. The CRM dashboard (which has exactly the KPIs this role needs) is two clicks away. | For the `comercial` sector, make `/crm` the default landing route, or embed the CRM KPI strip on the sector dashboard. |
| S2 | **Medium** | CRM data is scoped by `currentSector.id` on every hook, which is correct — but every CRM page hard-blocks with "Selecione um setor…" if `currentSector` is null. A manager bound to one sector should never see this. | Auto-select the user's sole/primary sector; reserve the prompt for genuinely multi-sector users. |
| S3 | **Low** | There is no sales-rep-scoped view ("meus deals", "minhas atividades") — everything is sector-wide. A rep cannot focus on their own book. | Add an owner-scoped "Meus" toggle once a deal owner field exists. |

---

## Cross-cutting issues

- **No edit/delete CRUD for companies and contacts** (C1, CO1) — the edit dialogs are
  built and unused. Highest-value, lowest-effort fix in the module.
- **`<Select>` everywhere instead of comboboxes** — deal/company/contact/proposal pickers
  are unsearchable and (except where a placeholder shows) unclearable. Breaks past ~20 rows.
- **No bulk selection / bulk actions** on any list (C2, CO2) — below Salesforce/HubSpot
  list-view baseline.
- **Weak, inconsistent filtering** — Pipeline has none; Companies/Contacts have only
  search; Activities uses a segmented control while Proposals uses a dropdown.
- **Silent error handling** — pipeline drop errors only `console.error` (P3).
- **pt-BR / accent defects** — module heading "Gestao", "Reuniao", untranslated `all`
  (PR1); run a diacritics pass across all CRM strings.
- **No deal owner field** — forces creator-as-owner hacks in the dashboard ranking (D4)
  and the pipeline card avatar (P6).

---

## Prioritized backlog (by value / effort)

| Rank | Item | Screens | Impact | Effort |
|------|------|---------|--------|--------|
| 1 | Wire Edit/Delete actions for Companies & Contacts (dialogs already exist) | Companies, Contacts | High | Low |
| 2 | Fix Proposals filter showing raw `all`; add missing "Expirada" option | Proposals | High | Low |
| 3 | Toast on pipeline drag-drop failure; optimistic card move | Pipeline | High | Low–Med |
| 4 | Order pipeline columns & dashboard funnel by `board_columns.position` (correctness bug) | Pipeline, Dashboard | High | Low |
| 5 | Per-widget loading on the Dashboard (decouple stats from deals) | Dashboard | High | Med |
| 6 | Replace `<Select>` pickers with searchable, clearable comboboxes | All create dialogs | High | Med |
| 7 | Add filter bars (Pipeline: owner/value/priority; Contacts/Companies: company/owner/porte) | Pipeline, Contacts, Companies | High | Med |
| 8 | Sector-aware landing — route Gerente Comercial to `/crm`; auto-select single sector | All | High | Low |
| 9 | List/table view + checkbox bulk actions for Companies & Contacts | Companies, Contacts | High | Med |
| 10 | Add a real deal owner field; fix Top Performers ranking & pipeline avatar | Dashboard, Pipeline | Medium | Med |
| 11 | Scheduled & completable activities (expose `scheduledAt`, split tasks vs history) | Activities | High | Med–High |
| 12 | Dashboard period selector + period-over-period KPI deltas | Dashboard | Medium | Med |
| 13 | Proposal PDF export + trackable share link | Proposals | High | High |
| 14 | Make dashboard/timeline rows clickable into detail sheets | Dashboard, Activities | Low | Low |
| 15 | Keyboard-accessible drag-drop (`@dnd-kit`) or a "Mover para…" fallback menu | Pipeline | High | High |
| 16 | pt-BR diacritics pass + delete-confirmation dialogs | All | Low | Low |

---

## Sources

- [Pipedrive vs HubSpot — Zapier](https://zapier.com/blog/pipedrive-vs-hubspot/)
- [Pipedrive vs HubSpot CRM comparison — Pipedrive](https://www.pipedrive.com/en/crm-comparison/pipedrive-vs-hubspot)
- [Pipedrive vs HubSpot — monday.com blog](https://monday.com/blog/crm-and-sales/pipedrive-vs-hubspot/)
- [Salesforce List Views: 7 Best Practices — Salesforce Ben](https://www.salesforceben.com/salesforce-list-views-best-practices-you-should-implement-right-away/)
- [Mass Update Records in Salesforce Using Quick Actions in List Views — Salesforce Ben](https://www.salesforceben.com/mass-update-records-in-salesforce-using-quick-actions-in-list-views/)
- [Work with List Views — Salesforce Trailhead](https://trailhead.salesforce.com/content/learn/modules/lightning-experience-for-salesforce-classic-users/work-with-list-views)
