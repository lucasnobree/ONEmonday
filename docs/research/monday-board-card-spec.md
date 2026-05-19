# Monday.com Board & Card — Visual Anatomy Spec

**Purpose:** A pixel-faithful visual specification of Monday.com's **board and card UI** so the
ONEmonday team can replicate the *exact element disposition*. This is the **visual anatomy**
companion to `monday-ux-patterns.md` — that doc covers navigation and the board *model*; this
doc covers *what the screens look like*, element by element.

**Date:** 2026-05-19
**Method:** Web research against Monday.com support center, developer/Vibe design-system docs,
the official "new board design" product update, and third-party walkthroughs. Sources listed at
the end. Where a source blocked direct fetch, the layout was reconstructed from corroborating
walkthroughs and the Vibe design system.

**Scope of ONEmonday components mapped:** `board-view.tsx`, `board-card.tsx`,
`board-column.tsx`, `board-card-detail.tsx`, `board-list-view.tsx`, `board-filters.tsx`,
`board-column-menu.tsx`.

> **Reading convention.** "Color is data, chrome is neutral." Every spec below obeys it: color
> is spent on statuses, group bands, accent borders and avatars; all surrounding chrome (header,
> toolbar, column wells, card bodies) is neutral grey/white.

---

## 0. Design tokens (the shared vocabulary)

Monday's UI is built on the **Vibe design system**. Concrete values used throughout this spec
(Vibe primitives + measured-from-product approximations):

| Token | Value | Used by |
|---|---|---|
| Radius — small | `4px` | status pills, tags, buttons |
| Radius — medium | `8px` | cards, column wells, panels |
| Radius — round | `50%` | avatars, color dots |
| Spacing scale | `4 / 8 / 12 / 16 / 24px` | all gaps & padding |
| Card body padding | `12px` | Kanban card interior |
| Gap between cards | `8px` | vertical rhythm in a column |
| Gap between columns | `12–16px` | Kanban horizontal rhythm |
| Column width | `~280px` fixed (`w-72`) | Kanban lane |
| Item-row height (Table) | `36–40px` default ("Default" density) | table row |
| Accent border width | `3–4px` | colored left edge on card / row |
| Font — item name | `14px / 600` (medium-semibold) | card title, row name cell |
| Font — meta/labels | `12px / 400` | counts, dates, column labels |
| Font — pill text | `12–13px / 500` | status pill label |
| Font — panel H1 | `20–24px / 700` | Item Card header |
| Neutral chrome | white `#FFFFFF` surfaces, `#F6F7FB` wells, `#E6E9EF` borders, `#676879` secondary text, `#323338` primary text | header, toolbar, wells |
| Primary brand blue | `#0073EA` (Vibe `--primary-color`) | New Item button, links, active tab |

**Monday status label palette (the canonical set).** A Status column draws from a fixed swatch;
the workhorse colors:

| Label intent | Hex | Name |
|---|---|---|
| Done / success | `#00C875` | green-shadow |
| Working on it | `#FDAB3D` | orange |
| Stuck / blocked | `#E2445C` | red-shadow |
| (empty / not started) | `#C4C4C4` | grey |
| Generic A | `#579BFC` | bright-blue |
| Generic B | `#A25DDC` | purple |
| Generic C | `#037F4C` | dark-green |
| Generic D | `#FFCB00` | yellow |

A Status column supports **up to 40 labels**, each with its own color. Color *is* the data.

---

## 1. Board header / toolbar

Monday's redesigned board header is a **sticky two-row band** at the top of the board content
area (right of the sidebar). It collapses and travels with you on scroll.

