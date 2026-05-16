# UX Audit — Core Module (Dashboard, Boards, Cards, Projects)

**Date:** 2026-05-15
**Auditor:** Senior product designer (UX audit per `.claude/agents/ux-auditor.md`)
**Scope:** Dashboard (`/`), Boards index + sector boards (`/[sector]/boards`), Board
detail / Kanban (`/[sector]/boards/[boardId]`), Projects (`/[sector]/projects`).
**Method:** Screen-by-screen review of the captured PNGs under
`screenshots/audit/admin/` and the four `gerente-*` sector folders, cross-read
against the source in `apps/web/app/(dashboard)`, `components/{boards,projects,
dashboard,shared}` and `hooks/use-*`.

This is an analysis-only deliverable. No application code was modified.

---

## Module summary & overall rating

The Core module is a competent MVP skeleton: a real dnd-kit Kanban with
optimistic moves and a version-checked reorder RPC, three board views
(Kanban / List / Timeline), a feature-rich card detail Sheet (comments,
checklists, attachments, activity, cross-references, inline edit), and a
dashboard with stats, two charts and a recent-activity feed. RBAC is wired
end-to-end (`PermissionGate` + server actions + RLS).

It is, however, noticeably behind the products it competes with on three
fronts: **(1) data integrity / scoping bugs** that make manager dashboards look
broken, **(2) shallow list/index screens** — Boards and Projects index pages
are flat card grids with no search, filter, sort, grouping or detail page, and
**(3) missing table-stakes Kanban interactions** — no group-by/swimlanes, no
assignee or due-date filter, no column management UI, decorative WIP limits.

**Overall rating: 6.0 / 10** — solid foundation, ships, but several screens feel
unfinished and at least three defects are visible directly in the screenshots.

| Screen | Rating | Headline issue |
| --- | --- | --- |
| Dashboard | 6 / 10 | "Distribuição por Coluna" empty for every sector manager (scoping bug) |
| Boards index | 5 / 10 | Flat grid; no search/sort/meta; no board metadata on cards |
| Board detail (Kanban) | 6.5 / 10 | Priority filter shows raw value `all`; no group-by, no assignee filter |
| Projects index | 4.5 / 10 | Cards are dead ends — no project detail page exists at all |

---

## Screen 1 — Dashboard

**Screenshots:** `admin/00-dashboard.png`, `gerente-dev/00-dashboard.png`,
`gerente-rh/00-dashboard.png`.
**Code:** `app/(dashboard)/page.tsx`, `components/dashboard/{stats-cards,
priority-chart,column-distribution,recent-activity}.tsx`,
`hooks/use-dashboard-stats.ts`.

### What works
- Clean five-KPI strip; "Atrasados" turns red only when `> 0` (`stats-cards.tsx`
  `colorFn`) — good conditional emphasis.
- Priority and column charts share a consistent horizontal-bar language with
  percentage labels and per-priority colour coding.
- Recent-activity feed unifies cards, tickets and deals into one chronological
  list with type badges and pt-BR currency for deal values
  (`Intl.NumberFormat('pt-BR', { currency: 'BRL' })`).
- Skeleton loading state matches the real layout (`DashboardSkeleton`).

### Findings

**[High] "Distribuição por Coluna" is empty for every sector manager.**
In `gerente-dev/00-dashboard.png` and `gerente-rh/00-dashboard.png` the right
chart shows *"Nenhum card encontrado"* while the left "Cards por Prioridade"
chart on the *same screen* reports 39 / 8 cards. Root cause is in
`use-dashboard-stats.ts`: the `cardsByColumn` query joins
`board_columns!inner(name, color)`, while `cardsByPriority` reads `cards.priority`
directly. The `!inner` join is filtered out by RLS when the manager cannot read
the joined `board_columns` rows (boards owned/visible outside their sector), so
the column chart collapses to zero even though the cards exist. The dashboard
looks broken to exactly the users it is built for.
*Recommendation:* fetch `column_id` on the card row and resolve column
name/colour from a separate sector-scoped `board_columns` query (or a SECURITY
DEFINER RPC), so the two charts are always consistent. This is the single most
damaging defect in the module.

**[High] Two charts and a feed are the whole dashboard — no widget for
"my work" or deadlines.** Every comparison product (Trello Dashboard view,
Linear, Monday) leads with *team utilization* and *upcoming milestones / overdue
tasks* widgets. ONEmonday surfaces an "Atrasados" count but no list of *which*
cards are overdue and no "assigned to me" view, so a manager cannot act on the
number. *Recommendation:* add an "Atrasados" drill-down list and a "Meus cards"
widget; both reuse data already loaded.

