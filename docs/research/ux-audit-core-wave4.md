# UX Audit — Core Module (Wave 4)

**Date:** 2026-05-18
**Auditor:** Senior product designer (UX audit, Wave 4)
**Scope:** Dashboard (`/`), Boards index + sector boards, Board detail / Kanban,
Projects index, **Project detail (new)**, **Analytics (new)**.
**Method:** Screen-by-screen review of the PNGs in
`screenshots/audit-wave4/admin/` (00–07), cross-read against the source under
`apps/web/app/(dashboard)`, `apps/web/components/{boards,projects,analytics,
dashboard}` and `apps/web/hooks`.
**Baseline:** `docs/research/ux-audit-core.md` (Wave 3). This report only
covers items still open or newly introduced; resolved Wave 3 items are noted.

This is an analysis-only deliverable. No application code was modified.

---

## What Wave 3 fixed (verified in code)

A large share of the Wave 3 backlog has shipped:

- **#1 Column-distribution scoping bug** — fixed. `use-dashboard-stats.ts:107-185`
  now fetches only `column_id` and resolves names from a separate scoped
  `board_columns` query with an "Outros" fallback bucket. Screenshot
  `00-dashboard.png` shows the chart fully populated.
- **#2 Priority filter raw `all`** — fixed. `board-filters.tsx:250` renders
  `priorityFilterLabel(...)` so the trigger shows "Todas prioridades".
- **#3 Project detail page** — built (`project-detail.tsx`, route
  `[sector]/projects/[id]/page.tsx`, screenshot `04-project-detail.png`).
- **#4 Group-by + assignee/tag/due-date filters** — built
  (`board-grouping.ts`, `BoardFilterState` now has `assignees/tags/dueDate`).
- **#5 Project tiles enriched** — progress bar + `done/total cards` now on the
  tile (`project-list.tsx:297-314`).
- **#6 Search + sort on indexes** — built for both Boards and Projects.
- **#8 Edit on `⋯` menus** — wired for both (`BoardEditDialog`,
  `ProjectEditDialog`).

Wave 4 therefore focuses on the **new screens** (Project detail, Analytics) and
on Wave 3 items that were **partially** addressed or regressed.

---

## Module summary & overall rating

The Core module has visibly matured. Boards and Projects indexes now have
search/sort, project detail exists with a progress rollup and card↔project
linking, the Kanban has real swimlanes and a four-facet filter bar, and a
dedicated Analytics screen with saved reports is live. The dnd-kit Kanban
remains genuinely solid.

What still holds it back: (1) the **new screens are thin** — Project detail is a
linked-card list with no tasks/members/timeline, Analytics is a KPI strip plus
an empty "Relatórios" zone; (2) **pt-BR diacritics are still inconsistent and
visible in screenshots** — Wave 3 flagged this and it was not fixed; (3) **column
management / WIP enforcement** is still missing; (4) several **interaction
polish** gaps remain (board horizontal clipping, dashboard non-interactivity,
DnD accessibility).

**Overall rating: 7.0 / 10** — up from 6.0. Foundation is strong and the index
screens now feel finished; the two new screens and the diacritic regression are
what keep it from 8.

| Screen | Rating | Headline issue |
| --- | --- | --- |
| Dashboard | 6.5 / 10 | "Distribuicao" heading mis-spelled in screenshot; still no launchpad / drill-downs |
| Boards index | 7.5 / 10 | Tiles still carry no card count / members / updated date |
| Board detail (Kanban) | 7.5 / 10 | WIP still decorative; no column management; rightmost column clipped |
| Projects index | 8 / 10 | Solid; minor (no status grouping/filter) |
| Project detail | 6 / 10 | A linked-card list — no tasks, members, dates editable, or board view |
| Analytics | 6 / 10 | KPI strip + empty reports zone; no default report, no export, generic deltas |

---

## Screen 1 — Dashboard

**Screenshot:** `00-dashboard.png`
**Code:** `app/(dashboard)/page.tsx`, `components/dashboard/{stats-cards,
priority-chart,column-distribution,recent-activity}.tsx`,
`hooks/use-dashboard-stats.ts`.

### What works
- The Wave 3 column-distribution defect is gone — the chart shows 11 / 5 / 1 / 3
  etc. across all columns, consistent with "Cards por Prioridade".
