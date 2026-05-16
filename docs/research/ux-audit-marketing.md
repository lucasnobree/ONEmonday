# UX Audit — Marketing Module

**Module:** Marketing (`/marketing`)
**Auditor:** Senior Product Designer (ux-auditor standard)
**Date:** 2026-05-15
**Scope:** Visão Geral (dashboard), Campanhas, Calendário Editorial, Audiências
**Evidence:** `screenshots/audit/admin/33-marketing-dashboard.png`, `34-marketing-campaigns.png`, `35-marketing-calendar.png`, `36-marketing-audiences.png`; source under `apps/web/app/(dashboard)/marketing`, `apps/web/components/marketing`, `apps/web/hooks/marketing`, `apps/web/lib/marketing`, `apps/web/lib/actions/marketing`, `apps/web/lib/validations/marketing.ts`.

---

## Module summary & overall rating

The Marketing module is a clean, competently built four-tab planning tool: a KPI dashboard with two channel charts, a campaign register (budget/spend/leads/conversions), an editorial content calendar, and a reusable audience-segment library. The engineering is solid — pure metric helpers with a unit test (`metrics.test.ts`), a timezone-safe calendar grid, integer-cents money handling shared with Finance, server-side permission checks on every action (`hasPermission(... "campaign", ...)`), and a server-computed summary RPC that enforces sector access. Localization is pt-BR throughout and empty states are written with care.

However, against best-in-class marketing products it is **a tracking ledger, not a marketing workspace**. It records numbers a human types in; it does not *do* marketing. There is no execution (no email/post composer, no publishing, no ad-platform sync), no filtering or search on any list, no campaign attribution to CRM contacts/deals, no derived performance metrics surfaced in the UI (CPL, CPA, ROI, CTR all exist in `metrics.ts` but only `conversionRate` and `budgetUsagePercent` are shown), and the calendar — the screen users will touch most — has no drag-and-drop, which both Buffer and HubSpot treat as table stakes.

**Overall rating: 6.0 / 10** — Good code hygiene and a coherent IA, but shallow functionality and missing list/calendar interactions keep it well below the products it's compared against.

All four screenshots were captured on an empty tenant (zeros everywhere), so this audit leans heavily on the source to assess populated-state behaviour.

---

## Screen 1 — Visão Geral (Dashboard)

**Screenshot:** `33-marketing-dashboard.png`
**Code:** `app/(dashboard)/marketing/page.tsx`, `components/marketing/channel-charts.tsx`, `hooks/marketing/use-marketing-summary.ts`, `lib/marketing/metrics.ts`

### What works
- Four KPI cards (Campanhas Ativas, Gasto/Orçamento, Leads Gerados, Taxa de Conversão) with sensible icons and a secondary hint line; budget-usage tone turns red over 100% — a good signal.
- Two charts (spend pie, leads-vs-conversions grouped bars) computed server-side by `get_marketing_summary`, with their own per-chart empty states ("Sem gastos registrados por canal.").
- Real loading skeletons (`h-28` card stubs + `h-72` chart stub), and a correct guard when no sector is selected.
- pt-BR number formatting via `toLocaleString("pt-BR")` and `formatCents`.

### Findings

**F1 — Dashboard surfaces only 2 of 6 available metrics. (High)**
`metrics.ts` already implements `leadRate` (CTR), `costPerLead`, `costPerConversion` and `isOverBudget`, all unit-tested, but the dashboard renders only `conversionRate` and `budgetUsagePercent`. A marketing lead's first questions are "what did a lead cost me?" and "what's my ROI?" HubSpot's Overall Marketing Performance dashboard leads with CPL, CPA and influenced revenue across the funnel. *Recommendation:* add "Custo por Lead" and "Custo por Conversão" KPI cards (the functions are done — this is wiring only), and an over-budget alert badge driven by `isOverBudget`.

**F2 — No time-range or channel filter on the dashboard. (High)**
The summary RPC takes only `p_sector_id`; the page shows lifetime totals with no way to scope to "this month" / "last 90 days" or to a single channel. Every comparator (HubSpot Campaign Analytics, Mailchimp reports) opens with a date-range picker. *Recommendation:* add a date-range control and pass `from`/`to` into `get_marketing_summary`; optionally a channel multi-select.

