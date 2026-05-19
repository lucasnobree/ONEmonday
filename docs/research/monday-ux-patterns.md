# Monday.com Navigation & UX Patterns — Reference for the ONEmonday Restyle

**Purpose:** Concrete, implementation-oriented reference for restyling the internal ONEmonday
app (modules: CRM, HR, Support, Finance, Legal, Marketing, Analytics, Dev-Tools, plus a
Boards/Kanban core) to match Monday.com conventions.

**Date:** 2026-05-19
**Method:** Web research against Monday.com official product pages, support center, developer
docs, and third-party walkthroughs (sources linked per section).

---

## 1. Left Sidebar / Navigation

### Pattern (how Monday.com does it)

The left pane is the single, always-visible navigation hub. It is vertically structured,
top to bottom:

1. **Top fixed icons (global, account-wide):**
   - **Home** — monday AI home / landing page.
   - **My Work** — calendar-checklist icon; the personal cross-board task view.
   - **Notifications (Bell)** — account-wide activity addressed to you.
   - **Inbox** — updates/posts you follow or are mentioned in; bookmarked posts land here.
   - **Search ("Search Everything")** — global search across boards, items, docs, dashboards.
   - **Favorites** — a collapsible section pinning your most-used boards/docs/dashboards;
     supports its own nested folders (via the 3-dot menu → "New Folder"); items are added
     by starring a board title or via the 3-dot menu → "Add to favorites".

2. **Workspace switcher** — a dropdown at the top of the board list. Opening it shows
   *Pinned workspaces*, *Recent workspaces* (last 5), then the full list grouped into
   *My workspaces* and *Workspaces I collaborate on*. The sidebar always shows the
   contents of **one** active workspace at a time.

3. **Board tree for the active workspace** — folders and boards listed beneath the
   workspace name. Folders are expandable/collapsible disclosure rows. A board row, when
   expanded, reveals its **sub-views as child rows** (Table, Kanban, etc. each appear as
   an indented entry under the board).

4. **In-pane search/filter** — a magnifying-glass field that narrows the tree; a "tornado"
   filter icon filters by asset type, creator, your role, and privacy level.

5. **The "+" add affordance** — a blue **+** button next to the workspace name. It creates
   a new board, folder, doc, dashboard, or opens the Template Center. Folders and boards
   also each have a 3-dot context menu for rename/move/favorite/delete.

### Hierarchy depth

```
Workspace
  └─ Folder            (up to 3 levels of folder nesting within a workspace)
       └─ Folder
            └─ Folder
                 └─ Board
                      └─ View   (Table / Kanban / Gantt / Calendar / ... — shown as
                                  child rows in the tree AND as tabs on the board)
```

So the *navigable* hierarchy is **Workspace → Folder(×up to 3) → Board → View**.
Dashboards and Docs live at the same level as Boards inside a workspace/folder.

### Apply to ONEmonday

- Adopt the same **three-zone left pane**: (a) a thin top strip of global icons
  (Home, My Work, Notifications, Search), (b) a **module switcher** in place of the
  workspace switcher, (c) a contextual tree for the active module.
- Treat **each ONEmonday module (CRM, HR, Support, ...) as a "workspace"**. Only one
  module's tree is shown at a time — this keeps the sidebar short and on-task.
- Add a **Favorites/Pinned** section above the module tree so an IC can pin the 3–5
  boards/views they touch daily and skip the module drill-down entirely.
- Keep nesting shallow: **Module → Section (folder) → Board → View**. Do not exceed
  one folder level unless a module genuinely needs it.
- Implement the **"+" affordance** per module (create board / section / view) and a
  per-row 3-dot menu.

---

## 2. Board-Centric Model

### Pattern

The board is the atomic unit of work in Monday.com. Everything else (My Work, dashboards)
is a *projection* of board data.

- **Groups** — colored, collapsible horizontal bands inside a board that bucket items
  (e.g. "This week", "Backlog"). Group name and color are editable.
- **Items (rows)** — the work records. The first cell is the item name; clicking it
  opens the Item Card.
- **Columns** — typed cells (Status, People, Date, Numbers, Timeline, Mirror, etc.).
  Status columns drive the colored pills; up to 40 labels, each with its own color.
- **Item Card (slide-out detail panel)** — opened by clicking an item's name. It
  consolidates the item's column data into a card and contains the **Updates Section**
  (threaded comments/posts) and an **Activity Log tab** scoped to that single item
  (most-recent-first; filterable by person/time/column). This is where conversation,
  history, and detail live without leaving the board.