```
┌─ BOARD HEADER (sticky) ─────────────────────────────────────────────────────────────┐
│ ROW 1 — identity + views                                                            │
│  ┌──────────────┐                                                                   │
│  │ Board name ▾ │  (i)   ★      │  Main Table │ Kanban │ Calendar │ + │   ...        │
│  └──────────────┘  info  fav    └─ view tabs ──────────────┘ add-view               │
│                                  active tab = blue underline + bold label           │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ ROW 2 — board actions (operates on the current view)                                │
│  ┌───────────────┐                                                                  │
│  │ + New Item  ▾ │  Search  │  👤 Person │  ⛃ Filter │  ↕ Sort │  👁 Hide │  ⋯ More   │
│  └───────────────┘  (left)     ┗━━━━━━━━━ right-aligned cluster ━━━━━━━━━┛            │
│   blue, top-LEFT                                                                     │
│   ▾ = New item / New group / Import                                                  │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

**Exact left-to-right order**

- **Row 1 (identity + views):** `Board name` (with a `▾` disclosure that expands the header)
  → `(i)` info icon (description: workspace, creator, type) → `★` favorite toggle →
  **view tabs** (`Main Table`, `Kanban`, `Calendar`, …) → `+` add-view button at the end of
  the tab strip.
- **Row 2 (actions):** **`+ New Item`** button at the **far left** → then a **right-aligned
  cluster**: `Search` (in-board) → `Person` filter (avatar icon) → `Filter` (funnel) →
  `Sort` → `Hide` (hidden-columns) → `⋯` More.

**Separate row vs same row**

- View tabs live on **Row 1**, attached to the board identity. They are NOT mixed with the
  action controls.
- All board-action controls (New Item, Search, Person, Filter, Sort) live on **Row 2**.
- New Item is **alone on the left**; everything else is **clustered on the right**. This left/
  right split is deliberate: primary creation action vs. view-shaping tools.

**New Item button** — solid **brand blue `#0073EA`**, white text, `4px` radius, ~`32px` tall.
A `▾` split-arrow opens *New item of group… / New group of items / Import items*.

**States**

- Active view tab: bold label + `2px` blue underline; inactive tabs are `#676879` grey text.
- Filter/Sort buttons show a **count badge** when active (e.g. `Filter (2)`) and tint blue.
- On scroll: the header collapses to a single compact row but keeps New Item + the action
  cluster reachable.

**Implement in ONEmonday.** `board-view.tsx` already renders a header — restructure it to the
**two-row sticky** model. Row 1 = board name + view tabs (Table / Kanban / Timeline / List that
the app already has); Row 2 = `+ New Item` far-left (reuse the existing create-card action) and
a right-aligned cluster wiring `board-filters.tsx` (Person + Filter), Sort, and a `⋯` menu.
Keep the header `sticky top-0` with a neutral white background and a `1px #E6E9EF` bottom border.

---

## 2. Kanban view layout

The Kanban view is **one vertical column per Status-column value** (plus an *empty/blank*
column for items with no status). Columns sit in a horizontally-scrolling track.

```
┌─ KANBAN BOARD (horizontal scroll →) ───────────────────────────────────────────────┐
│                                                                                     │
│  ┌─ column ─────────┐  ┌─ column ─────────┐  ┌─ column ─────────┐  ┌ + ┐            │
│  │ ● Working on it 4│  │ ● Stuck        2 │  │ ● Done         7 │  │add│            │
│  │   ┗ colored dot  │  │                  │  │                  │  │col│            │
│  ├──────────────────┤  ├──────────────────┤  ├──────────────────┤  └───┘            │
│  │ ┌──────────────┐ │  │ ┌──────────────┐ │  │ ┌──────────────┐ │                  │
│  │ │   card       │ │  │ │   card       │ │  │ │   card       │ │                  │
│  │ └──────────────┘ │  │ └──────────────┘ │  │ └──────────────┘ │                  │
│  │ ┌──────────────┐ │  │ ┌──────────────┐ │  │ ┌──────────────┐ │                  │
│  │ │   card       │ │  │ │   card       │ │  │ │   card       │ │                  │
│  │ └──────────────┘ │  │ └──────────────┘ │  │ └──────────────┘ │                  │
│  │ + Add item       │  │ + Add item       │  │ + Add item       │                  │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘                  │
│   ↑ neutral grey well   8px gap between cards   12–16px gap between columns         │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

- **Column = one Status value.** Re-ordering Status labels reorders the Kanban columns.
- **Column well:** a neutral light-grey rounded container (`#F6F7FB`, `8px` radius),
  **fixed width ≈ 280px**, full available height with internal vertical scroll for the cards.
- **Column header (top of well):** a small **colored dot** (the status color) → the **status
  label** (`14px / 600`) → an **item count** (`12px`, muted grey). On the redesigned board the
  count appears on hover; render it always-on for clarity. A `⋯` column menu sits at the far
  right of the header.
- **Add affordances:**
  - **`+ Add item`** — a ghost row pinned at the **bottom of each column well**, muted grey
    text with a `+` glyph; click → inline title input.
  - **`+ Add column`** — a narrow `+` tile at the **end of the column track** (creates a new
    Status label, which spawns a new Kanban column).