**[Medium] KPI cards and the recent-activity rows are not clickable.** "Projetos
Ativos: 2" / "Total de Cards: 39" are dead numbers; a recent-activity row
(`Onboarding Ana Costa…`) does not open the card. A dashboard's job is to be a
launchpad. *Recommendation:* link KPI cards to the corresponding filtered list
and make activity rows open the card detail Sheet.

**[Medium] "Recent activity" is recency, not activity.** `recent-activity.tsx`
queries `cards/support_tickets/crm_deals` ordered by `created_at` — it shows the
newest *created* records, not what *changed*. A card-level `card_activity_log`
table is already used inside the card detail. In `gerente-dev` all six rows are
stamped `15 de mai., 16:16` (seed time), which exposes the limitation.
*Recommendation:* rename to "Itens recentes", or source from the activity log
for true recency.

**[Low] Header is thin.** The page header is just *"Dashboard / Desenvolvimento"*.
No date range, no refresh, no period selector — competitors put a timeframe
control here ("this week / month"). The KPIs already say "na Semana" but the
week is fixed and uneditable.

**[Low] Inconsistent accent text.** "Distribuição"/"Distribuicao" and
"Concluídos"/"Concluido" appear with and without diacritics across the module
(`column-distribution.tsx` heading lacks the ç/ã that `stats-cards.tsx` uses).
Standardise on correct pt-BR spelling everywhere.

### Per-sector access
Correct in spirit — RH sees 8 cards, Dev sees 39, scoped via `sector_id`. But
the scoping is *inconsistent across widgets on the same page* (see the High
finding): priority chart is sector-scoped and works; column chart is
sector-scoped *and* RLS-joined and silently empties. Fix makes the scoped view
trustworthy.

---

## Screen 2 — Boards index

**Screenshots:** `admin/01-boards-sector.png`, `admin/04-boards-index.png`
(identical render), `gerente-suporte/01-boards.png` (empty state).
**Code:** `components/boards/board-list.tsx`, `hooks/use-boards.ts`,
`components/boards/board-create-dialog.tsx`.

### What works
- Responsive 3-column card grid; hover border feedback.
- Empty state is clear and on-brand (`gerente-suporte/01-boards.png`: icon +
  "Nenhum board" + helper copy).
- Delete is gated behind `PermissionGate` and a hover-revealed `⋯` menu — tidy.
- Create dialog has Zod validation with inline field errors.

### Findings

**[High] Board cards carry zero metadata.** Each card shows only name +
description. There is no card count, no column/progress summary, no member
avatars, no "last updated", no visibility badge — all of which exist in the data
model (`BoardSummary` already has `visibility`, `is_default`, `updated_at`).
Monday and Trello board tiles show membership and activity at a glance.
*Recommendation:* add a footer row to each tile: card count, member avatars,
"atualizado há X" relative date, and a badge for default / cross-sector boards
(e.g. "Projeto Plataforma v2" is described as cross-sector but looks identical
to a normal board).

**[Medium] No search, sort, or filter on the index.** Seven boards already
appear (`01-boards-sector.png`); this list will grow. There is no way to find or
order boards. *Recommendation:* add a search input and a sort control
(name / recent / created). Low effort, high daily value.

**[Medium] No grouping of cross-sector vs. own boards.** "Tickets de Suporte",
"Pipeline Comercial" and "Recrutamento Engenharia" all surface inside the
Desenvolvimento sector with no visual signal that they belong elsewhere. A
manager cannot tell their boards from shared ones. *Recommendation:* group or
badge by visibility / owning sector.

**[Medium] Create dialog hard-codes single-sector.** `board-create-dialog.tsx`
overrides `sectorIds` to `[currentSector.id]` and exposes no visibility control,
yet the schema and `Card`s reference cross-sector boards. Users cannot create
the very boards the product shows. *Recommendation:* expose a visibility select
(sector / cross-sector / private) and, for cross-sector, a multi-sector picker.

**[Low] Whole card is not the click target.** Only the `CardTitle`/
`CardDescription` are wrapped in the `Link`; the padding and lower card area are
dead zones. Make the entire tile clickable (keep the `⋯` menu as a
`stopPropagation` exception).

**[Low] No board edit.** The `⋯` menu offers only "Excluir"; `useUpdateBoard`
exists but is unreachable from the UI — name/description cannot be changed after
creation. Add a "Renomear / Editar" item.

### Per-sector access
Correct: `useBoards` filters via `board_sectors.sector_id`; the Suporte manager
correctly sees an empty state. Behaviour is consistent across the four
`gerente-*` captures.

