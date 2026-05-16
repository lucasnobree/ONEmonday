# UX Audit — Analytics, Dev-Tools & Settings

**Auditor:** Senior Product Designer
**Date:** 2026-05-15
**Scope:** Analytics, Dev-Tools and Settings (Geral / Perfil / Administração) admin screens
**Method:** Screenshot review + source-code review of `app/(dashboard)`, `components`, `hooks`, `lib` and `validations`. Market comparison via web research. Analysis only — no application code was changed.

---

## Module summary & overall ratings

| Area | Rating | One-line verdict |
|---|---|---|
| Analytics | **6.0 / 10** | Clean KPI scaffold and a governed metric catalog, but only 3 reportable metrics, no export, no drill-down, no comparison and one global filter. |
| Dev-Tools | **5.5 / 10** | Solid 5-tab CRUD for incidents/services/deploys/flags, but every list is unfiltered/unsorted/unpaginated, deletes have no confirmation, and the workflow leaders' core feature (timeline / acknowledge) is absent. |
| Settings | **6.5 / 10** | Coherent 3-tab layout and good inline feedback, but a duplicated read-only profile card, no avatar upload, no role editing/removal of members and no destructive-action guardrails. |

The three areas share one common strength — consistent shadcn-based layout, pt-BR copy, skeleton loaders — and three common weaknesses: **(1) no confirmation dialogs for destructive actions, (2) inconsistent diacritics in copy ("Configurações" vs "Administracao", "Relatorios"), (3) thin or missing list-management affordances (filter / sort / search / pagination).**

---

## SCREEN 1 — Analytics

**Screenshot:** `screenshots/audit/admin/06-analytics.png`
**Code:** `app/(dashboard)/analytics/page.tsx`, `components/analytics/*`, `hooks/analytics/*`, `lib/analytics/*`

### What works
- Clear visual hierarchy: 3 headline KPI cards (Cards Concluídos, Valor de Negócios Ganhos, Tickets Resolvidos) with period-over-period delta badges, then 5 secondary KPIs (Cards Abertos, Negócios Abertos, Tickets Abertos, SLA Violados, Colaboradores).
- A **governed metric catalog** (`lib/analytics/metrics.ts`) — every KPI and report resolves label/unit/module from one typed registry; this is the Looker "define a KPI once" pattern done correctly.
- Currency is correctly formatted in BRL from integer cents via `Intl.NumberFormat("pt-BR")` (`R$ 32.000,00`); counts use pt-BR thousands grouping.
- Delta logic in `kpi.ts` is sound: handles `previous === 0` as `—` ("novo"), colours favourable/unfavourable, and supports a per-metric `higherIsBetter`.
- Loading is handled with skeletons; a genuine empty state exists for saved reports with an icon and explanatory copy.

### Findings

**F1 — Only 3 metrics are reportable; the 8 dashboard KPIs cannot become reports. (High)**
The dashboard shows 8 KPIs, but `METRIC_KEYS` exposes only `cards_completed`, `deals_won_value_cents`, `tickets_resolved`. SLA Violados, Colaboradores, Cards/Negócios/Tickets Abertos cannot be charted or saved as reports — a visible dead end. Metabase/Looker users expect every visible number to be clickable/explorable.
*Recommendation:* Expand the catalog to cover all 8 KPIs (plus `sla_breaches`, `headcount`) and back them with `get_analytics_trend` metric branches.