- **Spacing:** `8px` vertical gap between cards; `12–16px` horizontal gap between columns;
  `8–12px` padding inside the well.
- **Horizontal scroll:** the column track scrolls left/right; column headers stay aligned with
  their wells (no sticky header inside Kanban beyond the board header).

**States**

- *Empty column:* well shows a faint placeholder ("No items") above the `+ Add item` row.
- *Drag-over column:* the well background tints (light blue/accent) and shows a drop-line gap.
- *Loading:* 2–3 skeleton card rectangles per column.

**Implement in ONEmonday.** `board-column.tsx` already matches this almost exactly: `w-72`
well, `bg-muted/50`, header with a color dot + name + count, droppable body with `space-y-2`,
and a bottom `+ Adicionar card` ghost button. Two gaps vs. Monday: (1) Monday's column = a
**Status value**, ONEmonday's column is a free-form board column — keep the free-form model but
adopt the colored-dot-from-status convention; (2) add the **`+ Add column`** tile at the end of
the track in `board-view.tsx` (the column-create dialog already exists in
`board-column-dialog.tsx`). Keep the well neutral — color only the dot.

---

## 3. The Kanban card — full anatomy

A Monday Kanban card is a **white rounded rectangle with a colored LEFT border** (NOT a top
strip — the accent is a `3–4px` colored *left edge*; the top strip is reserved for the optional
*cover image*). Elements, top to bottom:

```
┌─┬──────────────────────────────────────────────┐
│ │  [ optional cover image — full-bleed top ]   │  ← only if a File/People cover column set
│ │                                              │
│▌│  ● Tag   ● Tag                          ⋯   │  ← (1) tag/label chips row + 3-dot menu
│▌│                                              │
│▌│  Item name goes here and wraps to            │  ← (2) item name — 14px / 600, up to 2 lines
│▌│  a second line then truncates…               │
│▌│                                              │
│▌│  ┌────────────┐  📅 May 24                   │  ← (3) column values: status pill + date
│▌│  │ Working on │                              │
│▌│  └────────────┘                              │
│▌│                                              │
│▌│  💬 3        🔗 2                  (AB)(CD)+1 │  ← (4) updates count · refs · avatars
└─┴──────────────────────────────────────────────┘
 ↑
 3–4px colored LEFT border = item accent (priority / status / group color)
```

**Element order (top → bottom):**

1. **Colored accent — LEFT border, `3–4px`.** This is the signature. On a Kanban card the
   accent encodes priority or the group/status color. (A *top strip* appears only when a
   **cover image** column is configured — image is full-bleed across the card top.)
2. **Tag/label chips row** (optional) — small rounded `4px` chips, tinted background, `10–12px`
   text. The **`⋯` 3-dot menu** sits at the **top-right corner** of the card (visible on hover).
3. **Item name** — `14px`, weight `600`, primary text `#323338`, `leading-snug`. Wraps to a
   max of ~2 lines then truncates with `…`.
4. **Column values block** — the configurable fields chosen in the Kanban "Card settings".
   Rendered as a compact wrapped row:
   - **Status** → a **compact rounded pill** (`4px` radius, fully colored, white text) — NOT
     full-width here (full-width fill is the *Table* behavior).
   - **Date** → calendar glyph + short date; turns **red** with an alert glyph when overdue.
   - **Numbers** → plain numeric text, optional unit.
   - **People** → avatars (see next).
   - **Tags** → chips as in row (2).
5. **Footer row** — left side: **updates/comment count** (`💬 N`) and any cross-reference/
   relation count (`🔗 N`); right side: **assignee avatars** — `24px` round, overlapping with
   `-6px` negative margin, max 3 shown then a `+N` counter chip. Avatars are bottom-right.
6. **Progress indicator** (optional) — when a Progress/Battery column is shown, a thin
   horizontal bar (`4–6px` tall, rounded) rendered in the values block.

**Sizing & spacing.** Body padding `12px`; `8px` vertical gap between internal blocks; card
radius `8px`; subtle shadow (`0 1px 2px rgba(0,0,0,.06)`).

**States**

- *Hover:* shadow deepens, border darkens slightly, the `⋯` menu and quick-edit affordances
  appear. Cursor is `grab`.
- *Dragging:* card lifts (stronger shadow), source slot shows `~50%` opacity ghost; a drop gap
  opens in the target column.