**F3 — Pie chart with no labels or percentages. (Medium)**
`SpendByChannelChart` renders a `<Pie>` with no `label`/`labelLine` and only a `<Legend>` — slice values are visible only on hover, which fails on touch and for keyboard users. *Recommendation:* add percentage labels on slices (e.g. `label={({percent}) => ...}`) or switch to a horizontal bar chart, which reads spend comparisons more accurately than area.

**F4 — "Campanhas Recentes" table is read-only and not navigable. (Medium)**
Rows show name/channel/spend/leads/status but are not links and have no row actions — a user who spots a problem campaign must change tab and re-find it. Columns also can't be sorted. *Recommendation:* make rows link to the campaign (or open the edit dialog) and right-align numeric columns.

**F5 — Charts not keyboard/screen-reader accessible. (Medium)**
recharts SVG charts carry no `role`, `aria-label` or text alternative; a screen-reader user gets nothing from "Gasto por Canal". *Recommendation:* wrap each chart in a labelled region and provide a visually-hidden data table fallback.

**F6 — KPI card icons are decorative but not marked as such. (Low)**
`<stat.icon>` lucide SVGs need `aria-hidden`. Minor, but consistent with the rest of the app's a11y gaps.

---

## Screen 2 — Campanhas

**Screenshot:** `34-marketing-campaigns.png`
**Code:** `app/(dashboard)/marketing/campaigns/page.tsx`, `components/marketing/campaign-form-dialog.tsx`, `lib/actions/marketing/campaigns.ts`, `lib/validations/marketing.ts`

### What works
- Clear empty state with megaphone icon and an actionable sentence.
- "Nova Campanha" primary button top-right; create/edit share one dialog (`CampaignFormDialog`).
- Each row is information-dense but readable: name, channel · spend/budget (usage %), leads · conv., status badge, Editar/Excluir.
- The form re-seeds cleanly on open via the `seededKey` pattern; numeric fields validated as non-negative integers both client-side and in the Zod schema; `endDate >= startDate` enforced by a `.refine`.
- Server action checks auth + `campaign` permission and soft-deletes (`is_active = false`).

### Findings

**F7 — No filtering, search, or sorting on the campaign list. (High)**
The page maps `campaigns` straight to rows. With 30+ campaigns this becomes an unscannable wall ordered only by `start_date desc`. HubSpot's campaign manager offers filter-by-status/owner/type and search; Mailchimp filters by status and date. *Recommendation:* add a status filter (segmented control or `Select`), a channel filter, and a text search — all client-side over the already-loaded array, so low effort.

**F8 — Destructive delete with no confirmation. (High)**
`handleDelete` calls `deleteCampaign.mutateAsync(id)` immediately on click — one click silently soft-deletes a campaign carrying budget and results, with only a toast afterward. *Recommendation:* wrap in an `AlertDialog` ("Excluir campanha? Esta ação remove X de Y."). The codebase already has the dialog primitives.

**F9 — Campaign is a dead end — no detail view. (High)**
A campaign has no page of its own: no timeline, no list of linked content items, no contact/lead attribution. The content calendar links items to a campaign (`campaign_id`) but the campaign never shows them back. HubSpot's central premise is the campaign as a hub that aggregates assets and *influenced contacts/deals/revenue*. *Recommendation:* add `/marketing/campaigns/[id]` showing linked content, derived metrics (CPL/CPA/CTR/ROI) and — connecting to the CRM module — attributed leads.

**F10 — Manual metric entry is error-prone and untrustworthy. (Medium)**
Impressions, leads and conversions are free `type="number"` inputs the user types by hand; nothing prevents `conversions > leads` or `leads > impressions` (only non-negativity is checked). For paid channels, leaders sync these from Google/Meta Ads automatically. *Recommendation:* short-term, add cross-field validation (`conversions ≤ leads ≤ impressions`); longer-term, an ad-platform integration to remove manual entry on `paid_ads`.

