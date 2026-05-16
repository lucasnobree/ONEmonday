# UX Audit — Legal Module (Juridico)

**Auditor:** Senior Product Designer
**Date:** 2026-05-15
**Module path:** `apps/web/app/(dashboard)/legal`
**Screens audited:** Dashboard, Contratos, Demandas, Clausulas
**Method:** Screen-by-screen review of full-page screenshots (`screenshots/audit/admin/28-31`) cross-referenced with module source (pages, components, hooks, validations, server actions).

---

## Module summary & overall rating

The Legal module is a clean, four-tab workspace covering a sensible scope: a KPI dashboard, a contract register with renewal tracking, a legal-request (matters) queue, and a reusable clause library. The information architecture is correct, the renewal logic (`lib/legal/renewal.ts`) is well-modelled and unit-tested, and the empty states are friendly and on-brand. The code is consistent and tidy.

However, it is a **register**, not a **contract lifecycle management (CLM) system**. Every screen audited here was captured in the empty state, so much of the assessment is grounded in the code that drives populated states. Against the market leaders (Ironclad, DocuSign CLM, Juro, LinkSquares, ContractWorks) the module is missing the parts that make a legal team actually adopt the tool: no document/file storage, no e-signature or approval routing, no obligation tracking, no automated renewal notifications, and no detail view for any record (every record opens straight into an edit form). There is also a recurring localization defect — Portuguese accents are stripped throughout the UI and the status filter shows the literal string `all`.

**Overall rating: 5.5 / 10** — Solid foundation and clean code; functionally a contract spreadsheet with good renewal math. Needs document handling, a record detail view, notifications, and an accent-correct pt-BR pass to be credible as a legal tool.

### Cross-cutting findings (apply to every screen)

- **High — Accents stripped across the entire UI.** The page chrome, tab labels, all enum labels (`labels.ts`), empty states and dialog copy render without diacritics: "Juridico", "Gestao de contratos, renovacoes e demandas juridicas", "Clausulas", "Servico", "Locacao", "Licenca", "Renovacao automatica", "Acao necessaria", "Em Elaboracao", "Demandas Juridicas Abertas", "Adicione modelos de clausulas pre-aprovadas". The Zod messages in `validations/legal.ts` *are* correctly accented ("Título é obrigatório", "Data inválida"), which proves the stack supports UTF-8 — so this is a content defect, not an encoding limit. For a legal audience this looks unprofessional. Fix: correct every string in `labels.ts`, `layout.tsx`, the three page files and the three dialogs.
- **High — Status/category filters display the literal value `all`.** On Contratos, Demandas and Clausulas the `Select` initialises to `"all"` but the `SelectItem value="all"` label is "Todos os status" / "Todas as categorias" — yet the screenshots show the trigger rendering the raw token **`all`** (visible in screenshots 29, 30, 31). The `SelectValue` has a `placeholder` but no displayed value mapping for the default, so the trigger shows the value key. This is a visible bug on three of four screens. Fix: ensure the trigger renders the selected item's label, or relabel to "Filtrar por status".
- **Medium — No record detail view anywhere.** Clicking a contract row, a matter row or a clause card opens the *edit dialog* directly (`setEditing(...)` in all three pages). There is no read-only detail page. A user cannot view a contract's full history, related matters, renewal timeline or notes without entering edit mode. Every market CLM has a contract record/detail page. Fix: add a detail drawer or page; make "Edit" a deliberate action inside it.
- **Medium — No delete or row actions in the UI.** `deleteContract` exists as a server action (soft-delete via `is_active=false`) but no list screen exposes it; matters and clauses have no delete action at all. There is no per-row "..." menu, no duplicate, no archive. Fix: add a row action menu with Edit/Duplicate/Delete.
- **Medium — `Select` triggers have no accessible label.** In all three dialogs the type/status/priority/category/renewal selects use a visible `<Label>` with no `htmlFor`, and the `SelectTrigger` has no `id` or `aria-label`. Screen readers announce an unlabelled combobox. The `Input`/`Textarea`/`Switch` fields are correctly associated via `htmlFor`. Fix: wire `id`/`aria-labelledby` on every `SelectTrigger`.
- **Low — Sector-scoped access looks correct.** Every hook filters by `sector_id` (`useContracts`, `useMatters`, `useClauses`, `useLegalStats` RPC), and server actions check `hasPermission(perms, sectorId, ...)`. A sector manager sees only their sector's records — the scoping model is sound. The gap is that the UI gives no signal of *which* sector is in scope beyond the global sidebar selector.