- *Selected/active:* `2px` blue ring/outline.
- *Loading:* skeleton card — grey title bar + grey footer bar.

**Implement in ONEmonday.** `board-card.tsx` is already very close: `rounded-lg`,
`border-l-4` colored left border from `PRIORITY_BORDER_COLORS`, `p-3` body, name at
`text-sm font-medium`, a footer with date + cross-ref count on the left and an overlapping
avatar stack (`-space-x-1.5`, `+N` overflow) on the right. To fully match Monday: (a) add the
**`⋯` 3-dot menu** at the top-right (hover-revealed) wired to card actions; (b) add a **status
pill** to the values row (today only tags + date + refs are shown); (c) add the **updates
count** (`💬 N`) to the footer-left — the data exists via `card_comments` in
`board-card-detail.tsx`; (d) optionally support a **cover image** top strip. Keep the left
border as the single accent — do not also add a top color strip unless a cover is set.

---

## 4. Table / Main view

The Main Table is a dense, spreadsheet-like grid. Items are organized into **colored Groups**;
each group is a band with a colored left edge.

```
┌─ TABLE / MAIN VIEW ────────────────────────────────────────────────────────────────────┐
│  ▾ ▌ This week                                          6 items                         │  ← group band header
│  ▌                                                                                       │
│  ▌ ┌──┬─────────────────────┬──────────────┬─────────┬──────────┬──────────┐            │
│  ▌ │☐ │ Item                │ Status       │ Owner   │ Date     │ Numbers  │            │  ← column header row
│  ▌ ├──┼─────────────────────┼──────────────┼─────────┼──────────┼──────────┤            │
│  ▌ │☐ │ Design landing page │██ Working on ██│  (AB)  │  May 24  │   12     │            │  ← item row
│  ▌ │☐ │ Write API docs      │██   Done    ██│  (CD)  │  May 20  │    8     │            │
│  ▌ │☐ │ QA regression pass  │██   Stuck   ██│ (EF)(GH)│  May 26 │    5     │            │
│  ▌ ├──┴─────────────────────┴──────────────┴─────────┴──────────┴──────────┤            │
│  ▌ │ + Add item                                                            │            │  ← add-item row
│  ▌ ├────────────────────────┬──────────────┬─────────┬──────────┬──────────┤            │
│  ▌ │                        │ 4 Done 2 Stuck│         │          │   25     │            │  ← group SUMMARY row
│  ▌ └────────────────────────┴──────────────┴─────────┴──────────┴──────────┘            │
│  ↑                                                                                       │
│  3–4px colored group left-border carries down every row of the group                    │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

**Group band**

- **Colored left edge** (`3–4px`) in the group's color — runs the full height of the group and
  down the left of **every row** in it.
- **Group header row:** a **collapse/expand caret** (`▾` open / `▸ collapsed`) → the **group
  name** in the group color, weight `600` → an **item count** (`N items`, muted) shown on the
  right or on hover.
- **Group summary row** at the **bottom** of the group: per-column aggregate cells — a Status
  column shows a **mini stacked bar** of label distribution ("4 Done / 2 Stuck"), Numbers
  columns show a **sum**, etc. Aligned to the columns above it.
- Collapsed group = just the header band; rows hidden.

**Item row**

- **Checkbox column** — leftmost narrow cell (`~32px`), a checkbox revealed on row hover / always
  when any row is selected; selecting rows enables a **batch-action bar**.
- **First cell = Item name** — `14px / 600`; inline-editable; carries a hover-revealed
  **expand/open icon** that launches the Item Card, plus a small **updates `💬`** glyph.
- **Typed column cells** follow: Status, People (avatars), Date, Numbers, Timeline, Tags, etc.
- **Colored left-border** on each row = the group color (the grouping cue).
- **Row height ≈ 36–40px** ("Default" density; Monday also offers compact/comfortable).
- **`+ Add item`** — a ghost row pinned at the **bottom of each group**, muted-grey `+` text;
  inline title input on click.

**Status cell vs. Kanban pill — the key difference**

- **In Table:** the status **fills the ENTIRE cell** edge-to-edge — a full-bleed colored block
  with centered white label. No padding gap around it.
- **On a Kanban card:** the status is a **compact rounded pill** that hugs its label.
- Same data, two renderings: full-cell fill (Table) vs. hugging pill (card).

**States**

- *Row hover:* faint grey background; checkbox + row-action chevrons appear.
- *Row selected:* checkbox checked, light-blue row tint, batch bar appears at screen bottom.
- *Empty group:* header + a single `+ Add item` row.
- *Empty board:* a centered illustration + "Add your first item" CTA.
- *Loading:* skeleton rows (grey bars per cell).

**Implement in ONEmonday.** `board-list-view.tsx` is the analog. Restructure it to the
**group-banded grid**: (1) render a `3–4px` colored left-border per group carrying into its
rows; (2) group header = caret + colored name + `N items`; (3) add a **group summary row**
(Numbers sum, Status distribution mini-bar); (4) first cell = inline-editable item name with a
hover expand icon that opens `board-card-detail.tsx`; (5) make Status cells **full-bleed
colored fills**, not compact pills; (6) add the leftmost **checkbox column** + batch bar; (7)
pin a `+ Add item` ghost row at the bottom of each group. Target `36–40px` row height.

---

## 5. Status pills & colors

The status pill is Monday's signature element.

```
COMPACT PILL (card / dropdown)        FULL-CELL FILL (Table)
┌────────────────┐                   ┌──────────────────────────┐
│  Working on it │  ← hugs label,    │██████ Working on it ██████│  ← fills whole cell,
└────────────────┘    4px radius     └──────────────────────────┘    centered white text
  padding 2px 8px,                     no surrounding padding,
  white text on color                  edge-to-edge color