**F11 — Channel/Status `<Select>` triggers have no visible label association. (Medium)**
In `campaign-form-dialog.tsx` the "Canal" and "Status" `<Label>` elements have no `htmlFor`, and the `SelectTrigger` has no `id`/`aria-labelledby` — the label is purely visual. Same pattern in the content and segment dialogs. *Recommendation:* give each trigger an `id` and point the `Label` at it (or add `aria-label`).

**F12 — Currency assumed BRL with no field. (Medium)**
`Campaign` has a `currency` column but the form never exposes it; `formatCents` hard-codes pt-BR/BRL. Fine for a single-country tenant, but the data model implies multi-currency that the UI can't reach. *Recommendation:* either surface a currency select or drop the column to avoid silent mismatch.

**F13 — No bulk actions, pagination, or export. (Low)**
Long lists can't be multi-selected, paged or exported to CSV — standard in Mailchimp/HubSpot campaign tables. Low priority until volume grows.

**F14 — No campaign objective/type or owner field. (Low)**
The model has channel and status but no objective (awareness / lead-gen / retention) and no owner. HubSpot and Marketo organise reporting around campaign type and owner. *Recommendation:* consider an `objective` enum and an owner reference for richer roll-ups.

---

## Screen 3 — Calendário Editorial

**Screenshot:** `35-marketing-calendar.png`
**Code:** `app/(dashboard)/marketing/calendar/page.tsx`, `components/marketing/content-calendar.tsx`, `components/marketing/content-form-dialog.tsx`, `lib/marketing/calendar.ts`

### What works
- Correct month grid: whole weeks starting Sunday, timezone-safe date strings (`buildMonthGrid`), padding days dimmed at `opacity-40`, today's cell highlighted with a filled circle.
- Per-cell hover "+" to add content on a specific date — a nice low-friction affordance — and content items render as colour-dotted (`CHANNEL_COLORS`) clickable chips that open the edit dialog.
- Prev/next month buttons carry `aria-label`s ("Mês anterior" / "Próximo mês").
- The content form can pre-fill the scheduled date from the clicked cell (`defaultDate`) and optionally link to a campaign.

### Findings

**F15 — No drag-and-drop rescheduling. (High)**
To move a post one day, a user must click the chip, open the dialog, change the date field, and save — 4 interactions for what is a single drag in Buffer ("drag and drop them to the desired new time and date") and in HubSpot's calendar. For the screen marketers live in, this is the single biggest usability gap. *Recommendation:* implement drag-to-reschedule on the chips, calling `updateContentItem` with the new `scheduled_date`.

**F16 — Month view only — no week, list, or agenda view. (High)**
`ContentCalendar` is hard-wired to a month grid. Buffer offers Week/Month toggle; HubSpot offers month/week/list. In month view a busy day overflows: cells are `min-h-24` with unbounded `space-y-1` chips, so a day with 6+ items pushes the whole row tall and there is no "+3 mais" affordance. *Recommendation:* add a Week and a List view, and cap chips per cell with an overflow counter.

**F17 — No filtering by channel, status, or campaign. (High)**
Every content item for the sector renders regardless of channel or status; there is no legend and no filter. Buffer filters the calendar by platform and uses colour-coded tags; comparators all let you focus the calendar. *Recommendation:* add channel/status/campaign filter chips plus a visible colour legend (the `CHANNEL_COLORS` map is unused as a legend today).

**F18 — Calendar is not keyboard-navigable. (Medium)**
Day cells aren't focusable; you can't arrow between days or press Enter to add. Chips are `<button>`s (good) but the grid has no roving-tabindex. *Recommendation:* make cells focusable with arrow-key navigation and `role="grid"` semantics.

**F19 — Content status is invisible on the calendar. (Medium)**
A chip shows only a channel-colour dot + title; whether an item is "Ideia", "Rascunho", "Agendado" or "Publicado" — the editorial workflow's whole point — is not visible without opening it. *Recommendation:* encode status as a small badge or chip opacity/border, and consider colouring by status with channel as a secondary cue.