---

## Screen 3 — Board detail / Kanban

**Screenshot:** `admin/02-board-detail.png` (Sprint Q3 2026).
**Code:** `components/boards/{board-view,board-column,board-card,board-filters,
board-card-detail,board-list-view,board-timeline-view,card-edit-dialog}.tsx`,
`hooks/{use-board-data,use-card-detail}.ts`.

### What works
- Real Kanban: dnd-kit with `PointerSensor` (5px activation) + `KeyboardSensor`,
  `closestCorners` collision, a rotated `DragOverlay`, optimistic
  `queryClient.setQueryData`, and a transactional `reorderCards` RPC with an
  `expectedBoardUpdatedAt` conflict check that toasts on `conflict`. This is
  genuinely solid and ahead of a typical MVP.
- Three views (Kanban / Lista / Timeline) from one filtered dataset; the List
  view has six sortable columns; the Timeline view buckets cards into week
  columns with a "today" highlight and a priority legend.
- WIP limit is *displayed* per column ("max N", turns red when exceeded —
  `board-column.tsx` `isOverWipLimit`).
- Card detail Sheet is rich: priority/column/due-date header, description,
  assignees, tags editor, cross-references, and tabs for comments / checklists
  (with progress bar) / attachments (signed-URL download) / activity log. Inline
  edit (`CardEditDialog`) and Escalate are present.
- Priority is encoded as a coloured left border on the card (`PRIORITY_BORDER_
  COLORS`) — fast scannability, Linear-style.
- Reorder is correctly disabled while a filter is active, with an explanatory
  note — a thoughtful guard against position corruption.

### Findings

**[High] The priority filter shows the raw value `all` instead of a label.**
In `02-board-detail.png` the select top-right of the board reads literally
**"all"**. `board-filters.tsx` renders `<SelectValue />` with no `children`/
`render` and no placeholder; Base UI's `Select.Value` then prints the raw value
string (`"all"`), not the matching option label ("Todas prioridades"). It is the
first thing a user sees on the board and it looks broken.
*Recommendation:* render the label for the current value (map `value → label`)
or supply `SelectValue` content.