```

- **Shape:** rectangle with `4px` corner radius (gently rounded, NOT a full stadium/`9999px`
  capsule). Vibe calls this the "Label" component.
- **Padding (compact pill):** `~2px` vertical, `~8px` horizontal; text `12–13px / 500`, white.
- **Table cell:** the colored block **fills the entire cell** (no margin); the label is
  horizontally centered, white text. The cell *is* the pill.
- **Card pill:** compact, hugs the label, sits inline in the values block.
- **Color = data.** Each Status label has one of ~40 palette colors. You read board state by
  scanning color, not text. An empty/not-started status is neutral grey `#C4C4C4`.
- **Colored-group convention:** group bands reuse the same swatch palette; the group color runs
  the left border. Statuses and groups share the palette so the board reads as one color system.
- **Rule — "color is data, chrome is neutral":** pills, group bands, avatars and accent borders
  carry color; the header, toolbar, column wells and card bodies stay white/grey. Never tint
  chrome.

**Implement in ONEmonday.** ONEmonday currently uses shadcn `Badge` for tags and
`PRIORITY_BORDER_COLORS` for accents. Add a dedicated **`StatusPill`** primitive with two
render modes: `compact` (hugging pill, `rounded` `4px`, used on cards and in dropdowns) and
`cell` (full-bleed fill, used in `board-list-view.tsx` table cells). Drive both from a shared
status→color map mirroring Monday's palette (green `#00C875`, orange `#FDAB3D`, red `#E2445C`,
grey `#C4C4C4`, …). Keep all chrome neutral.

---

## 6. The Item Card (slide-out detail panel)

Clicking an item name opens the **Item Card** — a panel that slides in from the **right edge**
of the screen, overlaying the board.

```
                                  ┌─ ITEM CARD (slides in from RIGHT) ──────────────┐
                                  │  Design landing page              ✎  ⤢  ⋯   ✕  │  ← header: name + actions + close
                                  │  ██ Working on it ██   ·  in: This week         │  ← status pill + group/context
                                  ├──────────────────────────────────────────────────┤
                                  │  COLUMN VALUES SUMMARY                           │
                                  │   Owner    (AB)(CD)                              │
                                  │   Date     May 24, 2026                          │
                                  │   Priority ██ High ██                            │
                                  │   Numbers  12                                    │
                                  ├──────────────────────────────────────────────────┤
                                  │  Updates │ Files │ Activity Log │ Info Boxes     │  ← tab strip
                                  │  ────────                                        │     active tab underlined
                                  ├──────────────────────────────────────────────────┤
                                  │  ┌────────────────────────────────────────────┐  │
                                  │  │  Write an update…                  [Send]  │  │  ← update composer (top)
                                  │  └────────────────────────────────────────────┘  │
                                  │  (AB) Alex Brown · 2h ago                        │  ← update entry
                                  │       Pushed the hero section, needs review.     │
                                  │       👍 2   💬 Reply                            │
                                  │  (CD) Casey Diaz · yesterday                     │
                                  │       Copy is final.                             │
                                  └──────────────────────────────────────────────────┘
                                   width ≈ 600–860px (≈ 40–60% of viewport)
```

