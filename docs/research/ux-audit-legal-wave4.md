# UX Audit — Legal Module (Jurídico) — Wave 4

**Auditor:** Senior Product Designer / Front-end Engineer
**Date:** 2026-05-18
**Scope:** New capabilities since Wave 3 — contract document storage + viewer, automated renewal notifications, read-only detail views (contract/matter/clause), and clause↔contract linking.
**Evidence:** `screenshots/audit-wave4/admin/36-legal-dashboard.png` … `39-legal-clauses.png`
**Prior report:** `docs/research/ux-audit-legal.md` (Wave 3). This audit does not repeat already-fixed items.

---

## What Wave 3 fixed (verified)

- **Cross-cutting (accents)** — Diacritics are now correct everywhere: "Jurídico", "Gestão de contratos, renovações e demandas jurídicas", "Cláusulas", empty-state copy (`36`–`39`).
- **Cross-cutting (`all` token)** — The status/category `Select` triggers now render "Todos os status" / "Todas as categorias" via a `SelectValue` render-prop (`contracts/page.tsx:89-95`, `matters/page.tsx:89-95`, `clauses/page.tsx:74-80`). The literal `all` bug is gone.
- **Detail view** — `ContractDetailSheet`, `MatterDetailSheet`, `ClauseDetailSheet` exist; clicking a row/card opens a read-only sheet, and "Editar" is a deliberate action.
- **#3 Document upload** — `ContractDocumentUpload` (drag-and-drop, 25MB, private `legal-documents` bucket) + a documents tab in the detail sheet.
- **#4 Automated renewal notifications** — `renewal-worker.ts` + `renewal-notice.ts` + a cron route deliver in-app and outbox notifications, idempotent via `renewal_notified_at`.
- **#5 Owner / assignee** — Contracts have a "Responsável" column; matters show an assignee; both detail sheets resolve names via `useSectorMembers`.
- **#10 Clause↔contract linking** — `ClausePicker` + a Cláusulas tab on the contract sheet; clause cards have a "Copiar texto" action and the grid is now `lg:grid-cols-3`.
- **Clause draft badge** — Unapproved clauses show an explicit "Rascunho" badge.
- **Select labels** — `SelectTrigger`s now carry `aria-label`.

This is a large wave — most Wave 3 High/Medium items are closed. Remaining findings concern the new screens' depth and polish.

## Module summary & overall rating

Legal has crossed from "contract spreadsheet" into a genuine lightweight CLM: the contract document now lives in the tool, renewals notify the owner automatically, every record has a tabbed read-only detail sheet, and the clause library is wired into contracts both ways (link + copy). The renewal math remains the strongest, best-tested part of the codebase, and the new worker layer is cleanly separated and unit-tested.

What is still missing relative to Ironclad / DocuSign CLM is the **lifecycle**: no approval routing or e-signature, no status-change history, no obligation tracking, no AI metadata extraction, no in-document viewer (documents open in a new browser tab), and no comment/activity thread on a matter. The dashboard is still static. These are depth gaps, not defects.

**Overall rating: 7.5 / 10** — up from 5.5. The structural gaps Wave 3 flagged are largely closed; the module is now competitive on register + renewal + documents, and behind only on workflow and AI.

### Cross-cutting findings

| # | Finding | Impact |
|---|---------|--------|
| C1 | **Lifecycle statuses still imply a workflow that does not exist.** Contract status (`draft → in_review → approved → active → expired → renewed → terminated`) and matter status are advanced only by manually re-picking a value in the edit dialog. There is no approval action, no status-change history, no record of who moved a contract or when. Ironclad's Workflow Designer and DocuSign CLM routing are the core of those products. | High |
| C2 | **Detail sheets are read-only with one escape hatch — "Editar".** They have no inline actions: no status quick-change, no "marcar como renovado", no delete from the sheet. `deleteContract` exists as a server action but no screen exposes it; matters and clauses have no delete UI at all. | Medium |
| C3 | **`new Date("YYYY-MM-DD")` date parsing throughout** — `contracts/page.tsx:187`, `matters/page.tsx:182`, both detail sheets, the dashboard. A date-only string parses as UTC midnight, so an `America/Sao_Paulo` (UTC-3) user can see an expiry/due date shifted back one day. | Medium |
| C4 | **No record-level activity or audit trail on any screen.** Documents show an upload date; nothing shows who uploaded, who linked a clause, who changed a status. A legal audience expects auditability of approved language and contract changes. | Medium |

---

## Screen 1 — Dashboard