- **Multiple views on one board** — the *same* item data can be rendered as Table,
  Kanban, Gantt, Timeline, Calendar, Cards, Chart, Workload, Map, Files Gallery, Form,
  or Pivot. Views are **tabs across the top of the board**; switching tabs re-renders
  the same dataset. A split-screen mode can show two views at once.

### Apply to ONEmonday

- Make the **board the core screen** of every module. CRM = pipeline boards; HR =
  hiring/onboarding boards; Support = ticket boards; etc. — all the same primitive.
- Implement **Groups + typed Columns + Status pills** as the shared board engine the
  Boards/Kanban core already provides; every module reuses it.
- Build the **Item Card slide-out** once: column summary + Updates thread + per-item
  Activity Log. Every module's "record detail" (a CRM contact, an HR candidate, a
  Support ticket) becomes an Item Card — no bespoke detail pages.
- Offer **per-board view tabs** (at minimum Table + Kanban; add Calendar/Gantt where the
  module needs dates). One dataset, many renderings.

---

## 3. "My Work"

### Pattern

My Work is the **personal, cross-board home screen** for an individual contributor.
Accessed via the calendar-checklist icon in the top strip of the left pane.

- It aggregates **every item assigned to you across all boards** in the account into one
  list — no board-hopping required.
- Items are **grouped by date buckets** — Overdue, Today, This week, Next week, and
  Later — answering "what do I need to do and when".
- The user can **change status and dates inline** and jump straight to the source board
  of any item.
- A **Customize** control (top-right) chooses which boards feed it, which people/columns
  are shown, and a **"Hide done items"** toggle.
- Requirements: items only surface if the board has a **People column** (and the user is
  assigned) and ideally a **Status column** for progress.

### Apply to ONEmonday

- Build a **My Work screen** that scans every module's boards for items where the
  current user is the assignee, grouped by Overdue / Today / This week / Later.
- Make it the **default landing screen for individual-contributor roles** — an IC in
  Support or Marketing should never need to know which board a task lives on.
- Require the board engine to have a canonical **Assignee (People) column** and
  **Status column** so My Work works consistently across all eight modules.
- Provide inline status/date editing and a "jump to board" link, plus a Customize panel
  and Hide-done toggle.

---

## 4. Dashboards

### Pattern

A **dashboard** is a separate object (sibling of boards inside a workspace) whose job is
**cross-board aggregation and visualization** — not data entry.

- Built from **50+ widgets**: Chart, Numbers, Battery, Timeline, Gantt, Calendar,
  Overview, etc.
- **Battery widget** — a battery-style progress bar (blue = done, grey = remaining)
  summarizing status completion across selected boards.
- **Numbers widget** — sums a Numbers column across boards (e.g. total budget spent).
- **Chart widget** — interactive graphs/charts for pipelines, analytics, etc.
- Widgets can pull from **multiple boards at once**; dashboards are the recommended way
  to see data spanning boards.

### Board view vs. Dashboard — the key distinction

| | Board view | Dashboard |
|---|---|---|
| Scope | One board's items | Many boards aggregated |
| Purpose | View/edit work | Monitor/report KPIs |
| Editing | Edit items directly | Read-only visualization |
| Object type | A tab on a board | A standalone object |

(Note: a few widgets — Battery, Chart, Numbers, Gantt, Calendar — can also be embedded
as *views* on a single board; the dashboard is what makes them multi-board.)

### Apply to ONEmonday

- Treat **dashboards as first-class objects** per module, distinct from board views.
- A **sector dashboard** per module aggregates that module's boards (e.g. Support:
  open-ticket Battery, avg-resolution Numbers, ticket-volume Chart).
- A **global overview dashboard** aggregates across all eight modules for admins.
- Reuse the same widget set (Chart / Numbers / Battery / Timeline) everywhere; the
  Analytics module is essentially a dashboard-authoring surface.

---

## 5. Top Bar & In-Screen Chrome

### Pattern

Monday.com keeps **navigation in the sidebar** and **board controls in the board header** —
they do not mix.

In-board header (top of the board, left to right, roughly):
- **Board name** + description, with a disclosure arrow that **expands the header to show
  view tabs**.
- **View tabs** — Table / Kanban / Gantt / etc. for this board.
- **"New Item"** — a blue button at top-left; its dropdown arrow also offers "New group
  of items".
- **Search bar** — searches within this board; column scope is configurable.
- **Person filter** — a person icon; filter to your own or a teammate's items.
- **Filter** — quick suggested filters + advanced rule builder.
- **Sort**, and other board actions.

What lives in the **sidebar** (not the board header): workspace/module switching, the
board tree, favorites, My Work, notifications, global search, the "+" create affordance.