**[High] No group-by / swimlanes.** Monday's Kanban "Divide by" lets users split
the board by group, status, assignee or connected board; Trello has list-based
swimlanes. ONEmonday's Kanban is fixed to one column-per-status layout with no
way to slice by assignee or sector. For a cross-sector board this is a real
limitation. *Recommendation:* add a "Agrupar por" control (assignee / priority /
none) rendering horizontal swimlanes.
([Monday Kanban view](https://support.monday.com/hc/en-us/articles/360000661379-The-Kanban-View))

**[High] Filter bar covers only search + priority.** `BoardFilterState` is just
`{ search, priority }`. There is no filter by assignee, tag, due date or column —
all of which exist on the card and all of which Monday's board filters expose.
The `core-feature-gaps.md` backlog already flags assignee filtering as deferred.
*Recommendation:* extend `BoardFilters` with assignee and tag multi-selects and a
due-date range; the List view already sorts on these fields so the data is ready.
([Monday Board Filters](https://support.monday.com/hc/en-us/articles/360003624660-The-Board-Filters))

**[Medium] No column management UI.** Columns (`A fazer`, `Em andamento`, …) can
only be created by the seed/`createBoard` default. There is no add / rename /
recolour / reorder / set-WIP / delete-column interaction — every competitor lets
the board owner manage columns. WIP limits are display-only: `board-column.tsx`
shows "max N" and `handleAddCard` / `handleDragEnd` never check it, so the limit
is decorative (also noted in `core-feature-gaps.md` item 4).
*Recommendation:* add a column `⋯` menu (rename, colour, WIP, delete) and a
"+ Adicionar coluna" affordance; enforce WIP on create + move.

**[Medium] "Adicionar card" only captures a title.** `board-column.tsx`'s inline
add creates a card with hard-coded `priority: "medium"` and no assignee, due date
or description — the user must open the card and edit it afterwards. Competitors
allow a richer quick-add or at least a "+ details" expansion.
*Recommendation:* offer an optional expanded quick-add (priority + due date), or
open the detail Sheet straight after creation.

**[Medium] Horizontal scroll has no affordance and columns can be lost.** With
four columns the "Concluído" column is already clipped at the right edge in
`02-board-detail.png`. There is no scroll shadow, no column-count indicator and
no horizontal-scrollbar styling. *Recommendation:* add edge fade/shadow and
consider a collapsible-column control.

**[Medium] Card-detail header date format is inconsistent with the card.**
`board-card.tsx` uses `formatDateShort` ("14 de jun."), but
`board-card-detail.tsx` renders `new Date(card.due_date).toLocaleDateString
("pt-BR")` → "14/06/2026". The List view uses `formatDatefull`. Three date
formats for the same field across one feature. *Recommendation:* one shared
formatter.

**[Medium] Drag-and-drop is unreachable for keyboard users in practice.** A
`KeyboardSensor` is wired, but the card is also a plain `onClick` target and the
`div` has no `role`/`aria` for a draggable, and there is no visible focus or
"press space to pick up" hint. Effective DnD accessibility needs an
`aria-roledescription` and screen-reader instructions. *Recommendation:* add DnD
ARIA announcements and a visible focus ring on cards.

**[Low] Card detail Sheet has no quick navigation.** Opening a card replaces
focus entirely; there is no prev/next-card arrow and no permalink, so reviewing
a column means open → close → open repeatedly. Linear and Asana provide j/k or
arrow navigation between items. *Recommendation:* add prev/next within the
current (filtered) column order.

**[Low] Empty columns give no guidance, and the board has no board-level
empty state.** A brand-new board drops the user onto four empty columns with
only the small "+ Adicionar card" ghost button.

**[Low] Assignee avatars are initials-only.** `board-card.tsx` and the detail
Sheet always render `AvatarFallback` initials; `avatar_url` is fetched
(`use-board-data.ts`) but never shown as an `AvatarImage`.

### Per-sector access
The board page resolves the sector via slug server-side
(`[sector]/boards/[boardId]/page.tsx`) and renders a clean "Setor não
encontrado" fallback — good. Card moves and edits flow through server actions
with permission checks. No per-sector defect observed on this screen.

---

## Screen 4 — Projects index

**Screenshots:** `admin/03-projects-sector.png`, `admin/05-projects-index.png`
(identical), `gerente-comercial/02-projects.png`.
**Code:** `components/projects/{project-list,project-create-dialog}.tsx`,
`hooks/use-projects.ts`.

### What works
- Status badge with a sensible four-state palette (`STATUS_CONFIG`:
  active/paused/completed/archived) and dark-mode variants.
- Date range rendered compactly ("30 de abr. - 29 de set.") via
  `toLocaleDateString('pt-BR', { day, month })`.
- Create dialog covers name, description, status, start/target dates with Zod
  validation.
- Empty state present and consistent with the Boards empty state.

### Findings

**[High] Project cards are dead ends — there is no project detail page.** The
`ProjectList` `Card` is not wrapped in a `Link` and no `/[sector]/projects/[id]`
route exists. A user can create a project, see a tile, and… nothing. The
`project_cards` join table exists (per `core-feature-gaps.md`) but there is no UI
to link cards to a project, no task list, no progress, no timeline, no members.
A "project" in ONEmonday today is a name + status + two dates. This is the most
significant functional gap in the module.
*Recommendation:* build a project detail page — linked cards/tasks list,
progress rollup, members, and a board/timeline view of the project's work. This
is the difference between "project tracker" and "two-field record".

**[High] No progress indicator on the tile.** Every comparison product shows
project completion (% done, X/Y tasks, milestone status). ONEmonday shows a
static "Ativo" badge. With `project_cards` available, a `done/total` rollup is
straightforward and would make the index actually informative.

**[Medium] No search / filter / sort and no grouping by status.** Same shortfall
as the Boards index. As projects accumulate, a flat 3-column grid with no
controls and no status grouping (active vs. archived) does not scale.

**[Medium] Date formatting drops the year and can mislead.** "30 de abr. - 29 de
set." omits the year, so a 2025 project and a 2026 project look identical, and a
cross-year range (`Dec → Feb`) reads backwards. *Recommendation:* include the
year, or show year when the range crosses one; also surface "atrasado" when
`target_date` is in the past and status is still `active`.

**[Medium] Create dialog hides multi-sector + owner.** Like boards,
`project-create-dialog.tsx` forces `sectorIds: [currentSector.id]`. Yet
"Plataforma ONEmonday v2" appears under *both* Desenvolvimento and Comercial
(`gerente-comercial/02-projects.png`) — it is cross-sector, but the UI cannot
create such a project. *Recommendation:* expose a multi-sector picker.

**[Low] No project edit; `⋯` menu is delete-only.** `useUpdateProject` exists
but is unreachable — status, dates and name cannot be changed after creation, so
a project can never legitimately move from "Ativo" to "Concluído" through the
UI. Add an "Editar" item.

**[Low] Whole card not clickable** (same as Boards) — once a detail page exists,
the entire tile should navigate to it.

### Per-sector access
Correct: `useProjects` filters via `project_sectors.sector_id`. The cross-sector
"Plataforma ONEmonday v2" correctly appears for both Dev and Comercial managers,
and "Expansao Comercial Q3" appears only for Comercial — scoping works. The
limitation is that the UI cannot *create* this cross-sector relationship.

---

## Cross-cutting observations

- **Index pages are under-built.** Boards and Projects are both flat card grids
  with delete-only menus, no search/sort/filter, no metadata, and no whole-card
  click target. They feel like the same unfinished template.
- **`useUpdate*` hooks exist but are never reachable** for boards and projects —
  edit is missing from both screens.
- **Date formatting is fragmented** — `formatDateShort`, `formatDateFull`,
  `toLocaleDateString('pt-BR')` and an inline `Intl.DateTimeFormat` all coexist;
  the year is sometimes dropped. Consolidate into shared formatters.
- **pt-BR diacritics are inconsistent** ("Distribuicao", "Concluido",
  "Descricao", "Critico") — strings should be corrected centrally.
- **Nothing on the dashboard is a launchpad** — KPIs, charts and activity rows
  are all non-interactive.
- **RLS-joined queries silently empty out for scoped users** (the column-chart
  bug) — audit every `!inner` join used in a manager-facing query.

---

## Prioritized backlog (by value / effort)

| # | Item | Screen | Impact | Effort | Notes |
| --- | --- | --- | --- | --- | --- |
| 1 | Fix "Distribuição por Coluna" empty for sector managers (drop the `board_columns!inner` join; resolve columns from a scoped query/RPC) | Dashboard | High | S | Visible defect; makes manager dashboards look broken |
| 2 | Fix priority filter showing raw `all` instead of "Todas prioridades" | Board detail | High | S | One-line `SelectValue` fix; first thing users see |
| 3 | Build a Project detail page — linked cards, progress rollup, members, timeline | Projects | High | L | Removes the module's biggest dead end; `project_cards` already exists |
| 4 | Add board "Agrupar por" (swimlanes) + assignee/tag/due-date filters | Board detail | High | M | Core Kanban table-stakes vs. Monday/Trello |
| 5 | Enrich Boards & Projects tiles (card/task count, progress, members, updated date, visibility badge) + whole-card click | Indexes | Medium | M | Makes index pages informative |
| 6 | Add search + sort + status grouping to Boards and Projects indexes | Indexes | Medium | M | Scales the lists |
| 7 | Column management UI (add/rename/colour/reorder/WIP) + enforce WIP on create/move | Board detail | Medium | M | WIP "max N" is currently decorative |
| 8 | Expose Edit on board & project `⋯` menus (wire existing `useUpdate*`) | Indexes | Medium | S | Edit is fully built but unreachable |
| 9 | Make dashboard interactive — clickable KPIs, "Atrasados" drill-down list, "Meus cards" widget | Dashboard | Medium | M | Turns the dashboard into a launchpad |
| 10 | Expose visibility / multi-sector picker in board & project create dialogs | Indexes | Medium | S | Cross-sector items exist but cannot be created |
| 11 | Consolidate date formatting and fix pt-BR diacritics module-wide | All | Low | S | Consistency / polish |
| 12 | Prev/next card navigation in the detail Sheet; DnD ARIA announcements + focus ring | Board detail | Low | M | Reviewer ergonomics + accessibility |
| 13 | Richer quick-add (priority + due date) when adding a card to a column | Board detail | Low | S | Avoids the create-then-edit round trip |

**Recommended first wave:** #1, #2, #8, #10, #11 — all small, two are visible
defects, and together they make every Core screen look finished. Then #3 and #4
as the headline value items.

---

## Sources

- [Monday.com — The Kanban View](https://support.monday.com/hc/en-us/articles/360000661379-The-Kanban-View)
- [Monday.com — The Board Filters](https://support.monday.com/hc/en-us/articles/360003624660-The-Board-Filters)
- [Monday.com — The Cards View](https://support.monday.com/hc/en-us/articles/4405723870994-The-Cards-View)
- [Trello — Project status dashboard](https://trello.com/use-cases/project-status-dashboard)
- [Trello — Dashboard view](https://trello.com/views/dashboard)
- [Trello vs Linear comparison (2025)](https://www.stackfix.com/compare/linear-project-management/trello-project-management)
- [Linear — product overview](https://linear.app/)
- Internal: `docs/research/core-feature-gaps.md`, `docs/research/monday-competitive-analysis.md`