**Screenshot:** `36-legal-dashboard.png`
**Code:** `legal/page.tsx`

### What works
- Four KPI cards, a contract-status distribution, a renewal-alerts list and a priority-ranked open-matters list — backed by `get_legal_dashboard_stats` plus client-side derivation.
- Renewal-alert and matter rows are links into the relevant tab; the renewal badge shows `Xd` or "Vencido".
- Proper skeletons.

### Findings

| # | Finding | Impact | Recommendation |
|---|---------|--------|----------------|
| D1 | **KPI cards are still static, not filtered links** (Wave 3 dashboard finding, still open). Clicking "Vencem em 30 dias" or "Demandas Abertas" does nothing. Ironclad/LinkSquares dashboards make every metric a saved view. | Medium | Make each card a link to the relevant tab with a pre-applied filter (e.g. `/legal/contracts?renewal=expiring`). |
| D2 | **Renewal-alert links all point to `/legal/contracts` with no deep link.** `legal/page.tsx:206` hard-codes `href="/legal/contracts"`; clicking a specific expiring contract lands on the unfiltered list — the user must find it again. | Medium | Deep-link to the contract (open its detail sheet via a query param, e.g. `?contract=<id>`). |
| D3 | **Status-distribution bars are all `bg-primary` (black)** — `legal/page.tsx:165`. "Vencido"/"Encerrado" should read destructive, "Ativo" positive; the `CONTRACT_STATUS_LABELS` variants already encode this. (Wave 3, still open.) | Low | Colour each bar by its status variant. |
| D4 | **No "Valor sob contrato" rollup and no renewal timeline/calendar** (Wave 3, still open). Every contract has `value_amount` + `currency`; the dashboard shows no financial aggregation and no forward 90-day view of expirations. | Medium | Add a "Valor sob contrato" card and a 90-day renewal timeline. |
| D5 | **`currentSector` empty state is a bare `<p>`** (`legal/page.tsx:50`), not the `EmptyState` component used on the tabs. (Wave 3, still open.) | Low | Use `EmptyState`. |

---

## Screen 2 — Contratos / Contracts

**Screenshot:** `37-legal-contracts.png`
**Code:** `contracts/page.tsx`, `contract-detail-sheet.tsx`, `contract-document-upload.tsx`, `clause-picker.tsx`

### What works
- Search + status filter + "Novo Contrato"; the table now includes a "Responsável" column.
- `ContractDetailSheet` is genuinely good: a 4-tab sheet (Informações / Documentos / Cláusulas / Demandas) with contract metadata, computed notice deadline, drag-and-drop document upload, linked clauses with a picker, and related matters — this closes the biggest Wave 3 gaps in one component.
- Document upload uploads to a private bucket and rolls back the Storage object if the metadata write fails (`contract-document-upload.tsx:64-72`) — careful engineering.
- The header/empty/loading/no-results states are all distinct and correct.

### Findings

| # | Finding | Impact | Recommendation |
|---|---------|--------|----------------|
| K1 | **Documents open in a new browser tab — there is no in-app viewer.** `contract-detail-sheet.tsx:119` calls `window.open(result.url)`. Every CLM leader (Ironclad, DocuSign CLM, ContractWorks) renders the contract inline next to its metadata; jumping to a raw PDF tab loses the contract context. | Medium | Embed a PDF/document preview pane in the Documentos tab (an `<iframe>`/PDF viewer over the signed URL is a large step up). |
| K2 | **No approval routing or e-signature** (cross-cutting C1). The status enum implies review/approval; the only control is the dialog dropdown. | High | Add an approval action + status-change history on the contract sheet; e-signature is the longer-term bet. |
| K3 | **Table is not sortable and has no pagination** (Wave 3, still open). `useContracts` is fixed to `created_at DESC`; a legal team wants to sort by expiry date or value. | Medium | Sortable headers (Vencimento, Valor) + pagination. |
| K4 | **Filtering is still only status + free text** (Wave 3, still open). No filter by type, renewal type, owner, or "expiring within". The contract list does have an owner column now but you cannot filter by it. | Medium | Add type / renewal / owner facets and an "expiring within" quick filter. |
| K5 | **No document type or version concept.** All documents sit in a flat list with `file_name` + size + date. A contract typically has the signed original, amendments, and exhibits; there is no way to mark "versão assinada" or group amendments. | Medium | Add a document-type/label field and a versioning notion (supersedes). |
| K6 | **AI metadata extraction absent.** Ironclad Smart Import and DocuSign Iris auto-extract counterparty, dates, value and obligations from an uploaded contract; here every field is typed manually after upload. | Low (strategic) | Roadmap: OCR/LLM extraction to pre-fill the contract form from the uploaded file. |
| K7 | **No obligation tracking.** Beyond the renewal/expiry date the contract carries no obligations (deliverables, payment milestones, SLAs). Ironclad's Obligation Management is a core post-signature feature. | Low (strategic) | Roadmap: an obligations list per contract with due dates feeding the dashboard. |
| K8 | **Detail sheet "Editar" is the only action; no delete/duplicate/archive** (cross-cutting C2). | Low | Add a row/sheet action menu with Delete (wire the existing `deleteContract`) and Duplicate. |

