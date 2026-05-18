# UX Audit — CRM Module (Wave 4)

**Module:** CRM (`/crm`)
**Auditor:** Senior Product Designer / Front-end Engineer
**Date:** 2026-05-18
**Scope:** The CRM surfaces added or reworked **since Wave 3** — the lead lifecycle
(Leads inbox `/crm/leads`, capture Forms `/crm/forms`, lead scoring), the reworked
Activities screen (task management: pending vs. history), and the deal "Comunicação"
panel (WhatsApp/email). Companies, Contacts, Pipeline, Proposals and the CRM Dashboard
are re-checked only for **regressions or net-new issues**; items already documented in
`docs/research/ux-audit-crm.md` are not repeated unless they are still live and visible.
**Method:** Screenshots `screenshots/audit-wave4/admin/08–15` cross-referenced with
`apps/web/app/(dashboard)/crm/*`, `apps/web/components/crm/*`,
`apps/web/hooks/crm/*` and `apps/web/lib/validations/crm.ts`.

---

## Module summary & overall rating

Wave 4 closes most of the structural gaps Wave 3 flagged. Companies and Contacts now
have **list/table views, sortable headers, real filter bars** (porte, indústria, empresa,
"apenas principais") — directly addressing Wave 3 C2/C3/C4/CO2/CO3. Activities was
genuinely re-architected: it is no longer an append-only feed but a **"Tarefas pendentes"
vs. "Histórico" split** with overdue/today/upcoming counters and a per-task complete
toggle — Wave 3 A1/A2 resolved. And the module gained a real **inbound funnel**: a
scored Leads inbox, a no-code Forms builder with public capture URLs, and a deal
Communication panel that sends WhatsApp/email and threads them.

This is a strong wave. The lead lifecycle is conceptually competitive with RD Station
CRM (scored inbox → triage → qualify-to-deal) and the Forms builder is a credible
"capture leads without RD Station" play. The score breakdown in the lead sheet —
showing *why* a lead scored — is better than what most SMB CRMs surface.

What still holds the module back is **interaction polish on the new screens** and a few
**carried-over defects that were never actually fixed**:

- **The `all`/raw-value filter bug from Wave 3 (PR1) is still live and now multiplied.**
  Companies (`size`/`industry`), Contacts (`company`) and Leads (`source`) filter
  triggers all render the literal string `all` instead of a translated label —
  visible in screenshots 09, 10 and 14.
- **Loading states still leak.** The Dashboard (08) and Pipeline (11) screenshots are
  again captured mid-load showing only grey skeletons — the Wave 3 D1/full-page-gate
  problem was not addressed.
- **The Forms builder advertises drag-to-reorder it does not have** — a `GripVertical`
  handle is rendered on every field row but no reorder is wired.
- **No combobox anywhere.** The lead-qualify board/column pickers, the activity owner
  filter, and the lead-create dialog are still plain `<Select>`/`<Input>` — Wave 3's
  cross-cutting combobox finding is unresolved on the new screens too.
- **`window.confirm()`** is used to delete a form — inconsistent with the rest of the
  app and Wave 3's PR5 recommendation to use `AlertDialog`.

**Overall rating: 7.0 / 10** — up a full point from Wave 3's 6.0. The feature surface
is now genuinely competitive; the remaining gap is finish quality on the new screens and
a stubborn set of small, visible defects.

---

## Screen 1 — Leads Inbox (`/crm/leads`)

**Reference:** `screenshots/audit-wave4/admin/14-crm-leads.png` · code:
`crm/leads/page.tsx`, `components/crm/lead-detail-sheet.tsx`,
`components/crm/lead-create-dialog.tsx`, `lib/crm/lead-scoring.ts`

### What works

- A proper **scored inbox**: a 5-up KPI strip (Novos / Em trabalho / Qualificados /
  Descartados / Score médio) over a table with a colour-banded score badge, status
  badge, source and received date. Search + status + source filters + score/recent
  sort + "Limpar filtros" — a complete toolbar.