**F2 — No data export. (High)**
There is no CSV/XLSX/PNG export on KPIs or report charts. Metabase ships per-card "Download results" as CSV/XLSX/JSON ([Metabase docs](https://www.metabase.com/docs/latest/questions/exporting-results)); Mixpanel and Looker do the same. For an Analytics module this is table-stakes.
*Recommendation:* Add a "Exportar CSV" action on each `ReportCard` and an "Exportar" on the dashboard header (CSV of all KPIs for the selected range).

**F3 — The date-range filter is the *only* filter and is not linked to reports. (High)**
`DateRangeFilter` re-scopes the 8 KPIs, but each saved report carries its own fixed `date_range_days` and ignores the global control. Metabase's strongest usability win is one dashboard filter that re-scopes *every* card, including linked filters ([Metabase dashboard filters](https://www.metabase.com/docs/latest/dashboards/filters)). There is also no filter by status/priority/assignee/service even though `group_by` already supports `status` and `priority`.
*Recommendation:* Make the header range optionally drive report cards (a "usar período do painel" toggle per report) and add at minimum a status/owner filter row.

**F4 — No drill-down / no comparison view. (Medium)**
KPI cards and charts are static. There is no click-through from "Tickets Resolvidos: 4" to the underlying tickets, and no way to compare two periods or two sectors side by side. Metabase auto-attaches a drill-through menu to query-builder charts; Mixpanel offers cohort/segment breakdowns.
*Recommendation:* Make KPI cards link to the source module pre-filtered to the range; add a "vs. período anterior" overlay series on line/bar charts.

**F5 — Custom range is impossible; only 5 rolling presets. (Medium)**
`RANGE_PRESETS` is `7d/30d/90d/180d/365d`. There is no custom start/end date, no "este mês"/"trimestre" calendar option, and the report form asks for a raw integer "Período (dias)" which is a poor input for non-technical users.
*Recommendation:* Add a date-range picker (calendar) alongside the presets; in the report dialog replace the number field with the same preset selector.

**F6 — `group_by` is collected but the chart never uses it. (Medium)**
The report form lets users pick "Agrupar por: Dia/Semana/Mês/Status/Prioridade", but `useAnalyticsTrend` always returns a monthly bucket series (`TrendPoint.bucket`) and `ReportChart` plots it verbatim. Selecting "Status" or "Prioridade" silently has no effect — a broken promise in the UI.
*Recommendation:* Either pass `group_by` to the RPC and honour it, or remove the options that are not implemented until the backend supports them.

**F7 — Pie chart of a time series is misleading. (Medium)**
`ReportChart` renders `chartType === "pie"` over the monthly trend series — a pie of 12 monthly buckets is not a meaningful visualization (parts of a whole vs. time). It also has no legend and no labels on slices.
*Recommendation:* Restrict "Pizza" to categorical group-bys (status/priority) only; hide it for time grouping.

**F8 — Charts lack axis titles, units and accessible summaries. (Low)**
`ReportChart` line/bar charts have no Y-axis label, no chart title inside the SVG, and recharts output is not screen-reader friendly. The "kpi" chart type shows a raw bucket string (e.g. an ISO month) as its caption.
*Recommendation:* Add axis labels, format the kpi caption via a date formatter, and add an `aria-label`/visually-hidden data table fallback.

**F9 — Saved reports have no ownership, sharing or scheduling. (Low)**
Reports are sector-scoped only — no "criado por", no private/shared toggle, no scheduled email digest. Metabase/Looker treat scheduled delivery as core.
*Recommendation:* Show creator + created date on `ReportCard`; consider a later "enviar por email" schedule.

**F10 — Inconsistent diacritics in copy. (Low)**
"Relatorios Salvos", "Novo Relatorio", "metrica", "periodo" appear without accents while the rest of the app (sidebar "Configurações", "Jurídico") is accented. Inconsistent within one screen.
*Recommendation:* Normalize to correct pt-BR: "Relatórios Salvos", "Novo Relatório", "métrica", "período".

### Per-sector access
The page scopes every query to `currentSector.id` and shows a clean "Selecione um setor" guard when none is chosen. A sector manager correctly sees only their sector — good. However there is no all-sectors / company-wide roll-up for a global admin, which Looker/Metabase users would expect from an exec dashboard.

---

## SCREEN 2 — Dev-Tools

**Screenshot:** `screenshots/audit/admin/32-dev-tools.png`
**Code:** `app/(dashboard)/dev-tools/page.tsx`, `components/dev-tools/*`, `hooks/dev-tools/*`, `lib/dev-tools/*`

### What works
- A clear 5-tab structure (Visão Geral, Incidentes, Serviços, Deploys, Flags) — matches how Linear/Sentry/LaunchDarkly segment these concerns.
- Overview KPIs are well chosen: Incidentes Abertos, SEV1 Abertos, Serviços com Falha, Deploys (7 dias), Flags Ativas, **MTTA médio**, **MTTR médio** — the MTTA/MTTR metrics are the right PagerDuty-grounded headline numbers.
- `incident-metrics.ts` is genuinely good: pure, tested, clamps clock skew, returns `null` cleanly, and `resolveLifecycleTimestamps` stamps `acknowledged_at`/`resolved_at` on status transitions.
- Feature-flag rows have an inline `Switch` for instant enable/disable with optimistic-style toast error handling and a proper `aria-label`.
- Badge variants are centralized in `labels.ts` so severity/health/status colours stay consistent across dashboard, lists and dialogs.

### Findings

**F11 — Every list is unfiltered, unsorted, unsearchable and unpaginated. (High)**
Incidents/Services/Deploys/Flags each render `(items ?? []).map(...)` directly. There is no filter by severity/status/environment, no sort, no text search, no pagination. Linear and Sentry make incident/issue filtering and saved views central. With more than ~20 rows this becomes unusable, and the most urgent SEV1 may be buried.
*Recommendation:* Add a filter bar per tab (status/severity/environment/service) and sort (default: open + by `severityWeight`, then date). `severityWeight()` already exists in `incident-metrics.ts` and is currently unused for sorting.

**F12 — Delete has no confirmation. (High)**
`RowActions` "Excluir" on incidents and services calls `deleteIncident/deleteService.mutateAsync` immediately on click — one mis-click destroys a record with only a toast. No `AlertDialog`, no undo.
*Recommendation:* Wrap deletes in a confirm `AlertDialog` ("Excluir incidente? Esta ação não pode ser desfeita"), or add an undo toast.

**F13 — No incident timeline / acknowledge action — the core workflow of the leaders. (High)**
PagerDuty's incident page centres on a Timeline tab and a one-click **Acknowledge** that claims ownership and halts escalation ([PagerDuty incidents](https://support.pagerduty.com/main/docs/incidents)). Here an incident is only a row with title/severity/status; `acknowledged_at`/`resolved_at` exist in the data model but the only way to set them is to change the status dropdown in the edit dialog. There is no timeline, no comments/updates, no assignee UI, no post-mortem.
*Recommendation:* Add an incident detail view with a status timeline, an explicit "Reconhecer" / "Resolver" button, an assignee picker (`assignedTo` is already in the schema but absent from the dialog), and an updates feed.

**F14 — Deploys and Flags rows have no delete; only Incidents/Services do. (Medium)**
`RowActions` (Edit + Delete) is used for incidents and services, but Deploys and Flags only get a bare "Editar" `Button`. Inconsistent — a user cannot remove an erroneous deploy record or retire a stale flag from the list.
*Recommendation:* Use a consistent row-action set; for flags consider "archive" instead of hard delete (LaunchDarkly archives flags).

**F15 — Overview tab has no recent-activity feed and no links into the tabs. (Medium)**
The Visão Geral screenshot is just 7 stat cards over a large empty canvas. There is no "incidentes recentes", no "últimos deploys", and the cards are not clickable to jump to the relevant tab. PagerDuty's on-call dashboard surfaces an open-incidents list and an incidents/changes timeline directly.
*Recommendation:* Make each stat card link to its tab pre-filtered (e.g. "SEV1 Abertos" → Incidentes filtered to sev1+open), and add a recent-incidents / recent-deploys list below the cards.

**F16 — Deploys are decoupled from incidents (no change-correlation). (Medium)**
Deploys and incidents are separate lists with no link. A leading dev-tools product correlates "deploy X likely caused incident Y" (Sentry release health, PagerDuty change events). There is also no rollback action on a deploy row.
*Recommendation:* Allow linking an incident to a suspected deploy; add a "Reverter" affordance that creates a `rolled_back` deploy.

**F17 — Feature flags lack targeting, environments-per-flag and audit. (Medium)**
A flag has a single environment + a single `rollout_percentage` integer. LaunchDarkly's value is per-environment targeting rules, segments, and a change history. There is no audit of who toggled a flag or when, despite toggling being instant and high-impact.
*Recommendation:* At minimum log flag toggles (who/when) and surface them; longer term, allow a flag to span environments with distinct rollout values.

**F18 — MTTA/MTTR computed client-side from the loaded incident list, not server-side. (Low)**
`summarizeIncidents` runs over `useIncidents` data, which fetches *all* active incidents for the sector with no limit. The dashboard stat RPC (`get_dev_tools_dashboard_stats`) does not return MTTA/MTTR, so the page must load the full incident list to compute them. This will not scale and can disagree with a filtered list view.
*Recommendation:* Move MTTA/MTTR into the dashboard RPC.

**F19 — Incident severity/status pickers offer no colour cue; dates show no time. (Low)**
In the dialogs the severity/status `Select` items are plain text; the badge colour (which conveys urgency) only appears after saving. `fmtDate` shows `dd/mm/yyyy` only — for an incident, the *time* matters. There is no relative time ("há 2h").
*Recommendation:* Render a colour dot in the select items; show date+time (and relative time) on incident rows.

### Per-sector access
All five queries are scoped by `currentSector.id` with a proper "Selecione um setor" guard. A Dev sector manager sees only their sector's incidents/services — correct. Note there is no cross-sector incident view for a global admin, and no permission gate visible on this page (unlike Settings, which uses `PermissionGate`) — an Analyst could create/delete incidents; verify that is intended.

---

## SCREEN 3 — Settings: Geral

**Screenshot:** `screenshots/audit/admin/37-settings.png`
**Code:** `app/(dashboard)/settings/page.tsx`

### What works
- Tab strip (Geral / Perfil / Administração) rendered as a segmented control, only shown to global admins — sensible progressive disclosure.
- The notification matrix is the highlight: a clean `Evento × [In-app | Email]` grid with column headers, a separator, and per-toggle inline save with success/error toast and **optimistic revert on failure**.
- `channelToFlags` / `flagsToChannel` cleanly map a 4-state channel enum to two checkboxes — good model.
- Permission-gated with `PermissionGate` (`settings:read`) and a clear fallback message.

### Findings

**F20 — The "Perfil" card here duplicates the Perfil tab and is read-only. (Medium)**
Settings/Geral shows a read-only Perfil card (Nome, Email) that is a strict subset of the editable Settings/Perfil page. Two places showing the same data, one of them inert, is confusing.
*Recommendation:* Replace the read-only card with a compact summary that links to the Perfil tab ("Editar perfil →"), or drop it.

**F21 — No "salvar tudo" affordance and no per-row labels for the toggles. (Low)**
Each toggle saves independently (good for feedback) but the two switches per row have no accessible name tied to the channel — `Switch` here has no `aria-label` (unlike the Dev-Tools flag switch). A screen-reader user hears "switch" twice per row with no "In-app"/"Email" context.
*Recommendation:* Add `aria-label={`${nt.label} — In-app`}` / `Email` to each switch.

**F22 — Toast on every single toggle is noisy. (Low)**
Toggling 5 events × 2 channels fires up to 10 "Preferência salva" toasts. Leading SaaS settings show a single subtle "Salvo" or an inline checkmark.
*Recommendation:* Debounce/suppress the success toast (keep the error toast), or show an inline saved indicator.

**F23 — Notification matrix is fixed to 5 hard-coded card events. (Low)**
`NOTIFICATION_TYPES` is a const of 5 card events. There is nothing for CRM (negócio ganho/perdido), Support (SLA), Dev-Tools (incidente SEV1) etc. — a gap as the platform grows.
*Recommendation:* Group events by module and source the list from the same place the notification system uses, so they cannot drift.

**F24 — Diacritic inconsistency: page title "Configurações" but other settings pages use "Administracao", "informacoes". (Low)**
*Recommendation:* Normalize all settings copy to correct pt-BR.

---

## SCREEN 4 — Settings: Administração

**Screenshot:** `screenshots/audit/admin/38-settings-admin.png`
**Code:** `app/(dashboard)/settings/admin/page.tsx`

### What works
- "Membros do Setor" is a readable table (Nome / Email / Papel) with a role `Badge`, column headers and a separator.
- "Convidar Usuário" is a tidy inline form: email input + role `Select` + submit, with `disabled` until both fields are filled, a spinner during the request, and success/error toasts.
- Roles in the invite `Select` are ordered by `level` (hierarchy-aware).

### Findings

**F25 — Members are completely non-editable: no role change, no removal, no resend invite. (High)**
The members table is read-only. A sector admin cannot change a member's role, remove a member, or see/cancel pending invites. Standard SaaS admin (e.g. typical team-settings) always offers a per-row "..." menu with Change role / Remove / Resend.
*Recommendation:* Add a per-row action menu (Alterar papel, Remover do setor) and a "Convites pendentes" section with resend/cancel.

**F26 — Invite has no client-side email validation feedback and no duplicate check. (Medium)**
`handleInvite` only trims and checks non-empty; `type="email"` gives the browser a hint but there is no inline error, and inviting an already-member email surfaces only as a server toast.
*Recommendation:* Validate email format inline before enabling submit; warn if the email already belongs to a sector member.

**F27 — No search/filter on the member list. (Medium)**
The list renders all members unfiltered. For a large sector this is hard to scan. There is also no count ("7 membros").
*Recommendation:* Add a search box and a member count; consider sort by name/role.

**F28 — Two users share the email `admin@onemonday.local`/`admin@onemonday.com` pattern and the screenshot shows "Admin" and "Lucas Nobre" both as Administrador — no last-active or status column. (Low)**
There is no "última atividade", no pending/active status, no avatar — the table is minimal.
*Recommendation:* Add avatar + status (Ativo / Convite pendente) columns.

**F29 — Page title "Administracao" / copy "configuracoes", "Voce", "permissao" lack diacritics. (Low)**
*Recommendation:* Normalize to "Administração", "configurações", "Você", "permissão".

### Per-sector access
The page is correctly gated by `PermissionGate` with `settings:manage` and a clear fallback for users without permission. Members are scoped to `currentSector.id`. A sector manager would manage only their own sector — correct. There is no global "all sectors / all users" admin view, which a global admin would likely expect (org-level user management).

---

## SCREEN 5 — Settings: Perfil

**Screenshot:** `screenshots/audit/admin/39-settings-profile.png`
**Code:** `app/(dashboard)/settings/profile/page.tsx`

### What works
- Two well-separated cards: "Informações Pessoais" and "Alterar Senha".
- Email field is correctly `readOnly`/`disabled` with a muted background — clear that it cannot be changed here.
- Password card validates client-side (min 8 chars, confirmation match) and disables the submit until valid; both forms use `useTransition` with a spinner and success/error toasts.
- Optimistic local update of `profile` state after a successful save.

### Findings

**F30 — Avatar is a raw URL text field, not an upload. (Medium)**
"URL do Avatar" expects the user to paste `https://exemplo.com/avatar.png`. No upload, no preview, no current-avatar thumbnail. Every mainstream SaaS profile page offers drag-and-drop image upload with a crop/preview.
*Recommendation:* Replace with a file upload (Supabase Storage) showing the current avatar and a preview; keep URL as an advanced fallback if needed.

**F31 — No password-strength meter and no "senha atual" confirmation. (Medium)**
Changing the password requires only a new password ≥ 8 chars — it does not ask for the current password. Re-authentication before a password change is a standard security expectation.
*Recommendation:* Require current password (or recent re-auth); add a strength meter and a show/hide toggle.

**F32 — No "alterações não salvas" guard and no dirty-state indication. (Low)**
Editing "Nome completo" then navigating away loses changes silently; "Salvar Alterações" is always enabled even when nothing changed.
*Recommendation:* Disable the save button until the form is dirty; warn on navigation with unsaved changes.

**F33 — Password change does not sign the user out of other sessions / no confirmation of effect. (Low)**
After a successful change the user only sees a toast. No mention of other sessions.
*Recommendation:* State whether other sessions are revoked; offer "encerrar outras sessões".

**F34 — Diacritic inconsistency: "Informacoes Pessoais", "informacoes", "Salvar Alteracoes", "Minimo", "obrigatorio". (Low)**
*Recommendation:* Normalize all to correct pt-BR.

### Per-sector access
The Perfil page is per-user, not per-sector, so it is correctly the same for a sector manager and a global admin. No issue.

---

## Prioritized backlog (by value / effort)

| # | Finding | Impact | Effort | Area |
|---|---|---|---|---|
| 1 | F12 — Add confirmation dialog (or undo) to Dev-Tools deletes | High | Low | Dev-Tools |
| 2 | F11 — Filter / sort / search on all Dev-Tools lists (reuse `severityWeight`) | High | Med | Dev-Tools |
| 3 | F25 — Make sector members editable (change role / remove / pending invites) | High | Med | Settings |
| 4 | F2 — CSV export for KPIs and report charts | High | Med | Analytics |
| 5 | F1 — Expand metric catalog so all 8 dashboard KPIs are reportable | High | Med | Analytics |
| 6 | F13 — Incident detail with timeline + Acknowledge/Resolve + assignee | High | High | Dev-Tools |
| 7 | F3 / F5 — Link report cards to the dashboard range; add custom date picker | Med | Med | Analytics |
| 8 | F6 — Honour `group_by` in trend RPC, or remove unimplemented options | Med | Med | Analytics |
| 9 | F15 — Make Dev-Tools overview cards clickable + add recent-activity feed | Med | Med | Dev-Tools |
| 10 | F30 / F31 — Avatar upload + current-password requirement on Perfil | Med | Med | Settings |
| 11 | F14 — Consistent row actions (delete/archive) for Deploys & Flags | Med | Low | Dev-Tools |
| 12 | F20 — Remove duplicated read-only Perfil card on Settings/Geral | Med | Low | Settings |
| 13 | F10 / F24 / F29 / F34 — Normalize pt-BR diacritics across all 5 screens | Low | Low | All |
| 14 | F21 / F22 — Accessible labels on notification toggles; debounce success toasts | Low | Low | Settings |
| 15 | F7 / F8 — Restrict pie to categorical group-bys; add axis labels/a11y to charts | Low | Low | Analytics |

### Quick wins (high value, low effort): #1, #11, #12, #13.
### Strategic bets (high value, higher effort): #6 (incident timeline) and #4/#5 (export + full metric coverage) — these close the largest gaps against the market leaders.

---

## Sources
- [Metabase — Exporting results](https://www.metabase.com/docs/latest/questions/exporting-results)
- [Metabase — Dashboard filters](https://www.metabase.com/docs/latest/dashboards/filters)
- [Metabase — BI dashboard best practices](https://www.metabase.com/learn/metabase-basics/querying-and-dashboards/dashboards/bi-dashboard-best-practices)
- [PagerDuty — Incidents](https://support.pagerduty.com/main/docs/incidents)
- [PagerDuty — Navigate the Incidents Page](https://support.pagerduty.com/main/docs/navigate-the-incidents-page)
- [PagerDuty — Analytics Dashboard](https://support.pagerduty.com/main/docs/analytics-dashboard)