---

## Screen 3 — Demandas / Matters

**Screenshot:** `38-legal-matters.png`
**Code:** `matters/page.tsx`, `matter-detail-sheet.tsx`

### What works
- Search + status filter + "Nova Demanda"; the table shows Tipo, Responsável, Prioridade, Prazo, Status with colour-coded priority/status badges.
- `MatterDetailSheet` resolves assignee and requester names, shows the related contract, created/resolved dates, and the description — a real read-only record.

### Findings

| # | Finding | Impact | Recommendation |
|---|---------|--------|----------------|
| M1 | **No comment / activity thread on a matter** (Wave 3, still open). The detail sheet shows a static `description` only. A legal request is a back-and-forth between requester and legal; the platform has a `create_update` capability elsewhere. Without a thread, a matter is a form, not a workflow. | High | Add a comment/updates thread to `MatterDetailSheet`. |
| M2 | **No priority or type filter** (Wave 3, still open). Only status filter + search. "Mostre tudo urgente" / "todo litígio" is impossible. | Medium | Add priority and type filters next to the status select. |
| M3 | **No due-date urgency signal.** `matters/page.tsx:182` renders "Prazo" as plain text; an overdue matter looks identical to one due next month. The module already has `daysUntilExpiry` for contracts. | Medium | Colour/badge overdue and near-due dates in the table and sheet. |
| M4 | **List default sort is `created_at DESC`, not priority** (Wave 3, still open). The dashboard ranks open matters by priority weight; this list buries urgent items under recent ones. | Low | Default-sort by priority weight, or add sortable headers. |
| M5 | **No board / Kanban view** (Wave 3, still open). A 5-state status is a natural Kanban and the platform already has a Boards module. | Low | Offer a status-grouped board view for triage. |
| M6 | **No status quick-change from the detail sheet** (cross-cutting C2). Moving a matter open→in_progress→resolved requires opening the full edit dialog each time. | Medium | Add a status control directly in `MatterDetailSheet`. |

---

## Screen 4 — Cláusulas / Clauses

**Screenshot:** `39-legal-clauses.png`
**Code:** `clauses/page.tsx`, `clause-detail-sheet.tsx`, `clause-picker.tsx`

### What works
- Search + category filter; card grid is now `lg:grid-cols-3` (Wave 3 width fix).
- Cards show an explicit "Aprovada" (with check icon) or "Rascunho" badge — the Wave 3 ambiguity is gone.
- `ClauseDetailSheet` has a "Copiar texto" clipboard action — the fastest realistic use of the library.
- `ClausePicker` lets a clause be linked into a contract from the contract sheet, and it excludes already-linked clauses (`linkedClauseIds`) — the library is no longer a dead end.

### Findings

| # | Finding | Impact | Recommendation |
|---|---------|--------|----------------|
| L1 | **No clause versioning or approval history** (Wave 3, still open). A clause is just `is_approved` true/false — no record of who approved it, when, or the prior wording. Approved legal language must be auditable. | Medium | Track approver + timestamp; keep prior versions. |
| L2 | **No usage signal on a clause.** Now that clauses link to contracts, a clause card/sheet still shows no "usada em N contratos" — legal cannot tell which library entries matter or retire stale ones. The data exists (`legal_contract_clauses`). | Medium | Show a usage count on the card and list the contracts in the detail sheet. |
| L3 | **`ClausePicker` only links approved-or-any clauses with no guard against draft reuse.** A "Rascunho" clause should arguably not be linkable into an executed contract, or at least warn. | Low | In the picker, badge draft clauses and/or default to approved-only with a toggle. |
| L4 | **Clause body is plain text only** (Wave 3, still open). Real clauses have numbering and sub-clauses; a `Textarea` with `whitespace-pre-wrap` cannot represent that. Acceptable for MVP. | Low | Consider a lightweight rich-text/numbered editor for parity with the leaders. |
| L5 | **No delete from the clause card or detail sheet** (cross-cutting C2). | Low | Add a delete action; warn if the clause is linked to contracts. |
| L6 | **Clause detail sheet shows "Criada em" but not approver or category-change history** (relates to C4). | Low | Surface approver and last-modified once those are tracked (L1). |