### Apply to ONEmonday

- **Move all view switching into the board header as tabs.** Anything that is "a way of
  looking at this board" (Table/Kanban/Calendar/Chart) belongs on the board, not the nav.
- Keep the sidebar strictly for **navigation between modules/boards** plus global actions.
- Standardize a board header: `[Board name ▾ tabs] ............. [Search] [Person] [Filter] [Sort] [+ New Item]`.
- Primary action (**New Item**) is a single prominent blue button, top-left of the header.

---

## 6. Color, Density, Iconography

### Pattern

- **Status pills** — the signature element: rounded, fully-colored cells. Each status
  label has its own color (up to 40 per column). Color *is* the data — you read board
  state by scanning color.
- **Groups** — each group band has a colored left edge / colored title; the color
  carries down the left border of its rows, giving a **colored left-border** as a
  grouping cue.
- **Density** — high. Rows are compact; the Table view is a dense spreadsheet-like grid.
  Whitespace is minimal so many items fit on screen.
- **Iconography** — small monochrome glyphs for nav (bell, calendar-checklist, star,
  magnifier, "+"). Color is reserved almost entirely for *data* (statuses, groups,
  charts), keeping chrome neutral and data vivid.
- Boards/items can carry small type icons; avatars represent People-column assignees.

### Apply to ONEmonday

- Adopt **colored status pills** as the universal state indicator across all modules
  (CRM deal stage, HR candidate stage, Support ticket priority, etc.).
- Use the **colored group band + colored row left-border** convention for grouping.
- Keep **chrome neutral / monochrome**; spend color on data only. This makes a
  multi-module app feel like one product rather than eight.
- Target **high density** in Table views; compact rows, minimal padding.
- Give each module a single recognizable monochrome icon for the module switcher.

---

## 7. Role Differences

### Pattern

Monday.com user types: **Admin, Member, Viewer, Guest**.

- **Admin** — account-level super-user. Sees the **Administration section** (not visible
  to members): user management, security, billing, account-wide board/permission
  settings. Admin capabilities can be **delegated granularly** (e.g. give someone only
  user-management without full admin).
- **Member** — everyday user. Works in Main boards, can be invited to Shareable/Private
  boards. No Administration section. Lives in their boards and My Work.
- **Viewer / Guest** — read or limited access; Guests are external collaborators.
- Permissions are layered: **account → workspace → board → dashboard** each have their
  own permission settings.

The practical effect: an admin's app has an extra **Administration** entry point and
account-wide visibility; a member's app is scoped to the work they're assigned/invited to.

### Apply to ONEmonday

- Define roles: **Individual Contributor**, **Sector Manager**, **Admin** (map to
  Member / Member-with-elevated / Admin).
- Only Admins see an **Administration** area (users, roles, module config, audit).
- Sector Managers get **module-wide visibility** within their sector(s) and can see the
  sector dashboard; ICs see only assigned work.
- Layer permissions **module → board** so a Support manager can't reconfigure CRM.

---

## 8. Recommended Navigation Model for ONEmonday

### 8.1 Proposed left-sidebar tree

```
┌─ GLOBAL STRIP (top, fixed icons) ───────────────────────────┐
│  ⌂ Home      ☑ My Work     🔔 Notifications     🔍 Search    │
├─ FAVORITES (collapsible, user-pinned) ──────────────────────┤
│  ★ <pinned board / view / dashboard>                        │
│  ★ ...                                                       │
├─ MODULE SWITCHER (dropdown — one module active at a time) ──┤
│  CRM ▾                                                       │
├─ ACTIVE MODULE TREE ────────────────────────────────────────┤
│  CRM                                              [ + ]      │
│   ├─ ▦ Dashboard (sector)                                    │
│   ├─ 📂 Pipelines                                            │
│   │    ├─ ▤ Leads board        (▸ Table / Kanban / ...)      │
│   │    └─ ▤ Deals board                                      │
│   ├─ 📂 Accounts                                             │
│   │    └─ ▤ Companies board                                  │
│   └─ ▤ Activities board                                      │
└──────────────────────────────────────────────────────────────┘
```

Module switcher options (each behaves like a Monday workspace):