---

## Screen 1 — Dashboard (`screenshots/audit/admin/28-legal-dashboard.png`)

Route: `/legal` — `app/(dashboard)/legal/page.tsx`

### What works
- Four KPI cards (Contratos Ativos, Vencem em 30 dias, Demandas Abertas, Em Elaboracao) give an immediate at-a-glance read; backed by a dedicated `get_legal_dashboard_stats` RPC so the count is server-computed.
- "Contratos por Status" is a clean horizontal-bar distribution; "Renovacoes que Exigem Acao" surfaces the right list (notice-window-open + expired, sorted by days remaining); "Demandas Juridicas Abertas" ranks by a sensible priority weight (urgent→low) and caps at 6.
- Renewal-alert rows and matter rows are links into the relevant tab, and the renewal badge intelligently shows `Xd` (days remaining) or "Vencido".
- Loading states are properly handled with skeletons at both page and card level.

### Findings
- **High — KPI cards are not actionable and not filtered links.** The four cards are static; clicking "Vencem em 30 dias" or "Demandas Abertas" does nothing. In Ironclad and LinkSquares every dashboard metric is a saved view — click the number, land on the filtered list. Here, a user who sees "5 vencem em 30 dias" must go to Contratos and re-filter manually. Fix: make each card a link to the relevant tab with a pre-applied filter (e.g. `/legal/contracts?expiring=30`).
- **High — No renewal timeline / calendar.** The dashboard answers "what needs action *today*" but not "what is coming over the next quarter". Ironclad's Data Repository and ContractWorks both surface a forward calendar of expiration/renewal dates; LinkSquares ties alerts to a timeline. The module already computes `noticeDeadline()` and `daysUntilExpiry()` — the data exists. Fix: add a 90-day renewal timeline or month grouping.
- **Medium — "Renovacoes que Exigem Acao" and "Vencem em 30 dias" use inconsistent windows.** The KPI counts a 30-day window (`expiring_30`), while the renewal-alerts card uses the `notice` state (driven by per-contract `notice_period_days`) and `expired`. A contract with a 60-day notice period is "action needed" in the card but absent from the 30-day KPI — the two panels can disagree. Fix: align the windows or label each clearly so the user understands they measure different things.
- **Medium — No spend / value rollup.** Every contract carries `value_amount` + `currency`, but the dashboard shows zero financial aggregation (total active contract value, value expiring, value by counterparty). For a legal+procurement audience this is the single most-requested KPI. Fix: add a "Valor sob contrato" card.
- **Medium — `currentSector` empty state is a bare sentence.** "Selecione um setor para acessar o Juridico." with no styling or call-to-action — inconsistent with the polished `EmptyState` component used on the other tabs. Fix: use `EmptyState`.
- **Low — Status-bar chart has no colour semantics.** Every bar is `bg-primary` (black). "Vencido"/"Encerrado" should read as destructive, "Ativo" as positive — the badge variants in `labels.ts` already encode this. Fix: colour the bars by status variant.
- **Low — KPIs ignore the contract list already loaded.** The page fetches `useLegalStats` (RPC) *and* `useContracts` + `useMatters` (full lists) and computes overlapping things twice. Not a user-facing bug, but the 30-day KPI could be derived client-side and stay consistent with the alerts card.

---

## Screen 2 — Contratos (`screenshots/audit/admin/29-legal-contracts.png`)

Route: `/legal/contracts` — `app/(dashboard)/legal/contracts/page.tsx`

### What works
- Search (by title or counterparty) + status filter + "Novo Contrato" is a familiar, fast layout.
- The table is well-chosen: Titulo, Contraparte, Tipo, Valor, Vencimento, Status, Renovacao — and the derived "Renovacao" column (computed live via `getRenewalStatus`) is genuinely useful and a step beyond a plain register.
- `formatCurrency` localizes properly to pt-BR with a graceful fallback for unknown currency codes; dates use `Intl.DateTimeFormat("pt-BR")`.
- Three distinct empty/zero states are handled correctly: no contracts at all (illustrated `EmptyState`), no results for current filters (centred text), and loading (skeleton rows).
- The renewal model is the strongest part of the module — `notice_period_days`, `renewal_type` (none/auto/optional), notice-window classification — and it is unit-tested (`renewal.test.ts`).