---

## Market comparison (updated)

| Capability | ONEmonday Legal (Wave 4) | Ironclad | DocuSign CLM | ContractWorks / LinkSquares |
|---|---|---|---|---|
| Contract register + metadata | Yes | Yes | Yes | Yes |
| Renewal / expiry tracking | Yes (strong, tested) | Yes | Yes | Yes |
| Automated renewal alerts | **Yes (new — in-app + outbox)** | Yes | Yes | Yes |
| Document storage / upload | **Yes (new — 25MB, private bucket)** | Yes | Yes | Yes |
| In-document viewer | **No (opens new tab)** | Yes | Yes | Yes |
| Record detail view | **Yes (new — tabbed sheets)** | Yes | Yes | Yes |
| Clause library reusable in contracts | **Yes (new — link + copy)** | Yes | Yes | Yes (LinkSquares) |
| Approval routing / workflow | **No** (manual status) | Yes | Yes | Partial |
| E-signature | **No** | Yes | Yes | Partial |
| AI extraction of contract data | **No** | Yes (Smart Import) | Yes (Iris) | Yes (LinkSquares) |
| Obligation tracking | **No** | Yes | Yes | Partial |
| Status-change / audit history | **No** | Yes | Yes | Yes |

Wave 4 closed three of the four big Wave 3 gaps (alerts, documents, detail view, clause linking). The remaining differentiators are workflow (approval/e-signature/history) and AI extraction.

---

## Per-sector access

Scoping remains correct: `useContracts`, `useMatters`, `useClauses`, `useContractDocuments`, `useContractClauses`, `useSectorMembers` and the renewal worker all operate per `sector_id`; the worker uses the service-role client deliberately and only for the cron scan. The contract document Storage path is `${sectorId}/${contractId}/...`, keeping sector isolation in the bucket layout. One note carried from Wave 3: the UI still gives no in-page signal of which sector is in scope beyond the global sidebar selector.

---

## Quick wins (low effort, high value)

1. **C3** — Fix `new Date("YYYY-MM-DD")` timezone-shift parsing on contract/matter dates (parse as local).
2. **D2** — Deep-link dashboard renewal-alert rows to the specific contract instead of the bare list.
3. **D3** — Colour the dashboard status-distribution bars by status variant.
4. **M3** — Colour/badge overdue and near-due matter "Prazo" dates.
5. **D5** — Use `EmptyState` for the "Selecione um setor" fallback.
6. **L2** — Show a "usada em N contratos" count on clause cards (data already exists in `legal_contract_clauses`).
7. **M4** — Default-sort the matters list by priority weight (mirror the dashboard).
8. **C2** — Wire the existing `deleteContract` action into a sheet/row action menu.

## Strategic bets

- **K2 / C1** — Contract **approval workflow + status-change history** — the core CLM feature still missing.
- **K1** — In-app **document viewer** (PDF preview pane in the Documentos tab).
- **M1** — **Comment/activity thread** on matters — turns the matter queue into a real workflow.
- **K6 / K7** — **AI metadata extraction** and **obligation tracking** — the Ironclad/DocuSign frontier.

---

## Sources

- [Ironclad AI Overview — Ironclad Support](https://support.ironcladapp.com/hc/en-us/articles/12947738534935-Ironclad-AI-Overview)
- [Contract Data Extraction: Bringing Contracts to Life — Ironclad](https://ironcladapp.com/journal/contract-data/contract-data-extraction)
- [What's New in Ironclad: August 2025 — Ironclad Support](https://support.ironcladapp.com/hc/en-us/articles/33646612620183-What-s-New-in-Ironclad-August-2025)
- [Contract Lifecycle Management Software — Docusign CLM](https://www.docusign.com/products/clm)
- [DocuSign CLM vs Ironclad: Which is the best for Legal Ops — eSignGlobal](https://www.esignglobal.com/blog/docusign-clm-vs-ironclad-legal-ops-comparison)
- [Conga vs. Ironclad vs. DocuSign: Comparison Guide — Conga](https://conga.com/resources/blog/conga-vs-ironclad-vs-docusign)
</content>
</invoke>
</invoke>
