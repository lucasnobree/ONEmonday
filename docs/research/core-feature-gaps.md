# Core Module — Feature Gap Analysis

**Date:** 2026-05-15
**Author:** Core module engineer (Claude)
**Scope:** ONEmonday Core module — dashboard, boards, kanban cards, projects.

---

## 1. Current state of the Core module

The Core module already covers the MVP happy path:

- **Boards:** CRUD with soft delete, per-sector visibility, default columns auto-created
  (`lib/actions/boards.ts`, `components/boards/board-list.tsx`).
- **Kanban:** dnd-kit drag-and-drop with optimistic updates and a transactional
  `reorder_cards` RPC with `board.updated_at` version-check for conflict resolution
  (`components/boards/board-view.tsx`).
- **Card detail:** a side Sheet with comments, checklists, attachments, activity log
  and cross-references — all functional, but **mostly read-only** for the card's own
  fields (title, description, priority, due date, assignees, tags cannot be changed).
- **Views:** Kanban, sortable List view, Timeline view.
- **Projects:** CRUD with soft delete and status, but **no card linking** despite the
  `project_cards` table existing.
- **Dashboard:** stats cards, priority chart, column distribution, recent activity.
- **RBAC:** `PermissionGate` + server-action permission checks + RLS, all in place.

It is a solid skeleton. The gaps below are mostly *table-stakes interactions that are
visible in the UI but not wired up*, plus one real metric-breaking bug.

---

## 2. Competitive comparison

| Capability | Monday.com | Asana | Linear | Trello | ClickUp | ONEmonday Core |
| --- | --- | --- | --- | --- | --- | --- |
| Kanban drag-and-drop | Yes | Yes | Yes | Yes | Yes | **Yes** |
| WIP limits per column | Yes | — | — | Power-Up | Yes | Schema only — **not enforced** |
| Inline edit of card fields | Yes | Yes | Yes | Yes | Yes | **No (read-only detail)** |
| Move card to done = "completed" tracked | Yes | Yes | Yes | Yes | Yes | **Broken — `completed_at` never set** |
| Board search / filter bar | Yes | Yes | Yes | Yes | Yes | **No** |
| Card labels/tags assignable from card | Yes | Yes | Yes | Yes | Yes | Read-only display |
| Card delete from board | Yes | Yes | Yes | Yes | Yes | Action exists, **no UI** |
| Subtasks / sub-issues | Yes | Yes | Yes | Yes (checklists) | Yes | `parent_card_id` column only |
| Due-date reminders / overdue surfacing | Yes | Yes | Yes | Yes | Yes | Overdue badge only |
| List view | Yes | Yes | Yes | Paid | Yes | **Yes** |
| Timeline / Gantt | Yes | Yes | Yes | Paid | Yes | **Yes** (basic) |
| Project ↔ task linking | Yes | Yes | Yes | — | Yes | Table exists, **no UI** |
| Keyboard command palette | Cmd-K | — | Cmd-K | — | Cmd-K | **Yes** (`command-palette.tsx`) |
| Automations | Yes | Yes | Yes | Butler | Yes | Out of MVP scope |
| Custom fields | Yes | Yes | — | — | Yes | Out of MVP scope |

Sources:
- Monday.com Kanban view & subitems — https://support.monday.com/hc/en-us/articles/360000661379-The-Kanban-View
- Monday.com Kanban software (WIP limits, filters) — https://monday.com/solutions/kanban
- Asana vs Trello (multi-view, dependencies, rules, reporting) — https://asana.com/resources/asana-vs-trello
- Asana vs Trello feature/pricing — https://tech.co/project-management-software/asana-vs-trello
- Linear concepts (priority, labels, sub-issues, relations) — https://linear.app/docs/conceptual-model
- Linear issue tracking & keyboard shortcuts — https://everhour.com/blog/linear-issue-tracking/
- ClickUp tasks (cover, due date, checklist, activity) — https://help.clickup.com/hc/en-us/articles/10552031987735-Intro-to-tasks
- ClickUp checklists — https://help.clickup.com/hc/en-us/articles/6309942197783-Use-task-checklists

---

## 3. Prioritized backlog

Effort: S (<0.5d), M (~1d), L (multi-day). "DB" = needs a migration.

| # | Item | Class | Why it matters | Effort | DB |
| --- | --- | --- | --- | --- | --- |
| 1 | Track `completed_at` when a card enters/leaves a done column | Bug | Dashboard "completed this week" and "avg time to complete" are silently wrong; cards never count as done. | S | DB |
| 2 | Inline-edit card fields (title, description, priority, due date) in the detail Sheet | Table-stakes | Users currently cannot change a card after creation except by deleting it. | M | — |
| 3 | Board filter bar — text search + priority + assignee filter, shared across Kanban/List/Timeline | Table-stakes | Every competitor has it; boards become unusable past ~30 cards. | M | — |
| 4 | Enforce column WIP limits on create + move | Competitive | UI shows "max N" but nothing stops exceeding it — the limit is decorative. | S | — |
| 5 | Delete a card from the board UI; delete checklist items | Table-stakes | `deleteCard` exists but is unreachable; checklist items can be added but never removed. | S | — |
| 6 | Assign/remove tags and assignees from the card detail | Table-stakes | Tags/assignees are display-only after creation. | M | — |
| 7 | Zero-lint the Core module (real type fixes, effect-logic fixes) | Quality | `module-engineer` standard requires zero errors/warnings in owned files. | M | — |

### Recommended first wave (this PR)

Items **1–5 and 7**, plus a focused slice of **6** (tag assignment, since the
`card_tags` table and RLS already exist). Item 6's assignee picker and the
project↔card linking UI are deferred — see follow-ups.

---

## 4. Deliberately deferred (next wave)

- **Project ↔ card linking UI** — `project_cards` table exists; needs a card picker
  and a project-detail page. Medium effort, no migration.
- **Assignee picker in card detail** — needs a sector-scoped user search component.
- **Subtasks** — `parent_card_id` exists; needs nested rendering and progress rollup.
- **Saved views** — `saved_views` table exists; persist filter bar selections per user.
- **Automations / custom fields** — explicitly out of MVP scope per the design spec.