**F20 — Page header duplicates the month controls' heading area. (Low)**
`calendar/page.tsx` renders an `<h2>Calendário Editorial</h2>` and `ContentCalendar` then renders its own `<h2>{monthLabel}</h2>` — two `<h2>`s stacked. The screenshot shows "Calendário Editorial" then "Maio De 2026". Minor hierarchy/`capitalize` quirk ("Maio De 2026" — the `capitalize` class title-cases the preposition "de"). *Recommendation:* demote the month label to a non-heading or merge the two rows; format the label without capitalising "de".

**F21 — No way to jump to "today" / current month. (Low)**
Only prev/next stepping exists; navigating back from December requires repeated clicks. *Recommendation:* add a "Hoje" button next to the chevrons.

---

## Screen 4 — Audiências

**Screenshot:** `36-marketing-audiences.png`
**Code:** `app/(dashboard)/marketing/audiences/page.tsx`, `components/marketing/segment-form-dialog.tsx`, `lib/actions/marketing/segments.ts`

### What works
- Responsive card grid (1 / 2 / 3 columns) with name, channel badge, optional description and an "estimated contacts" figure formatted pt-BR.
- Friendly empty state and a clear "Nova Audiência" action.
- Same disciplined form pattern: required name, channel select, non-negative integer size, Zod-validated server action with permission check and soft delete.

### Findings

**F22 — "Audience" is a label with a hand-typed number, not a real segment. (High)**
A segment here is name + channel + a free-typed `estimated_size`. There are no criteria, no rules, no linkage to CRM contacts — so the count is a guess that immediately goes stale and can't be acted on. Mailchimp and HubSpot define audiences as *queryable segments* over real contact data with a live count. *Recommendation:* connect segments to the CRM module — define a contact-filter rule and compute the size — or, minimally, rename the field "Tamanho estimado (manual)" and add a "última atualização" date so users know it's a snapshot.

**F23 — No filtering or search on the audience list. (Medium)**
Consistent with Campanhas (F7): cards render unfiltered, ordered by name. With many segments there's no channel filter or search. *Recommendation:* add a channel filter + text search over the loaded array.

**F24 — Delete has no confirmation. (Medium)**
Same pattern as F8 — `handleDelete` removes a segment on a single click. *Recommendation:* `AlertDialog` confirmation.

**F25 — Segments aren't selectable when creating a campaign. (Medium)**
The whole value of a reusable segment library is reuse, but `CampaignFormDialog` has no audience field — a campaign can't target a saved segment. Audiences are an isolated island. *Recommendation:* add an audience multi-select to the campaign form (and surface "alcance planejado" on the dashboard).

**F26 — `<Select>` label not associated (Medium, shared)** — same `htmlFor`/`id` gap as F11 in `segment-form-dialog.tsx`.

---

## Cross-cutting findings

- **C1 — No global error states (High).** Every hook does `if (error) throw error`, but no page has an error boundary or inline error UI — a failed Supabase query renders nothing or crashes. Empty/loading states are handled well; the error state is missing across all four screens.
- **C2 — Tab bar isn't a real tablist (Medium).** `marketing/layout.tsx` builds the Visão Geral / Campanhas / Calendário / Audiências switcher from `<Link>`s with no `role="tablist"`/`role="tab"`/`aria-selected`. It looks like tabs (shadcn tab styling) but is announced as plain links.
- **C3 — Inconsistent list presentation (Low).** Campanhas uses a borderless stacked list, the dashboard uses an HTML `<table>`, Audiências uses cards. Three patterns for three lists. Pick one (a `DataTable`) for scannability and sortability.
- **C4 — No activity log / audit trail (Medium).** Campaigns track `created_by`/`created_at` but no edit history; budget and result numbers can be silently overwritten with no record.
- **C5 — Per-sector access is correct (Good).** Every query filters `.eq("sector_id", sectorId)`; every server action re-checks `hasPermission(perms, sectorId, ...)`; the summary RPC enforces sector access server-side. A sector manager's scoped view is correct and useful — the data they see is properly limited to their sector. The only gap is that read access isn't role-gated in the UI beyond sector selection, which is consistent with the rest of the app.