### Findings
- **High — No document attachment.** A contract record has a title, counterparty, dates, value and a free-text note — but **nowhere to store the actual contract file**. Every competitor (Ironclad, DocuSign CLM, Juro, ContractWorks, LinkSquares) is fundamentally a document repository. A legal team cannot use a contracts tool that does not hold the contract. This is the single largest gap. Fix: add file upload/storage and a document viewer to the contract record.
- **High — No approval routing, e-signature or lifecycle workflow.** The status enum (`draft → in_review → approved → active → expired → renewed → terminated`) implies a lifecycle, but the only way to advance it is to manually re-pick the status in a dropdown. There is no review/approval step, no e-signature, no audit trail of who moved it. Ironclad's Workflow Designer and DocuSign CLM's routing are the core of those products. Fix: at minimum add an approval action and a status-change history; longer term, a workflow.
- **High — No automated renewal notifications.** The app *detects* contracts in the notice window but never *tells* anyone — no email, no in-app notification, no assignment to the contract owner. ContractWorks and LinkSquares tie renewal alerts directly to the contract owner automatically. The renewal logic is already there; it just needs a delivery channel. Fix: scheduled job that notifies the owner when a contract enters the `notice` state.
- **Medium — Table is not sortable and has no pagination.** No column header is clickable; the list is fixed to `created_at DESC` (`useContracts`). A legal team naturally wants to sort by expiry date or value. With no pagination, a few hundred contracts render as one long table. Fix: sortable headers (especially Vencimento, Valor) + pagination/virtualization.
- **Medium — Filtering is shallow.** Only status + free-text. No filter by contract type, counterparty, renewal type, owner, value range, or expiry window — and no way to combine. The market norm is faceted filtering and saved views. Fix: add type/renewal/owner filters and a "expiring within" quick filter.
- **Medium — "Novo Contrato" form has no owner field.** The schema supports `ownerId` and the DB stores `owner_id`, but the dialog never collects it — so no contract ever has an owner, which also blocks owner-based renewal notifications and owner filtering. Fix: add an owner select to the contract dialog.
- **Medium — No contract↔matter↔clause linkage shown.** A matter can reference a `contract_id`, but the contract record never shows its related matters, and a contract cannot be assembled from clause-library entries. The three sub-modules are effectively siloed. Fix: surface related matters on the contract detail view; allow inserting library clauses.
- **Medium — Currency is a free-text field.** In the contract dialog `currency` is a plain `Input` (uppercased, `maxLength 8`). A user can type "REAIS" or "R$" and break `Intl.NumberFormat` (the code has a fallback, but the data is now dirty). Fix: make currency a `Select` of ISO codes (BRL, USD, EUR...).
- **Low — Whole row is the click target with no affordance.** The row is `cursor-pointer` and opens the edit dialog, but there is no visible "edit" control, and (per the cross-cutting finding) clicking should arguably open a detail view, not edit mode.
- **Low — Value column shows "-" for null but no thousands hint at entry.** The dialog placeholder "0,00" suggests comma-decimals while the field is `type="number"` (which expects a dot). Minor input ambiguity for pt-BR users.

---

## Screen 3 — Demandas (`screenshots/audit/admin/30-legal-matters.png`)

Route: `/legal/matters` — `app/(dashboard)/legal/matters/page.tsx`

### What works
- The matter queue is the right concept — an intake channel for legal requests (contract review, advice, dispute, compliance, litigation), with type, priority, status and due date.
- Priority and status both render as colour-coded badges with sensible variants (`urgent` = destructive, etc.).
- A matter can be linked to a contract via the dialog's "Contrato relacionado" select, with a clean `__none__` sentinel for "no contract".
- Empty and loading states are handled consistently with the rest of the module.