- **Width:** roughly `600–860px` — a wide right-hand panel (~40–60% of viewport), NOT a tiny
  drawer. It can be expanded to a full "item page".
- **Opens from:** the **right edge**; the board stays visible/dimmed behind it. A scrim closes
  it; `Esc` closes it; an `⤢` expand control promotes it to a full page.
- **Header:** the **item name** as panel H1 (`20–24px / 700`, inline-editable) → action cluster
  on the right (`✎` edit, `⤢` expand, `⋯` more, `✕` close). Below the name: the **status pill**
  + lightweight context ("in: <group>").
- **Column-values summary:** a stacked **label → value** list of the item's column data
  (Owner avatars, Date, Priority pill, Numbers, …). Order follows the Main Table column order.
  Values are inline-editable.
- **Tabbed area** — tab strip with active tab underlined:
  - **Updates** — the threaded conversation. A **composer at the top**, then entries
    **newest-first**. Each entry: round avatar (left) + author name + relative timestamp on one
    line, the post body below, then a reaction/`👍` row and a `Reply` affordance. Replies nest.
  - **Files** — gallery/list of attachments on the item.
  - **Activity Log** — a chronological audit list, **most-recent-first**, filterable by person
    and by column. Each entry format: **`<avatar> <person>  <action>  <relative time>`** — e.g.
    "Alex Brown changed Status from *Working on it* to *Done* · 3h ago"; the changed values
    render as small pills inline.
  - **Info Boxes** — free-form rich text / item description.

**States**

- *Loading:* skeleton — a title bar, a few summary-line bars, a content block.
- *Empty Updates:* a friendly placeholder ("No updates yet — start the conversation").
- *Empty Activity Log:* "No activity recorded yet."

**Implement in ONEmonday.** `board-card-detail.tsx` already implements this as a `Sheet` from
`side="right"`, `sm:max-w-2xl` (~`672px`) — within Monday's width band. It already has: a
header with the bold title + action buttons (Edit / Escalate / Delete) + close; a meta line
(priority, group, date); a column-summary block (assignees, tags, cross-references); and a
`Tabs` strip — currently **Comentários / Checklists / Anexos / Atividade**. To match Monday:
(1) rename/reorder tabs toward **Updates / Files / Activity Log / Info** (Checklists can stay as
an ONEmonday extension); (2) the comments section already lists newest-first with avatar + name
+ relative time — add a `👍` reaction row and `Reply` nesting; (3) the `ActivityFeed` already
sorts most-recent-first — ensure entries render changed values as inline status pills; (4)
promote the column-values block to an editable **label→value summary** matching table column
order. The structure is already ~80% aligned.

---

## 7. Empty / loading / hover / selected states (consolidated)

| Surface | Empty | Loading | Hover | Selected / Active |
|---|---|---|---|---|
| **Board** | Centered illustration + "Add your first item" CTA | Skeleton header + skeleton rows/columns | — | — |
| **Kanban column** | Faint "No items" placeholder above `+ Add item` | 2–3 skeleton card rectangles | Header shows count + `⋯` menu | Drag-over: well tints blue + drop gap opens |
| **Kanban card** | n/a | Skeleton title bar + footer bar | Shadow deepens, border darkens, `⋯` menu + quick-edit appear, cursor `grab` | Dragging: lifts with shadow, source slot ~50% ghost; Selected: `2px` blue ring |
| **Table group** | Header + single `+ Add item` row | Skeleton rows | Item count appears on header | Collapsed: only header band visible |
| **Table row** | n/a | Skeleton cells (grey bars) | Faint grey bg, checkbox + action chevrons appear | Checkbox checked, light-blue tint, batch bar at screen bottom |
| **Item Card** | "No updates yet" / "No activity recorded" placeholders | Skeleton title + summary lines + content block | Inline fields highlight on hover | Editing field shows active input outline |