| Module | Example sections → boards |
|---|---|
| **CRM** | Pipelines → Leads, Deals · Accounts → Companies · Activities |
| **HR** | Recruiting → Candidates, Job Reqs · People → Employees · Onboarding |
| **Support** | Tickets → Inbox, Escalations · SLAs · Knowledge Base |
| **Finance** | AP/AR → Invoices, Payments · Budgets · Expenses |
| **Legal** | Contracts → Active, Renewals · Matters · Compliance |
| **Marketing** | Campaigns → Active, Planned · Content Calendar · Assets |
| **Analytics** | Dashboards · Reports (dashboard-authoring surface) |
| **Dev-Tools** | Sprints → Active, Backlog · Bugs · Releases |
| **Boards/Kanban core** | The shared engine — generic/cross-functional boards |

Tree rules:
- One module's tree visible at a time (keeps the pane short).
- Depth capped at **Module → Section → Board → View**.
- Each board row expands to show its **view children**; views also appear as **tabs**
  on the board itself.
- Every module tree has its **sector Dashboard** pinned at the top.
- Per-module **"+"** creates board/section/dashboard; per-row 3-dot menu for
  rename/move/favorite/delete.

### 8.2 Where in-screen tabs go

Move **all view switching out of the sidebar and onto the board header**:

```
[ Board name ▾ ]  Table | Kanban | Calendar | Chart      ← view tabs
─────────────────────────────────────────────────────────────────────
[ + New Item ▾ ]              [ 🔍 Search ] [ 👤 Person ] [ ⛃ Filter ] [ ↕ Sort ]
```

- The sidebar = navigation between boards/modules only.
- The board header = everything that operates *on the current board* (views, new item,
  search, person filter, filter, sort).
- Item detail opens as a **slide-out Item Card** (column summary + Updates + Activity
  Log) — never a separate routed page.

### 8.3 Role-based landing screens

| Role | Lands on | Why |
|---|---|---|
| **Individual Contributor** | **My Work** (board-centric cross-module task list, grouped Overdue / Today / This week / Later) | They execute assigned tasks; they should not need to know which module/board a task lives in. |
| **Sector Manager** | **Their sector Dashboard** (the active module's aggregate dashboard — Battery, Numbers, Chart widgets over that module's boards) | They monitor and report on one sector's throughput, not individual rows. |
| **Admin** | **Global Overview Dashboard** (cross-module KPIs aggregating all eight modules) + access to the **Administration** area | They oversee the whole account: health across modules, plus user/role/module config. |

Landing-screen logic: on login, route by role → render My Work / sector Dashboard /
global Dashboard. All three are reachable for any role via the sidebar; the difference is
only the **default**. Admins additionally see an **Administration** entry that
Members/ICs never see.

---

## Key Sources

- [Understanding monday.com's structural hierarchy](https://support.monday.com/hc/en-us/articles/7278527605906-Understanding-monday-com-s-structural-hierarchy)
- [Getting started with workspaces](https://support.monday.com/hc/en-us/articles/360010785460-Getting-started-with-workspaces)
- [Folders](https://support.monday.com/hc/en-us/articles/115005316845-Folders)
- [The favorites section](https://support.monday.com/hc/en-us/articles/360009142179-The-favorites-section)
- [Navigating monday's AI work platform](https://support.monday.com/hc/en-us/articles/35276662798098-Navigating-monday-s-AI-work-platform)
- [My Work](https://support.monday.com/hc/en-us/articles/360019300579-My-Work)
- [The board views](https://support.monday.com/hc/en-us/articles/360001267945-The-board-views)
- [The Item Card](https://support.monday.com/hc/en-us/articles/360017143959-The-Item-Card)
- [The Updates Section](https://support.monday.com/hc/en-us/articles/115005900249-The-Updates-Section)
- [The Activity Log](https://support.monday.com/hc/en-us/articles/115005310745-The-Activity-Log)
- [The Status Column](https://support.monday.com/hc/en-us/articles/360001269685-The-Status-Column)
- [The basics of groups](https://support.monday.com/hc/en-us/articles/360011472320-The-basics-of-groups)
- [The Board Filters](https://support.monday.com/hc/en-us/articles/360003624660-The-Board-Filters)
- [The basics of items](https://support.monday.com/hc/en-us/articles/115005319105-The-basics-of-items)
- [The Dashboards](https://support.monday.com/hc/en-us/articles/360002187819-The-Dashboards)
- [The Battery Widget](https://support.monday.com/hc/en-us/articles/360002159360-The-Battery-Widget)
- [Dashboards | monday.com](https://monday.com/features/dashboards-mobile)
- [User types explained](https://support.monday.com/hc/en-us/articles/360002144900-User-types-explained)
- [The Administration section on monday.com](https://support.monday.com/hc/en-us/articles/115005321509-The-Administration-section-on-monday-com)
- [Account permissions](https://support.monday.com/hc/en-us/articles/360003457320-Account-permissions)