### Findings
- **High — No assignee in the UI.** The schema supports `assignedTo` and the table is conceptually a work queue, but the dialog never collects an assignee and the list never shows one. A legal request queue where you cannot see *who owns each request* is not a queue — it is a list. This is the defining feature of a matter-management tool. Fix: add an assignee select to the dialog and an "Responsavel" column to the table.
- **High — No search on this screen.** Contratos and Clausulas both have a search box; Demandas has only the status filter. The screenshot confirms a lone `all` dropdown. As the queue grows, finding a matter by title is impossible. Fix: add the same search input pattern used on the other tabs.
- **Medium — No priority or type filter.** Only status. A legal lead's most common question is "show me everything urgent" or "show me all litigation" — neither is possible. Fix: add priority and type filters.
- **Medium — No board / Kanban view.** A matter queue with a 5-state status (`open → in_progress → blocked → resolved → closed`) is a natural Kanban. The platform already has a Boards module, so the pattern exists in-house. A table-only view makes triage harder. Fix: offer a status-grouped board view.
- **Medium — No due-date urgency signal.** The "Prazo" column is plain text; an overdue or imminent matter looks identical to one due next month. The module already has the `daysUntilExpiry` helper for contracts — the same idea applies here. Fix: colour/badge overdue and near-due dates.
- **Medium — No comments / activity thread on a matter.** A legal request needs a back-and-forth between requester and legal. The matter has only a static `description`. There is no updates feed (the platform has a `create_update` capability elsewhere). Fix: add a comment thread to the matter detail view.
- **Low — No requester / created-by shown.** The list does not show who raised the demand or when, so legal cannot tell intake age or chase the requester.
- **Low — Default sort is `created_at DESC`, not priority.** The dashboard ranks open matters by priority weight, but this list does not — a top table ordered by recency buries urgent items. Fix: default-sort by priority, or make columns sortable.

---

## Screen 4 — Clausulas (`screenshots/audit/admin/31-legal-clauses.png`)

Route: `/legal/clauses` — `app/(dashboard)/legal/clauses/page.tsx`

### What works
- A pre-approved clause library is exactly the right idea and matches LinkSquares' Clause Library and Ironclad's clause/template approach.
- Card layout suits clause content well: title, category badge, an "Aprovada" badge with a check icon, and a 4-line clamped preview of the body.
- Search covers both title and body text, and there is a category filter (8 categories: general, confidentiality, liability, payment, termination, ip, compliance, other).
- The dialog cleanly captures title, category, body and an approved/not-approved `Switch`.

### Findings
- **High — Clauses are not connected to contracts.** The library is a dead end: there is no way to insert a clause into a contract, copy it, or reference it from the contract dialog (which has only a free-text "Observacoes" field). LinkSquares' clause library exists *so clauses can be reused when drafting*. As built, this is a notes app for legal text. Fix: add at least a "copy clause" action, and ideally a clause picker in the contract form.
- **Medium — No clause versioning or approval history.** A clause is either `is_approved` true or false, with no record of who approved it, when, or what the previous wording was. Approved legal language must be auditable. Fix: track approver + timestamp; keep prior versions.
- **Medium — Only approved clauses are badged; drafts are visually identical to nothing.** An approved clause shows a green "Aprovada" badge; an unapproved one shows *no* badge — so a user cannot distinguish "draft, do not use" from "approved". Fix: show an explicit "Rascunho" / "Nao aprovada" badge too.
- **Medium — No usage signal.** There is no indication of how often a clause is used or in which contracts — so legal cannot tell which library entries matter or retire stale ones. (Depends on the clause↔contract link above.)
- **Low — Card grid is fixed at 2 columns.** `md:grid-cols-2` only — on a wide monitor the library wastes half the screen and forces extra scrolling. Fix: `lg:grid-cols-3` / `xl:grid-cols-4`.
- **Low — No copy-to-clipboard on the card.** The fastest realistic use of this library today is copy-paste; there is no copy button, the only interaction is "click card → open edit dialog". Fix: add a copy action on each card.
- **Low — Body is plain text only.** Real clauses have numbering, sub-clauses and emphasis; a `Textarea` with `whitespace-pre-wrap` cannot represent that. Acceptable for an MVP, worth noting for parity with rich-text editors in the leaders.

---

## Market comparison summary