- The lead detail sheet is the strongest new surface in the module: it shows the
  **score breakdown rule-by-rule** (`scoreLead` re-derived client-side, matched rules
  in green with `+points`, unmatched struck through) and a clean triage flow
  (Iniciar trabalho → Qualificar / Descartar → Reabrir). "Qualificar" creates a contact
  + a pipeline deal in one action — the RD-Station "convert lead" pattern done well.
- Empty state is correct: `EmptyState` with an Inbox icon, a real explanation and a
  primary CTA (screenshot 14).

### Findings

| # | Impact | Finding | Market comparison & recommended fix |
|---|--------|---------|--------------------------------------|
| L1 | **High** | **The source filter renders the raw value `all`.** `sourceFilter`/`statusFilter` default to `"all"` but the trigger uses `<SelectValue placeholder="Origem" />` (`leads/page.tsx:199–201`); since `all` is a real selected value the placeholder never shows and the literal `all` is painted — visible in screenshot 14 (the left dropdown reads "all"). The status filter (`:183`) escapes this only because its `all` item is labelled "Todos os status"; the source filter's item label *is* the value. | This is the exact Wave 3 PR1 bug, unfixed and now on the new screen. The dropdown must show a translated label when `all` is selected — either give the trigger explicit content (`{sourceFilter === "all" ? "Toda origem" : sourceFilter}`) or render the value through a label map. Pipedrive/RD Station never show a raw enum token in a filter. |
| L2 | **High** | **Lead scoring is static and one-shot.** `scoreLead` scores from form payload + presence of email/phone/company only; there is no behavioural/engagement signal and no re-scoring after capture. The score never moves once the lead lands. | Best-practice scoring blends *fit* (ICP) **and** *interest* (intent signals — pages visited, emails opened, demo requests) and is continuously re-evaluated ([Salespanel](https://salespanel.io/blog/marketing/lead-scoring-best-practices/), [monday.com](https://monday.com/blog/crm-and-sales/lead-scoring-rules/)). At minimum, expose the scoring rules in settings so the sector can tune weights, and re-score on each new activity/communication logged against the lead. |
| L3 | **High** | **No lead owner / assignment and no SLA.** A lead has a status but no assignee; nothing routes a new lead to an SDR and nothing flags an un-triaged lead. The KPI strip counts "Novos" but a lead can sit there forever silently. | Modern lead management auto-assigns the lead to a rep (round-robin/territory) and expects first contact within 24h ([OnSilent](https://onsilent.com/non-classe/lead-management-best-practices/)). Add an `owner_id` on the lead, an assignment step (manual is fine for v1), and an "aging" indicator (e.g. red "há 3 dias sem contato") on rows whose `created_at` exceeds an SLA. |
| L4 | **Medium** | **The "Novo lead" dialog has no validation feedback and a free-text "Origem".** `lead-create-dialog.tsx` only requires `name`; email is `type="email"` but there is no inline error, and "Origem" is a raw text input so every typo ("Site", "site", "website") becomes a distinct filter bucket — `sourceOptions` is built from distinct values, so the source filter list pollutes immediately. | Make "Origem" a `<Select>` over a known source enum (manual / formulário / indicação / evento / outro). It keeps the inbox's source filter and the Forms `source` field consistent. |
| L5 | **Medium** | **The qualify flow's board/column pickers are unsearchable and the board is name-matched.** `lead-detail-sheet.tsx:73–82` finds the pipeline board by substring (`crm`/`pipeline`/`vendas`) — the same fragile magic-string coupling Wave 3 flagged (P5). If no board matches, `boardId` seeds empty and the user must pick from a plain `<Select>` of *all* boards. | Carry the Wave 3 P5 fix here: let the sector designate its pipeline board in settings and default the qualify dialog to it. The board picker should not list non-CRM boards. |
| L6 | **Low** | **No bulk triage.** Rows are single-click-to-open only; you cannot multi-select to discard a batch of junk leads or assign several at once. | RD Station and HubSpot both support bulk lead actions. Add row checkboxes + a bulk "Descartar" / "Atribuir" toolbar (mirrors the bulk-action recommendation Wave 3 made for Companies/Contacts). |
| L7 | **Low** | **The detail sheet's score breakdown has no qualitative cue.** It lists rules but the header badge (`{score} · {band}`) is the only signal of "is this lead good". A non-analytical SDR sees numbers. | Add a one-line verdict ("Lead quente — priorize contato hoje") keyed off the band, as RD Station's lead score colour-codes intent. |

---

## Screen 2 — Lead-capture Forms (`/crm/forms`)

**Reference:** `screenshots/audit-wave4/admin/15-crm-forms.png` · code:
`crm/forms/page.tsx`, `components/crm/lead-form-builder-dialog.tsx`,
`components/crm/public-lead-form.tsx`

### What works

- A genuine no-code capture builder: card grid of forms with a Publicado/Rascunho
  badge, field count, lead count, a publish `Switch`, "Copiar URL", "Abrir", Editar,
  Excluir. The builder dialog supports 5 field types, required toggles, select options,
  auto-derives a safe `key` from the label, and validates distinct keys / non-empty
  select options. The public form (`public-lead-form.tsx`) has a **honeypot**, inline
  422 field errors, a success message and a connection-error fallback — solid.
- Empty state (screenshot 15) is correct and on-message ("sem depender do RD Station").

### Findings

| # | Impact | Finding | Market comparison & recommended fix |
|---|--------|---------|--------------------------------------|
| F1 | **High** | **The builder shows a drag handle that does nothing.** Every field row renders `<GripVertical>` (`lead-form-builder-dialog.tsx:273`) but there is no drag, no `onDragStart`, no move-up/down buttons — field order is fixed to insertion order. The affordance actively lies to the user. | HubSpot's form builder is drag-and-drop reorder by default ([HubSpot Forms](https://www.hubspot.com/products/marketing/forms)). Either wire reorder (`@dnd-kit`, or simple up/down buttons for v1) or **remove the grip icon** so it does not promise an interaction that is not there. |
| F2 | **High** | **No conditional logic and no field-to-CRM mapping.** Every field is unconditional, and submitted values land only in the lead `payload` blob (rendered raw key/value in the lead sheet). A "telefone" field does not populate the lead's `phone`; a "empresa" field does not populate `company`. | HubSpot's differentiator is conditional logic ("if Country = US show State") and mapping form fields to CRM properties ([INSIDEA](https://insidea.com/blog/hubspot/kb/how-to-use-conditional-logic-in-hubspot-forms/)). At minimum add field-to-lead mapping (mark which field feeds name/email/phone/company) so scoring and the inbox columns are populated, not buried in `payload`. |
| F3 | **Medium** | **Delete uses `window.confirm()`.** `forms/page.tsx:81` — `if (!confirm(...))`. This is a native browser dialog, unstyled, untranslatable beyond the string, and inconsistent with the `AlertDialog` used elsewhere. Wave 3 explicitly recommended `AlertDialog` for destructive CRM actions (PR5). | Replace with the app's `AlertDialog`. A published form with `lead_count > 0` should additionally warn that the public URL will stop working. |
| F4 | **Medium** | **No submission analytics and no preview.** The card shows `lead_count` but no view count, so conversion rate is unknowable; and the builder has no "preview" of the public form — you must publish, copy the URL and open it to see what visitors get. | Add a view counter → conversion-rate figure (table-stakes for any form tool) and a live preview pane in the builder dialog. |
| F5 | **Low** | **"Origem dos leads" is a free-text input** (`lead-form-builder-dialog.tsx:221`), same pollution risk as L4 — and it is decoupled from the Leads inbox source filter. | Use a shared source enum across the form builder and the lead-create dialog. |
| F6 | **Low** | **The public form page is minimally branded/accessible.** `public-lead-form.tsx` renders bare fields; there is no logo, no description text from `form.description`, and the submit button has no loading spinner beyond a label swap. The honeypot label is correctly off-screen, good. | Render `form.description` above the fields, allow a sector logo, and confirm the public route sets `lang="pt-BR"`. |

---

## Screen 3 — Activities (`/crm/activities`)

**Reference:** `screenshots/audit-wave4/admin/13-crm-activities.png` · code:
`crm/activities/page.tsx`, `lib/crm/activity-tasks.ts`,
`components/crm/activity-create-dialog.tsx`

### What works

- The Wave 3 A1/A2 findings are **resolved**: the screen now splits "Tarefas pendentes"
  vs. "Histórico", has Atrasadas/Hoje/Próximas counter cards, a per-task complete circle
  toggle with `toast` feedback, and an overdue task gets a red border + "Atrasada" badge.
  `bucketActivity`/`countOpenTasks` give a clean scheduled/overdue/done model.
- The filter row is real: segmented type filter + a Responsável select + De/Até date
  inputs + "Limpar". CSV export carries the scheduled/completed columns.
- pt-BR is correct throughout ("Reuniões", "Atividades") — the Wave 3 diacritics
  defects on this screen are fixed.

### Findings

| # | Impact | Finding | Market comparison & recommended fix |
|---|--------|---------|--------------------------------------|
| A1 | **Medium** | **The Responsável filter shows raw `all`.** `activities/page.tsx:330–333` — `<SelectValue />` with no placeholder and `ownerFilter` defaulting to `"all"`; the `all` item is labelled "Todos" so it survives by luck, but the empty `<SelectValue />` will paint nothing until a value is set and the pattern is fragile. Screenshot 13 shows the trigger reading "all". | Same root cause as L1/PR1. Give the trigger an explicit displayed value. This is one shared fix across Leads/Companies/Contacts/Activities. |
| A2 | **Medium** | **Tasks cannot be edited or rescheduled, only completed.** A pending task with a wrong `scheduled_at` (e.g. the "Preparar ambiente de POC" task in screenshot 13, overdue) can only be checked done or left rotting — there is no "remarcar" / edit. | Pipedrive lets you reschedule an activity inline from the list. Add an edit affordance (open the create dialog pre-filled) and a quick "adiar 1 dia" on overdue tasks. |
| A3 | **Medium** | **No task creation pre-linked from a deal/contact, and the deal/contact/company on a history entry are still plain text.** History entries print "Deal: …", "Contato: …" as text (`activities/page.tsx:502–509`) — Wave 3 A6 ("make entity references links") is unfixed. | Make the references navigate to the deal sheet / contact sheet. The detail sheets should also offer "Nova tarefa" pre-linked (Wave 3 C7/CO4). |
| A4 | **Low** | **No pagination/virtualisation on the history feed** — `useActivities` loads everything (Wave 3 A4 unresolved). With one task in the demo it is invisible, but the feed grows unbounded. | Infinite-scroll or paginate the Histórico tab. |
| A5 | **Low** | **The three counter cards and the tab both show counts** ("Tarefas pendentes (1)" duplicates Atrasadas+Hoje+Próximas). Minor redundancy; the counter cards are not clickable to filter. | Make the Atrasadas / Hoje / Próximas cards act as quick filters on the pending list. |

---

## Screen 4 — Deal Communication panel ("Comunicação")

**Reference:** no standalone screenshot — rendered inside the deal detail sheet · code:
`components/crm/deal-communication-panel.tsx`, `hooks/crm/use-activities.ts`

### What works

- A real conversation surface: WhatsApp + email activities threaded oldest-first as
  chat bubbles (inbound left / outbound right, channel + direction icons, timestamp),
  with three composer modes — Enviar WhatsApp, Enviar e-mail, Registrar e-mail.
- Honest demo-mode handling: when the WhatsApp/Resend adapter is unconfigured the
  mutation returns `noop` and the toast says "modo demo" rather than faking a send.
- Recipient fields pre-fill from the linked contact's phone/email.

### Findings

| # | Impact | Finding | Market comparison & recommended fix |
|---|--------|---------|--------------------------------------|
| K1 | **High** | **No templates / canned messages.** Every WhatsApp and email is composed from scratch in a bare `<Textarea>`. A sales rep sending the same follow-up 20×/day has no saved snippets and no variable insertion (`{{nome}}`, `{{empresa}}`). | RD Station CRM's in-deal WhatsApp ships message templates; HubSpot has email snippets/sequences. Add a template picker per channel with merge fields from the linked contact/deal. The Support module already has "canned responses" — reuse that pattern. |
| K2 | **Medium** | **No delivery/read status on sent messages.** A sent WhatsApp/email bubble looks identical whether it was delivered, failed, or is still pending — only a toast at send time tells the user. The thread has no per-message state. | Show a per-bubble status (enviado / entregue / lido / falhou). Even without WhatsApp read receipts, a "falha no envio" state on the bubble is essential — a toast is gone after 4s. |
| K3 | **Medium** | **The composer is unvalidated and easy to misfire.** WhatsApp `to` is a free-text phone with no format mask/validation (`+55 11 99999-9999` is only a placeholder); a malformed number just fails server-side. The email composer has no character/subject guidance. | Add a phone mask and basic E.164 validation before enabling "Enviar"; the deal sheet should warn when the contact has no phone/email at all rather than presenting an empty composer. |
| K4 | **Low** | **No attachments and no thread search.** Email is plaintext-only; a long thread has no way to jump to a message. | Acceptable for v1, but flag: proposals/contracts are the natural attachment on a deal email. |
| K5 | **Low** | **Thread bubbles are not keyboard-focusable and have no semantic roles** — they are plain `<div>`s. A screen-reader user gets an undifferentiated run of text. | Wrap the thread in a `role="log"`/list with each message a list item; mark inbound/outbound in accessible text, not only icon direction. |

---

## Screen 5 — Companies (`/crm/companies`) — re-check

**Reference:** `screenshots/audit-wave4/admin/09-crm-companies.png` · code:
`crm/companies/page.tsx`

Wave 3 CO2/CO3 are **resolved**: a grid/table toggle, sortable `SortHeader` columns
(Nome/Indústria/Cidade/Contatos), and a porte + indústria filter bar with "Limpar
filtros". CSV export respects the active filter.

| # | Impact | Finding | Market comparison & recommended fix |
|---|--------|---------|--------------------------------------|
| CO-W4-1 | **High** | **Both filter triggers show raw `all`.** `companies/page.tsx:181` and `:197` use `<SelectValue placeholder="Porte" />` / `placeholder="Indústria"` while `sizeFilter`/`industryFilter` default to `"all"` — screenshot 09 shows two dropdowns literally reading **"all"** and **"all"**. This is the most visible defect in the wave. | Identical fix to L1/A1: render "Todo porte" / "Toda indústria" when `all` is selected. One shared `FilterSelect` wrapper would fix every instance. |
| CO-W4-2 | **Medium** | **Still no edit/delete from the UI** (Wave 3 CO1). The detail sheet was not re-checked here but the page passes no `company` to `CompanyFormDialog` and the grid/table rows only open the read sheet. | Confirm the detail sheet now exposes Editar/Excluir; if not, this remains the highest-value/lowest-effort fix (Wave 3 backlog #1). |
| CO-W4-3 | **Low** | **No bulk selection** on the new table view (Wave 3 CO2 partially addressed — table exists, checkboxes do not). | Add row checkboxes + bulk export/delete now that a table view exists. |
| CO-W4-4 | **Low** | Accented data is inconsistent — "TechNova Solucoes", "Sao Paulo", "Head de Inovacao" in seed data (screenshots 09/10). Display defect of the data, not the UI, but it reads as broken pt-BR. | Fix seed data; not a code issue. |

---

## Screen 6 — Contacts (`/crm/contacts`) — re-check

**Reference:** `screenshots/audit-wave4/admin/10-crm-contacts.png` · code:
`crm/contacts/page.tsx`

Wave 3 C2/C3/C4 **resolved**: grid/table toggle, sortable headers, company filter +
"Apenas principais" toggle.

| # | Impact | Finding | Market comparison & recommended fix |
|---|--------|---------|--------------------------------------|
| C-W4-1 | **High** | **The Empresa filter trigger shows raw `all`** — `contacts/page.tsx:177` `<SelectValue placeholder="Empresa" />`, `companyFilter` defaults `"all"`. Screenshot 10 confirms the left dropdown reads "all". Same shared bug. | Same shared fix. |
| C-W4-2 | **Low** | **Email/phone are still plain text, not `mailto:`/`tel:` links** (Wave 3 C6 unresolved) — visible on every card in screenshot 10. | Make them actionable links; in a CRM the contact card is the launchpad for outreach. |
| C-W4-3 | **Low** | The card grid clips the last row (screenshot 10 shows "Thiago Nascimento" half-cut). The table view mitigates this, but grid remains the default. | Consider table as the default once contacts exceed ~9, or paginate the grid. |

---

## Screen 7 — CRM Dashboard & Pipeline — regression check

**Reference:** `screenshots/audit-wave4/admin/08-crm-dashboard.png`,
`11-crm-pipeline.png`

Both screenshots are **again captured mid-load**: the Dashboard shows 4 grey KPI
skeletons + 1 large grey block; the Pipeline shows a header skeleton + a 12-cell grey
grid. `crm/page.tsx` still gates the whole page on `dealsLoading || statsLoading`.

| # | Impact | Finding | Recommended fix |
|---|--------|---------|------------------|
| DP-W4-1 | **High** | **Wave 3 D1 (full-page skeleton gate) is unfixed.** The dashboard still blocks every widget until both `useDeals` and `useCRMStats` resolve. Two consecutive Wave 3→4 captures landing mid-load is itself evidence of slow, all-or-nothing first paint. | Per-widget loading: KPI tiles paint on `stats`, the funnel on `deals`. This was Wave 3 backlog #5 and remains open. |
| DP-W4-2 | **Medium** | The dashboard still has no period selector and no leads/forms KPIs — the new inbound funnel (leads received, conversion to deal) is invisible on the CRM home. | Add a "Leads" KPI row (novos / qualificados / taxa de conversão) and the Wave 3 D2 period selector. |
| DP-W4-3 | **Low** | The new Leads tab is wired into the CRM tab bar (screenshot 08 shows Dashboard / Leads / Formulários / Pipeline / Propostas / Contatos / Empresas / Atividades — 8 tabs). 8 tabs is the upper bound of comfortable; "Formulários" arguably nests under "Leads". | Consider grouping Leads + Formulários, or a slight visual separation between the pipeline-of-record tabs and the inbound tabs. |

---

## Cross-cutting issues (Wave 4)

1. **The `all` raw-value filter bug is systemic** — Leads (source), Companies (porte,
   indústria), Contacts (empresa) and Activities (responsável) all paint the literal
   string `all`. It is the single most visible defect in the wave and is the *same*
   bug Wave 3 logged as PR1 for Proposals. **One shared `FilterSelect` component** that
   maps `all`→a label would kill every instance.
2. **No combobox on the new screens** — lead-qualify board/column pickers, the activity
   owner filter, form-builder field-type select are all plain `<Select>`; the
   lead-create "Empresa"/"Origem" are free-text. Wave 3's cross-cutting combobox
   recommendation was not extended to Wave 4 surfaces.
3. **`window.confirm()` for form deletion** — inconsistent with the app's `AlertDialog`;
   Wave 3 (PR5) already asked for styled confirmations.
4. **Loading still gates whole pages** — Dashboard and Pipeline (DP-W4-1).
5. **Lying affordance** — the Forms builder drag handle (F1).
6. **The inbound funnel is disconnected from the deal funnel** — form fields don't map
   to lead properties (F2), leads have no owner/SLA (L3), and none of it surfaces on
   the CRM Dashboard (DP-W4-2). The lifecycle works but is not yet *measured*.

---

## Prioritized backlog (value / effort)

| Rank | Item | Screens | Impact | Effort |
|------|------|---------|--------|--------|
| 1 | Shared `FilterSelect` — map `all` to a translated label everywhere | Leads, Companies, Contacts, Activities, Proposals | High | Low |
| 2 | Remove or wire the Forms builder drag handle | Forms | High | Low–Med |
| 3 | Replace `window.confirm()` form-delete with `AlertDialog` | Forms | Medium | Low |
| 4 | Per-widget loading on the CRM Dashboard (Wave 3 D1 carryover) | Dashboard | High | Med |
| 5 | Field-to-lead-property mapping in the Forms builder | Forms, Leads | High | Med |
| 6 | Lead owner + assignment + aging/SLA indicator | Leads | High | Med |
| 7 | Message templates / merge fields in the Communication panel | Deal sheet | High | Med |
| 8 | Per-bubble delivery/failure status in the Communication thread | Deal sheet | Medium | Med |
| 9 | Make "Origem" a shared source enum (form builder + lead create + filter) | Leads, Forms | Medium | Low |
| 10 | Editable/reschedulable tasks; clickable entity references | Activities | Medium | Med |
| 11 | Form submission analytics (views → conversion rate) + builder preview | Forms | Medium | Med |
| 12 | Leads KPIs + period selector on the CRM Dashboard | Dashboard | Medium | Med |
| 13 | Tunable lead-scoring rules + re-scoring on new activity | Leads | High | High |
| 14 | Bulk triage on the Leads inbox; bulk actions on Companies/Contacts tables | Leads, Companies, Contacts | Medium | Med |
| 15 | `mailto:`/`tel:` links on contact cards (Wave 3 C6 carryover) | Contacts | Low | Low |

---

## Quick wins

- **Fix the `all` filter label** — Leads/Companies/Contacts/Activities all visibly show
  the raw token `all`; one `FilterSelect` wrapper fixes the most embarrassing defect in
  the wave. (Rank 1)
- **Remove the dead drag handle** in the Forms builder — it promises reorder that does
  not exist. (Rank 2)
- **Swap `window.confirm()` for `AlertDialog`** on form delete — one component swap,
  consistency with the rest of CRM. (Rank 3)
- **Make "Origem" a select**, not a free-text input, in both the lead-create dialog and
  the form builder — stops source-bucket pollution in the inbox filter. (Rank 9)
- **Add a one-line lead verdict** in the score breakdown ("Lead quente — contate hoje")
  keyed off the existing band — pure copy, no new data. (L7)

---

## Sources

- [Lead Scoring Best Practices — Salespanel](https://salespanel.io/blog/marketing/lead-scoring-best-practices/)
- [Lead scoring rules — monday.com](https://monday.com/blog/crm-and-sales/lead-scoring-rules/)
- [8 Essential Lead Management Best Practices for 2025 — OnSilent](https://onsilent.com/non-classe/lead-management-best-practices/)
- [How to set up Lead Scoring rules — RD Station help](https://ajuda.rdstation.com/s/article/How-to-set-up-Lead-Scoring-rules?language=en_US)
- [HubSpot Forms — Free Online Form Builder](https://www.hubspot.com/products/marketing/forms)
- [How to Use Conditional Logic in HubSpot Forms — INSIDEA](https://insidea.com/blog/hubspot/kb/how-to-use-conditional-logic-in-hubspot-forms/)
- [CRM Best Practices for Lead Scoring & Qualification — Nimble](https://www.nimble.com/blog/crm-best-practices-for-lead-scoring-qualification/)
- Wave 3 baseline: `docs/research/ux-audit-crm.md`