- Five-KPI strip is clean; "Atrasados: 1" renders in red.
- Priority chart has clear percentage labels and per-priority colour.

### Findings

**[High] "Distribuicao por Coluna" heading is mis-spelled — Wave 3 regression.**
`00-dashboard.png` shows the right chart titled **"Distribuicao por Coluna"**
(no `ç`/`ã`). `column-distribution.tsx:24` hard-codes
`Distribuicao por Coluna` in the populated branch, while the *empty* branch at
line 14 correctly says `Distribuição`. Wave 3 finding "[Low] Inconsistent accent
text" called this out by name and it was not fixed. Same class of bug:
`00-dashboard.png` also shows column names "Revisao", "Negociacao", "Concluido"
without diacritics — these come from seed data, but the chart heading is
in-code and should be corrected now.
*Recommendation:* fix line 24 to `Distribuição por Coluna`; grep the module for
`Descricao|Concluido|Critico|Revisao|Negociacao` and correct in-code strings.

**[Medium] Dashboard is still not a launchpad.** Wave 3 finding #9 is still
open. KPI cards ("Total de Cards: 39", "Projetos Ativos: 2") are non-interactive
`div`s (`stats-cards.tsx`), the "Atrasados: 1" count has no drill-down list, and
there is no "Meus cards" widget. Linear and Monday lead their dashboards with
actionable widgets, not static counts
([Linear Insights](https://linear.app/insights),
[Monday Dashboards](https://monday.com/features/dashboards)).
*Recommendation:* link each KPI card to its filtered list; add an "Atrasados"
drill-down and a "Meus cards" widget — both reuse data already loaded.

**[Medium] Column-distribution chart overflows the card with long lists.**
`00-dashboard.png` shows the right card listing 13+ columns (A fazer … Ganho …)
and the last rows are clipped at the bottom viewport edge. `ColumnDistribution`
renders every column with no cap, no scroll container and no "ver mais". When a
sector aggregates many boards this list grows unbounded.
*Recommendation:* cap at the top 6–8 columns by count, fold the rest into the
existing "Outros" bucket, or give the list a `max-h` + scroll.

**[Low] Two charts + a feed is still the whole dashboard.** No timeframe
selector beyond the fixed week, no team-utilization widget. Lower priority than
the launchpad fix.

### Per-sector access
Now consistent — the column-chart scoping fix means both charts agree for
sector managers. No new per-sector defect observed.

---

## Screen 2 — Boards index

**Screenshots:** `01-boards-sector.png`, `05-boards-index.png` (identical)
**Code:** `components/boards/board-list.tsx`, `board-sort.ts`.

### What works
- Search input + sort select ("Atualizados recentemente / Nome (A-Z) / Criados
  recentemente") are present and well-labelled (`board-list.tsx:134-160`).
- "Multi-setor" visibility badge now renders on cross-sector boards — visible on
  "Projeto Plataforma v2" in `01-boards-sector.png` (`VISIBILITY_LABELS`).
- Empty-search state has its own copy ("Nenhum board corresponde à busca").
- Whole `CardHeader` is wrapped in a `Link` via `className="contents"`.

### Findings

**[Medium] Board tiles still carry no operational metadata.** Wave 3 finding #5
was only *partly* delivered: projects got a progress bar, but board tiles still
show only name + description + an optional visibility badge. There is no card
count, no column/progress summary, no member avatars, no "atualizado há X".
Monday and Trello board tiles surface membership and activity at a glance
([Monday Kanban guide](https://toolstackpm.com/tools/monday-com/features/kanban-boards)).
`01-boards-sector.png` — six near-identical white rectangles — is the result.
*Recommendation:* add a tile footer: card count, member avatars, relative
`updated_at` ("atualizado há 2 dias"). `BoardSummary` already carries
`updated_at`.

**[Medium] Sort default label is opaque.** `05-boards-index.png` shows the sort
trigger reading literally **"recent"** — the raw `BoardSortKey` value, not the
"Atualizados recentemente" label. `board-list.tsx:150` uses a bare
`<SelectValue />` with no children; Base UI then prints the raw value. This is
the *exact same class* of bug Wave 3 fixed for the priority filter (#2) — the
fix (`priorityFilterLabel`) was not applied here. The Projects index has the
identical bug (`project-list.tsx:172`, screenshot `06-projects-index.png` shows
"recent").
*Recommendation:* render the matching label inside `SelectValue`, e.g.
`<SelectValue>{SORT_OPTIONS.find(o => o.value === sort)?.label}</SelectValue>`.

**[Low] No grouping/filter by visibility.** Cross-sector boards intermix with
own boards; only a badge distinguishes them. A "Multi-setor" filter or a
section split would help once the list grows.

**[Low] No empty-state CTA.** The "Nenhum board" empty state (`board-list.tsx:124`)
has no inline "Criar board" button — the user must find "Novo Board" in the
header. Competitors put the primary action in the empty state.

### Per-sector access
Correct — `useBoards` filters via `board_sectors.sector_id`. No change since
Wave 3.

---

## Screen 3 — Board detail / Kanban

**Screenshot:** `02-board-detail.png` (Sprint Q3 2026)
**Code:** `components/boards/{board-view,board-column,board-card,board-filters,
board-grouping,board-card-detail}.tsx`.

### What works
- Priority filter now shows "Todas prioridades" — Wave 3 #2 fixed.
- Real swimlanes: "Agrupar: Coluna/Responsável/Prioridade" via
  `buildSwimlanes` (`board-grouping.ts`), with empty lanes dropped and reorder
  correctly disabled while grouped (`board-view.tsx:67`).
- Four-facet filter bar: search, priority, due-date bucket, and an
  assignee/tag multi-select popover with an active-count badge
  (`board-filters.tsx`). This closes Wave 3 #4 — matches Monday's "Divide by" +
  board filters ([Monday Kanban View](https://support.monday.com/hc/en-us/articles/360000661379-The-Kanban-View)).
- dnd-kit Kanban with optimistic moves + conflict-checked `reorderCards` RPC.

### Findings

**[High] WIP limits are still decorative — Wave 3 #7 unaddressed.**
`board-column.tsx:46` computes `isOverWipLimit` and shows "max N" in red, but
neither `handleAddCard` (line 49) nor `handleDragEnd` in `board-view.tsx:107`
checks it — a column can be filled past its limit with no block and no warning.
Every Kanban competitor either hard-blocks or visibly warns on WIP breach
([Asana Kanban / WIP](https://asana.com/resources/what-is-kanban)).
*Recommendation:* block create/move into an over-limit column (toast: "Coluna
no limite de N cards") or at minimum show a confirm. The header already turns
red — wire the same condition into the two mutation paths.

**[High] No column management UI — Wave 3 #7 unaddressed.** Columns can only be
created by the seed / `createBoard` default. There is no add / rename /
recolour / reorder / set-WIP / delete-column interaction anywhere on the board.
Monday lets the board owner add and configure columns directly
([Monday Kanban guide](https://toolstackpm.com/tools/monday-com/features/kanban-boards)).
*Recommendation:* add a column `⋯` menu (rename, colour, WIP, delete) and a
"+ Adicionar coluna" affordance at the right edge of the lane.

**[Medium] Rightmost column is clipped with no scroll affordance.**
`02-board-detail.png` shows "Concluido" (4th column) cut off at the right edge —
its cards "Setup inicial do projeto Next.js" and "Modelagem do banco de dados"
are truncated mid-card. `board-view.tsx:299` uses `flex gap-4 overflow-x-auto`
with no edge fade, no scroll shadow and no column-count indicator, so a user
cannot tell content continues. This is the same Wave 3 finding, still open.
*Recommendation:* add a right-edge gradient/shadow when scrollable, and consider
collapsible columns.

**[Medium] Card-detail date format still diverges — Wave 3 finding open.**
`board-card-detail.tsx:514` renders `new Date(card.due_date).toLocaleDateString
("pt-BR")` → "14/06/2026", while `board-card.tsx:92` uses `formatDateShort`
("14 de jun.") and `board-list-view.tsx:187` uses `formatDateFull`. Three
formats for one field across one feature; Wave 3 #11 flagged this and it remains.
*Recommendation:* replace line 514 with the shared `formatDateFull` from
`@/lib/constants`.

**[Medium] "Adicionar card" still captures only a title.** `board-column.tsx:53`
hard-codes `priority: "medium"` with no assignee/due-date/description — the user
must reopen the card to set anything. Wave 3 #13, still open.
*Recommendation:* offer an expanded quick-add (priority + due date) or open the
detail Sheet immediately after creation.

**[Medium] DnD remains effectively keyboard/SR-inaccessible.** `KeyboardSensor`
is wired in `board-view.tsx:87`, but `board-card.tsx` is a plain `div` with the
sortable listeners spread directly — no `role`, no `aria-roledescription`, no
"press space to pick up" instructions, no visible focus ring (the `cn` has no
`focus-visible:` class). Atlassian's own guidance requires accessible controls
and SR announcements as an alternative to pointer drag
([Atlassian DnD accessibility](https://atlassian.design/components/pragmatic-drag-and-drop/accessibility-guidelines)).
*Recommendation:* add `@dnd-kit` `announcements`, an `aria-roledescription` on
the card, and a `focus-visible` ring.

**[Low] Swimlane header is low-contrast and unlabelled for "Coluna" mode.** In
grouped modes (`board-view.tsx:294`) the lane label is
`text-sm text-muted-foreground` — fine — but there is no count per lane and no
collapse control. Monday's swimlanes are collapsible with counts.

**[Low] No prev/next navigation in the card detail Sheet** — Wave 3 #12, still
open. Reviewing a column means open → close → open.

### Per-sector access
Board page resolves sector server-side with a clean fallback. No new defect.

---

## Screen 4 — Projects index

**Screenshots:** `03-projects-sector.png`, `06-projects-index.png` (identical)
**Code:** `components/projects/project-list.tsx`, `project-sort.ts`.

### What works
- Tiles now show a real progress bar + `done/total cards` and percentage —
  "1/3 cards · 33%" on "Reestruturacao de Suporte" (`project-list.tsx:297-314`).
  Closes Wave 3 #3 (progress) and part of #5.
- Search + sort ("Mais recentes / Nome (A-Z) / Progresso").
- `formatDate` now includes the **year** (`project-list.tsx:64-71`) — Wave 3's
  "date drops the year" finding is fixed; `03-projects-sector.png` shows
  "30 de abr. de 2026 - 29 de set. de 2026".
- "Atrasado" badge appears when `target_date` is past and status is active
  (`isProjectOverdue`).
- Whole tile (header + content) navigates to the detail page.

### Findings

**[Medium] Sort trigger shows raw "recent".** Same `<SelectValue />` bug as the
Boards index — `06-projects-index.png` shows the trigger reading **"recent"**
instead of "Mais recentes" (`project-list.tsx:172`). Fix alongside the Boards
index.

**[Low] No status filter / grouping.** With only two projects today it is fine,
but there is no way to filter Ativo vs. Arquivado or group by status — Wave 3
#6 partial. As archived projects accumulate they will clutter the active list.
*Recommendation:* add a status filter select (or hide `archived` by default
with a toggle).

**[Low] Empty-state has no inline CTA** — same as the Boards index.

### Per-sector access
Correct — `useProjects` filters via `project_sectors.sector_id`; cross-sector
projects appear in both sectors.

---

## Screen 5 — Project detail (NEW)

**Screenshot:** `04-project-detail.png` (Plataforma ONEmonday v2)
**Code:** `components/projects/project-detail.tsx`, `project-link-card-dialog.tsx`,
`hooks/use-project-detail.ts`, route `[sector]/projects/[id]/page.tsx`.

### What works
- The Wave 3 "dead end" is gone — a real detail page with a back link,
  status badge, date range, "Atrasado" indicator and a progress card.
- Progress card has a proper `role="progressbar"` with `aria-valuenow/min/max`
  (`project-detail.tsx:191-203`) — good accessibility.
- "Vincular card" opens a `Command`-based searchable picker scoped to the
  project's sectors and excluding already-linked cards (`project-link-card-dialog.tsx`).
- Each linked-card row shows priority dot, column, due date, an "Abrir board"
  link and a confirm-gated unlink — clean.
- Empty state ("Nenhum card vinculado") with helper copy.

### Findings

**[High] A project is still a linked-card list — no tasks, members, or
activity.** Asana/Linear project pages carry a task list *with editable status*,
**milestones**, a **members** roster, a **status update / summary** section, and
multiple views (List / Board / Timeline)
([Asana milestones](https://asana.com/inside-asana/new-milestones-visualize-project-progress),
[Linear Insights](https://linear.app/insights)). ONEmonday's project detail
shows a flat read-only list of 4 cards and a progress bar. There is no project
board/timeline view, no milestone concept, no member avatars, and the linked
cards cannot be acted on in place (only opened in their board or unlinked).
*Recommendation:* phase it — (1) add a members strip and a project-status note;
(2) add a Board/Timeline tab over the linked cards reusing `BoardListView` /
`BoardTimelineView`; (3) consider milestones.

**[Medium] No way to edit the project from its own page.** The header has only
"Vincular card" — to change name, status, or dates the user must go back to the
index and use the tile `⋯` menu. A detail page is where users expect to edit.
`04-project-detail.png` header has empty space beside the title.
*Recommendation:* add an "Editar" button (reuse `ProjectEditDialog`) and/or a
`⋯` menu in the header.

**[Medium] Progress only counts cards, ignoring card weight or status nuance.**
`computeProjectProgress` is `done/total` of linked cards. With 4 cards, "0 de 4"
= 0% even though three are "Em andamento" (`04-project-detail.png`). A
done/in-progress/todo breakdown (a segmented bar) communicates far more than a
single 0% bar that looks like a stalled project.
*Recommendation:* render a segmented progress bar (todo / doing / done) or at
least show the in-progress count.

**[Medium] Linked-card rows show only column + due date — no assignee, no
priority label.** The priority dot at `project-detail.tsx:264-274` has a `title`
tooltip but no visible label, and there is no assignee avatar even though the
board card carries assignees. A reviewer scanning the project cannot see who
owns what.
*Recommendation:* add assignee avatars and a priority label/badge to each row.

**[Low] "Cards vinculados" count badge duplicates the progress card.** The
header says "Cards vinculados 4" and the progress card says "0 de 4 cards" —
minor redundancy, acceptable.

**[Low] Date range uses an arrow glyph inconsistently.** Header shows
"30 de abr. de 2026 → 29 de set. de 2026" (Unicode arrow); the index tile uses
"-" (`project-list.tsx:243`). Pick one separator module-wide.

### Per-sector access
`useProjectDetail` and the link dialog scope cards to `project.sectorIds`, and
the server action re-checks — correct. Error state ("Projeto não encontrado")
is clean.

---

## Screen 6 — Analytics (NEW)

**Screenshot:** `07-analytics.png`
**Code:** `app/(dashboard)/analytics/page.tsx`,
`components/analytics/{kpi-card,date-range-filter,report-card,report-chart,
report-form-dialog}.tsx`.

### What works
- An 8-KPI overview (Cards Concluídos, Valor de Negócios Ganhos, Tickets
  Resolvidos + 5 open-state KPIs) with a single global date-range control
  re-scoping every query (`date-range-filter.tsx`).
- "Valor de Negócios Ganhos" formats as "R$ 32.000,00" — correct pt-BR currency.
- KPI cards support a period-over-period delta badge with favourable/unfavourable
  colour (`kpi-card.tsx`).
- Saved-report cards render a trend chart with edit/delete; empty state has
  helper copy and a "Novo Relatório" CTA.

### Findings

**[High] The delta badges are uninformative — "↑ — vs. anterior".**
`07-analytics.png` shows all three top KPIs with a delta reading literally
**"↑ — vs. anterior"** — an up-arrow, an em-dash where the percentage should be,
then "vs. anterior". `formatDeltaPercent` is returning a dash (likely because
`previous` is `0`, making the percent change undefined/infinite). The result is
a badge that signals "up" but shows no magnitude — worse than no badge, because
it implies data that isn't there.
*Recommendation:* when `previous === 0` and `current > 0`, show "novo" or
"+100%" explicitly and pick a neutral colour; never render a bare dash next to a
direction arrow. Verify `computeDelta` / `formatDeltaPercent` in
`lib/analytics/kpi.ts`.

**[High] "Relatórios Salvos" ships empty with no starter content.**
`07-analytics.png` shows a large empty dashed box: "Nenhum relatório salvo. Crie
o primeiro…". The entire analytical value of the screen is gated behind the user
manually building a report. Linear Insights and Monday Dashboards ship default
widgets so the screen is useful on first load
([Linear Insights](https://linear.app/insights),
[Monday Dashboards](https://monday.com/features/dashboards)).
*Recommendation:* seed 1–2 default reports per sector (e.g. "Cards concluídos
por semana", "Tickets resolvidos"), or render a couple of built-in trend charts
above the saved-reports zone so the page is never blank.

**[Medium] No export / share on Analytics.** There is no CSV/PNG export of KPIs
or report charts and no shareable link — standard in Monday advanced reporting
([Monday advanced reporting](https://support.monday.com/hc/en-us/articles/360013939400-Advanced-reporting-with-monday-com)).
The board view already has a card mentioning a CSV-export endpoint
("Criar endpoint de exportacao CSV dos boards" in `02-board-detail.png`), so the
intent exists.
*Recommendation:* add a per-report "Exportar" action (CSV at minimum).

**[Medium] KPI grid is visually unbalanced.** `07-analytics.png` shows a 3-card
row of large cards (with deltas) above a 5-card row of smaller cards. The two
rows use different `grid-cols` (`lg:grid-cols-3` vs `lg:grid-cols-5`,
`analytics/page.tsx:81/108`) so card widths jump between rows and the eye has no
consistent column rhythm. The split between "trend KPIs" and "snapshot KPIs" is
also not labelled.
*Recommendation:* unify to one responsive grid, or add small section labels
("Tendência" / "Agora") so the two rows read as intentional groups.

**[Medium] The date-range control affects KPIs but not saved reports.** Each
`ReportCard` has its own `report.date_range_days` (`report-card.tsx:36`), so the
top-right "30d" selector silently does not apply to the report charts below.
Two date scopes on one page with no visual cue is confusing.
*Recommendation:* either make the global range also drive reports, or move the
range control into the KPI section header so its scope is obvious.

**[Low] "Colaboradores: 11" KPI is a headcount, not an analytic.** It sits in
the "snapshot" row but is unrelated to the date range; consider a tooltip
clarifying it is current active headcount.

**[Low] No loading distinction between "no data" and "error".** The fallback
"Não foi possível carregar as métricas deste setor" (`analytics/page.tsx:142`)
fires for both an error and a genuinely empty sector. Distinguish them.

### Per-sector access
`useAnalyticsOverview` / `useReports` are scoped by `sectorId`; the page renders
a clean "Selecione um setor" guard. No defect observed.

---

## Cross-cutting observations

- **`<SelectValue />` with no children prints raw enum values.** Wave 3 fixed
  this for the board priority filter but the *same bug* now appears on the
  Boards sort (`board-list.tsx:150`), Projects sort (`project-list.tsx:172`) —
  both visibly showing "recent". The Analytics date filter and board due-date
  filter use `placeholder` so they happen to look fine. Establish a rule: every
  `SelectValue` either has children rendering the active label, or a
  `placeholder` — never bare.
- **pt-BR diacritics still inconsistent and now visible in a screenshot.**
  Wave 3 flagged it; `column-distribution.tsx:24` ("Distribuicao"),
  `board-view.tsx:274-278` ("esta desativado", "esta agrupado"),
  `board-column.tsx:130` ("Titulo do card"), `board-filters.tsx:235`
  ("por titulo") all still drop accents. Correct centrally.
- **Date formatting still fragmented** — `formatDateShort`, `formatDateFull`,
  raw `toLocaleDateString("pt-BR")` (`board-card-detail.tsx:514`) and the
  `project-list.tsx` inline `formatDate` coexist. Consolidate.
- **The two new screens are read-mostly.** Project detail can't edit the
  project; Analytics can't export. Both screens stop one interaction short of
  being complete.

---

## Prioritized backlog (by value / effort)

| # | Item | Screen | Impact | Effort | Notes |
| --- | --- | --- | --- | --- | --- |
| 1 | Fix `<SelectValue />` showing raw "recent" on Boards & Projects sort | Indexes | Medium | S | Same fix Wave 3 applied to priority filter; visible in 2 screenshots |
| 2 | Fix Analytics delta badge rendering "↑ — vs. anterior" (handle `previous === 0`) | Analytics | High | S | Implies data that isn't there |
| 3 | Fix "Distribuicao" heading + sweep in-code pt-BR diacritics | Dashboard / All | Medium | S | Wave 3 item unaddressed; visible in screenshot |
| 4 | Enforce WIP limits on card create + move (block or warn) | Board detail | High | S | "max N" is purely decorative today |
| 5 | Seed/ship default Analytics reports so the page is never blank | Analytics | High | M | Whole screen is currently gated behind manual setup |
| 6 | Project detail: add Editar action + members strip + status note | Project detail | High | M | Detail page can't edit the project; thin vs Asana/Linear |
| 7 | Column management UI (add/rename/colour/reorder/WIP) | Board detail | High | M | Wave 3 #7 still fully open |
| 8 | Project detail: Board/Timeline tab over linked cards (reuse existing views) | Project detail | Medium | M | Turns the list into a real project workspace |
| 9 | Enrich board tiles (card count, members, updated-há-X) | Boards index | Medium | M | Wave 3 #5 delivered for projects only |
| 10 | Right-edge scroll affordance on the Kanban; fix clipped 4th column | Board detail | Medium | S | Column visibly cut off in `02-board-detail.png` |
| 11 | Make dashboard a launchpad (clickable KPIs, "Atrasados" drill-down, "Meus cards") | Dashboard | Medium | M | Wave 3 #9 still open |
| 12 | Cap/scroll the column-distribution list so it stops overflowing the card | Dashboard | Medium | S | Bottom rows clipped in `00-dashboard.png` |
| 13 | Segmented project progress (todo/doing/done) + assignees on linked rows | Project detail | Medium | S | 0% bar misrepresents a project with 3 in-progress cards |
| 14 | DnD ARIA announcements + focus ring on cards; consolidate date formats | Board detail / All | Low | M | Accessibility + Wave 3 #11/#12 polish |
| 15 | Per-report export (CSV) on Analytics; unify KPI grid columns | Analytics | Low | M | Standard in Monday reporting |

**Recommended first wave:** #1, #2, #3, #4 — all Small, three are defects
visible directly in the Wave 4 screenshots, and #3 closes a Wave 3 regression.
Then #5, #6, #7 as the headline value items for the two new screens.

---

## Quick wins (low-effort, high-value)

1. **Fix the sort `<SelectValue />`** on Boards (`board-list.tsx:150`) and
   Projects (`project-list.tsx:172`) — render the active label; no more "recent".
2. **Fix the Analytics delta badge** — when `previous === 0`, show "novo"
   instead of "↑ — vs. anterior" (`lib/analytics/kpi.ts` + `kpi-card.tsx`).
3. **Correct "Distribuicao por Coluna"** → "Distribuição por Coluna"
   (`column-distribution.tsx:24`) and sweep the other in-code diacritic drops.
4. **Enforce WIP on create/move** — reuse the existing `isOverWipLimit` from
   `board-column.tsx:46` in `handleAddCard` and `handleDragEnd`.
5. **Cap the column-distribution list** at the top 6–8 columns (fold rest into
   the existing "Outros" bucket) so it stops clipping off-screen.
6. **Add an "Editar" button to the Project detail header** — `ProjectEditDialog`
   already exists, just needs a trigger beside "Vincular card".
7. **Replace the raw date** in `board-card-detail.tsx:514` with `formatDateFull`.
8. **Add inline "Criar" CTAs** to the "Nenhum board" / "Nenhum projeto" empty
   states.

---

## Sources

- [Monday.com — The Kanban View](https://support.monday.com/hc/en-us/articles/360000661379-The-Kanban-View)
- [Monday.com Kanban Features & Board Setup Guide (ToolStack)](https://toolstackpm.com/tools/monday-com/features/kanban-boards)
- [Monday.com — Dashboards & Reporting](https://monday.com/features/dashboards)
- [Monday.com — Advanced reporting](https://support.monday.com/hc/en-us/articles/360013939400-Advanced-reporting-with-monday-com)
- [Asana — Kanban, WIP limits & best practices](https://asana.com/resources/what-is-kanban)
- [Asana — Milestones visualize project progress](https://asana.com/inside-asana/new-milestones-visualize-project-progress)
- [Linear — Insights](https://linear.app/insights)
- [Atlassian Design — Pragmatic drag-and-drop accessibility guidelines](https://atlassian.design/components/pragmatic-drag-and-drop/accessibility-guidelines)
- Internal baseline: `docs/research/ux-audit-core.md` (Wave 3)