| Capability | ONEmonday Legal | Ironclad | DocuSign CLM | Juro | ContractWorks / LinkSquares |
|---|---|---|---|---|---|
| Contract register + metadata | Yes | Yes | Yes | Yes | Yes |
| Renewal / expiry tracking | Yes (strong, tested) | Yes | Yes | Yes | Yes (LinkSquares, ContractWorks) |
| Automated renewal alerts | **No** (detected, not delivered) | Yes | Yes | Yes (auto reminders) | Yes (alerts tied to owner) |
| Document storage / file upload | **No** | Yes | Yes | Yes | Yes |
| E-signature | **No** | Yes | Yes | Yes | Partial |
| Approval routing / workflow | **No** (manual status) | Yes (Workflow Designer) | Yes | Yes (self-serve workflows) | Partial |
| Clause library | Yes (standalone only) | Yes (reusable in drafts) | Yes | Yes | Yes (LinkSquares searchable) |
| AI extraction of contract data | **No** | Yes | Yes | Yes (Juro AI) | Yes (LinkSquares 120+ fields) |
| Record detail view | **No** (edit dialog only) | Yes | Yes | Yes | Yes |
| Obligation tracking | **No** | Yes | Yes | Partial | Partial |

The leaders converged on three things ONEmonday lacks entirely: the contract document lives in the tool, the system routes and notifies, and AI extracts the metadata. ONEmonday's renewal math is competitive; everything around it is missing.

Sources:
- [Ironclad — AI Contract Lifecycle Management Software](https://ironcladapp.com/)
- [Ironclad — Lifecycle Preset Overview](https://support.ironcladapp.com/hc/en-us/articles/22752303578903-Lifecycle-Preset-Overview)
- [Ironclad — Stages of Contract Management](https://ironcladapp.com/journal/contract-management/stages-of-contract-management)
- [Juro — Ironclad CLM: features, pricing and alternatives](https://juro.com/learn/ironclad-clm)
- [HyperStart — 12 Best Contract Tracking Platforms Compared](https://www.hyperstart.com/blog/contract-tracking-platform/)
- [LinkSquares — Best Contract Management Software 2026](https://linksquares.com/inhouse-insights/best-contract-management-software/)
- [DocuSign — Best AI Legal Contract Analysis Tools](https://www.docusign.com/blog/best-ai-legal-contract-analysis-tools)

---

## Prioritized backlog (by value / effort)

| # | Improvement | Impact | Effort | Rationale |
|---|---|---|---|---|
| 1 | Fix the `all` filter label rendering on Contratos/Demandas/Clausulas | High | Low | Visible bug on 3 of 4 screens; trivial fix |
| 2 | Correct pt-BR accents across all labels, chrome and copy | High | Low | Stack supports UTF-8 (Zod messages prove it); pure content pass; credibility for a legal audience |
| 3 | Document upload + viewer on the contract record | High | High | The defining gap vs. every competitor — the tool must hold the contract |
| 4 | Automated renewal notifications to the contract owner | High | Medium | Renewal detection already exists; only a delivery channel + owner field are missing |
| 5 | Add owner (contracts) and assignee (matters) fields and columns | High | Low | Schema already supports `ownerId`/`assignedTo`; unblocks #4, ownership and filtering |
| 6 | Add a read-only record detail view (contract / matter / clause) | Medium | Medium | Currently every click jumps into edit mode; needed for history, related items, activity |
| 7 | Make dashboard KPI cards clickable, filtered links | Medium | Low | Turns static numbers into navigation; standard CLM dashboard behaviour |
| 8 | Search on Demandas + priority/type filters on Demandas, type/renewal filters on Contratos | Medium | Low | Brings list screens to parity; matters has no search at all today |
| 9 | Sortable table headers + pagination on Contratos and Demandas | Medium | Medium | Sort-by-expiry/value is a core legal workflow; lists do not scale today |
| 10 | Connect clause library to contracts (copy action, then clause picker in contract form) | Medium | Medium | Makes the clause library a real tool instead of a notes screen |
| 11 | Approval action + status-change history on contracts | Medium | Medium | Lifecycle statuses imply a workflow that does not exist |
| 12 | Accessibility: associate `<Label>`s with `SelectTrigger`s in all three dialogs | Medium | Low | Unlabelled comboboxes for screen readers |
| 13 | Currency as an ISO-code select; due-date urgency colouring on matters; status-coloured dashboard bars; wider clause grid | Low | Low | Polish items, batchable together |