**Implement in ONEmonday.** The app already uses `Skeleton` (seen in `board-card-detail.tsx`)
and a droppable `isOver` tint in `board-column.tsx` (`bg-accent/50`). Standardize: every board
surface gets an explicit **empty state** (illustration + CTA), a **skeleton** loading state, a
**hover** affordance, and a **selected** treatment, per the table above. The Kanban drag-over
tint and card drag opacity already exist — extend the same rigor to the Table view (row hover,
row selection + batch bar) once `board-list-view.tsx` is restructured.

---

## Summary — card & board anatomy in one paragraph

A Monday **board** sits right of the sidebar under a **sticky two-row header**: Row 1 is board
name + view tabs, Row 2 is a far-left blue **`+ New Item`** button and a right-aligned
**Search / Person / Filter / Sort** cluster. The **Kanban view** is one ~`280px` neutral-grey
column well **per Status value**, each with a colored-dot header (label + count), `8px`-spaced
cards, a bottom `+ Add item` ghost row, and a `+ Add column` tile ending the track. A **Kanban
card** is a white `8px`-radius rectangle with a **`3–4px` colored LEFT border** (the accent —
*not* a top strip; a top strip appears only for a cover image), and top-to-bottom: optional
tag chips + a hover `⋯` menu top-right, the **item name** (`14px/600`, ≤2 lines), a values block
(**compact status pill**, date, numbers), and a footer with **`💬` updates count** + relation
count on the left and overlapping `24px` **assignee avatars** (max 3, `+N`) bottom-right. The
**Table/Main view** is a dense grid of items in **colored Groups** — each group a band with a
`3–4px` colored left edge carrying down every row, a caret + colored name + `N items` header,
and a bottom **summary row** (Numbers sum, Status distribution); rows are `36–40px` tall with a
leftmost **checkbox**, an inline-editable **item name** first cell, and typed cells where Status
is a **full-bleed colored fill** (vs. the card's hugging pill). The **Item Card** slides in from
the **right** (`600–860px` wide): header with the item name + status pill, a label→value column
summary, and a tab strip — **Updates** (composer on top, newest-first entries) / **Files** /
**Activity Log** (most-recent-first audit) / **Info**. Throughout: **color is data** (statuses,
group bands, avatars, accents), **chrome is neutral** (white/grey header, wells, card bodies).

---

## Sources

- [The Kanban View — Monday Support](https://support.monday.com/hc/en-us/articles/360000661379-The-Kanban-View)
- [The Cards View — Monday Support](https://support.monday.com/hc/en-us/articles/4405723870994-The-Cards-View)
- [The board views — Monday Support](https://support.monday.com/hc/en-us/articles/360001267945-The-board-views)
- [The basics of a board — Monday Support](https://support.monday.com/hc/en-us/articles/115005317249-The-basics-of-a-board)
- [The basics of groups — Monday Support](https://support.monday.com/hc/en-us/articles/360011472320-The-basics-of-groups)
- [The Status Column — Monday Support](https://support.monday.com/hc/en-us/articles/360001269685-The-Status-Column)
- [The Board Filters — Monday Support](https://support.monday.com/hc/en-us/articles/360003624660-The-Board-Filters)
- [The Item Card — Monday Support](https://support.monday.com/hc/en-us/articles/360017143959-The-Item-Card)
- [The item pop-up card — Monday Support](https://support.monday.com/hc/en-us/articles/360001568919-The-item-pop-up-card)
- [The Updates Section — Monday Support](https://support.monday.com/hc/en-us/articles/115005900249-The-Updates-Section)
- [The Activity Log — Monday Support](https://support.monday.com/hc/en-us/articles/115005310745-The-Activity-Log)
- [Conditional Coloring — Monday Support](https://support.monday.com/hc/en-us/articles/360015468399-Conditional-Coloring)
- [Monday.com Product Update: Introducing new board design](https://www.globalhrsoftware.com/thinking/monday-com-new-board-design)
- [Vibe design system — Monday Developer Docs](https://developer.monday.com/apps/docs/vibe-design-system)
- [Vibe Design System (site)](https://vibe.monday.com/)
- [mondaycom/vibe — GitHub](https://github.com/mondaycom/vibe)
- [Explanation of Cards View on monday.com](https://globalfinanceschool.com/explanation-of-cards-view-on-monday-com/)
- [The 19 Creative Types of Views on Monday.com — SimonSezIT](https://www.simonsezit.com/article/types-of-views-on-monday-com/)
- [Monday.com Kanban Features & Board Setup Guide — ToolStack](https://toolstackpm.com/tools/monday-com/features/kanban-boards)