---

## Market comparison summary

| Capability | ONEmonday Marketing | HubSpot Marketing | Mailchimp | Marketo | Buffer |
|---|---|---|---|---|---|
| Campaign register w/ budget & results | Yes (manual) | Yes (auto-attributed) | Yes | Yes | — |
| Derived metrics in UI (CPL/CPA/ROI/CTR) | No (computed but unused) | Yes | Yes | Yes | Partial |
| Date-range / channel filtering | No | Yes | Yes | Yes | Yes |
| Campaign detail / attribution to contacts | No | Yes (core) | Yes | Yes | — |
| Content calendar | Month grid only | Month/week/list | — | — | Week/Month |
| Drag-and-drop reschedule | No | Yes | — | — | Yes |
| Audience = queryable segment | No (typed number) | Yes | Yes (core) | Yes | — |
| Content execution / publishing | No | Yes | Yes (email) | Yes | Yes (core) |

The module is positioned as lightweight planning, which is reasonable for an internal ops platform — but even within "planning only," the leaders provide filtering, multiple calendar views, drag-and-drop, and live segment counts, all of which ONEmonday lacks.

Sources:
- [HubSpot — Manage all of your marketing campaigns](https://www.hubspot.com/products/marketing/campaigns)
- [HubSpot — Marketing Analytics software](https://www.hubspot.com/products/marketing/analytics)
- [HubSpot Knowledge Base — Analyze ad campaigns](https://knowledge.hubspot.com/ads/analyze-ad-campaigns-in-hubspot)
- [MarTech — 15 HubSpot updates from February 2026](https://martech.org/15-hubspot-updates-from-february-2026-you-dont-want-to-miss/)
- [Buffer Help Center — How to use the calendar feature](https://support.buffer.com/article/651-how-to-use-the-new-calendar-feature-on-buffer)
- [Buffer — Introducing a New Social Media Calendar](https://buffer.com/resources/new-social-media-calendar/)

---

## Prioritized backlog (value / effort)

| # | Improvement | Impact | Effort | Findings |
|---|---|---|---|---|
| 1 | Add delete confirmation dialogs (campaigns, segments, content) | High | Low | F8, F24 |
| 2 | Surface CPL & CPA KPI cards + over-budget alert (functions already exist) | High | Low | F1 |
| 3 | Add status/channel/search filters to Campanhas, Audiências & Calendar | High | Low–Med | F7, F17, F23 |
| 4 | Add error states / boundaries to all four screens | High | Low–Med | C1 |
| 5 | Drag-and-drop rescheduling on the content calendar | High | Med | F15 |
| 6 | Date-range picker on the dashboard (extend `get_marketing_summary`) | High | Med | F2 |
| 7 | Campaign detail page `/campaigns/[id]` with linked content + derived metrics | High | Med–High | F9 |
| 8 | Add Week/List calendar views + per-cell overflow counter | High | Med | F16 |
| 9 | Connect segments to CRM contacts for a live count (or mark size as manual snapshot) | High | High | F22 |
| 10 | Cross-field metric validation (conversions ≤ leads ≤ impressions) | Medium | Low | F10 |
| 11 | Fix Select label associations + tablist roles + chart a11y | Medium | Low | F5, F11, F18, F26, C2 |
| 12 | Pie-chart slice labels; make dashboard table rows navigable | Medium | Low | F3, F4 |
| 13 | Show content status on calendar chips; add "Hoje" button | Medium | Low | F19, F21 |
| 14 | Link audiences into the campaign form (target selection) | Medium | Med | F25 |
| 15 | Unify list presentation into one sortable DataTable | Low | Med | C3 |

**Top 5 to do first:** delete confirmations (#1), CPL/CPA cards (#2), list filters (#3), error states (#4), and calendar drag-and-drop (#5) — together they remove the most painful daily friction and the riskiest data-loss path for the least engineering cost, with only #5 requiring real effort.
