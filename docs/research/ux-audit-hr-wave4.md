# UX Audit — HR Module, Wave 4 (new screens)

**Module:** `apps/web/app/(dashboard)/hr` — RH (Recursos Humanos)
**Date:** 2026-05-18
**Scope:** Wave 4 covers what HR gained since the Wave 3 audit (`docs/research/ux-audit-hr.md`):
the recruitment ATS pipeline, performance management (`/hr/performance` — ciclos, 9-box, PDI),
engagement/climate surveys (`/hr/surveys`), offboarding checklists (`/hr/offboarding`), the
re-built top-down org chart, headcount/turnover analytics on the dashboard, and the time-off
balance guard. Screens already fixed since Wave 3 are noted but not re-litigated.
**Method:** Screen-by-screen review of `screenshots/audit-wave4/admin/16–24`, cross-referenced
with the route/component source under `app/(dashboard)/hr` and `components/hr`. Market
comparison against Sólides, Gupy, BambooHR and Factorial.

---

## What Wave 3 fixed (confirmed in code/screenshots)

For context, several Wave 3 high-priority items are now resolved and should **not** be re-reported:

- **Time-off `policyId` bug** — fixed. `time-off-request-dialog.tsx:55,166–177` now has a real
  política `Select` and sends the chosen `policyId`; the balance column resolves correctly.
- **Native `prompt()`/`confirm()`** — replaced. Time-off reject is a styled `Dialog`
  (`time-off/page.tsx:302–337`); offboarding uses `ConfirmDialog` (`offboarding/page.tsx:335,501`).
- **Negative-balance guard** — added. Request dialog shows an over-balance warning + explicit
  opt-in checkbox; approval routes through an "Saldo insuficiente" confirmation dialog.
- **Dashboard KPI deep-links** — added. All four stat cards are now `Link`s
  (`hr/page.tsx:184–197`).
- **Org chart** — rebuilt as a top-down boxed chart with connectors, search, expand/collapse,
  department filter that keeps ancestors, and a count.
- **Recruitment** — `AddCandidateDialog`, `CandidateDetailSheet` and stage-move now exist.
- **Time-off filter label** — `STATUS_FILTER_LABELS` renders "Todos" instead of raw `all`.

---

## Module summary & overall rating

Wave 4 roughly doubles the module's surface area and the new screens are built to the same
clean visual standard as the rest of ONEmonday. The data models are credible — review cycles
with evaluation counts, a real 9-box helper, anonymous surveys with eNPS aggregation,
offboarding templates with overdue detection, headcount/turnover analytics. Several Wave 3
defects are genuinely fixed.

The remaining gaps are about **depth and discoverability rather than broken plumbing**. The
new screens are functionally thin compared with Sólides/Gupy/BambooHR: performance has no
self-assessment or 360 feedback and no calibration; surveys cannot be targeted, scheduled, or
segmented and the "anonymous" guarantee is undermined by an open "Responder" button on an
admin screen; recruitment still has no job-board/application capture and no scorecard
aggregate; the dashboard added analytics but pushed compliance (expiring documents) further
below the fold. Empty states are good; loading states are consistent; the weak spots are
**accessibility on custom interactive elements** and **a few pt-BR/format inconsistencies**.

**Overall rating: 6.5 / 10** — a solid, coherent expansion. No data-corruption defects this
wave, but the new modules are MVP-depth and a handful of usability/a11y issues hold them back.

---

## Screen 1 — Dashboard (`16-hr-dashboard.png`)

`app/(dashboard)/hr/page.tsx`

### What works
- KPI cards are now actionable `Link`s (Wave 3 fix confirmed).
- New "Headcount e Rotatividade" card: 4 sub-metrics (headcount atual, contratações,
  desligamentos, rotatividade) with a net-change sentence and up/down arrow. Good addition,
  matches what BambooHR/Factorial put on an HR home.
- Skeletons per card; sensible empty states; birthday→anniversary fallback retained.

### Findings

**[Medium] The 12-month analytics window is unlabelled and not adjustable.** The card says
"Últimos 12 meses" but turnover %, hires and exits are locked to a hard-coded `12`
(`hr/page.tsx:58`). BambooHR and Factorial let the user switch period (quarter / YTD / 12m)
and Factorial's engagement dashboards are filterable by team. *Fix:* add a period toggle
(3/6/12m) bound to the `useHeadcountAnalytics` argument.

**[Medium] "Rotatividade 0%" with 5 hires / 0 exits reads as a dead metric.** Turnover renders
`(turnover_rate ?? 0)` with no tooltip explaining the formula or the denominator. A reader
cannot tell whether 0% means "healthy" or "no data". *Fix:* add a hint ("0 desligamentos em
12 colaboradores") or a small info tooltip with the calculation, as Factorial does.

**[Medium] Compliance is buried.** "Documentos Vencendo" is the last card in a six-card
2-column grid — below headcount analytics it now sits even further down. An expired/expiring
labour document is a higher-urgency item than birthdays. This was flagged in Wave 3 as Low;
adding the analytics card made it worse. *Fix:* promote "Documentos Vencendo" to the top row
beside the KPIs, or surface an expiring-doc count as a fifth KPI.

**[Low] Widget rows still don't deep-link.** "Onboardings Ativos" and "Documentos Vencendo"
rows are static text; `/hr/onboarding` and the employee profile sheet already exist to receive
a click. Wave 3 finding still open. *Fix:* wire rows to their detail target.

**[Low] No "Desempenho" or "Pesquisas" presence on the dashboard.** Two whole new modules
exist but the home screen shows nothing about active review cycles or open surveys / latest
eNPS. *Fix:* add an "Avaliações em andamento" and/or "eNPS atual" tile.

---

## Screen 2 — Colaboradores (`17-hr-employees.png`)

`app/(dashboard)/hr/employees/page.tsx`

### What works
- Filter triggers now show friendly labels ("Todos os status", "Todos os departamentos") —
  Wave 3 bug fixed.
- Clean table, search, CSV export, rich profile sheet.

### Findings

**[Medium] Header count still mismatches the dashboard.** Card title reads
"Colaboradores (12)" while the dashboard KPI shows 11 — the table counts terminated employees,
the KPI doesn't. Wave 3 finding, still open. *Fix:* label the table count ("12 de 12") or
align both to active headcount.

**[Low] Future admission date not flagged.** Ana Carolina Ribeiro shows admissão 18/05/2026
(today) and Bruno Almeida 19/05/2025 — fine — but a future-dated hire still renders as plain
"Ativo" with no "Futuro/Pré-admissão" tag. Carried from Wave 3. *Fix:* a small tag for hire
dates in the future.

**[Low] No column sorting.** Carried from Wave 3; tolerable at 12 rows.

*(Self-service profile and photos remain a known Wave 3 roadmap item — not re-scored.)*

---

## Screen 3 — Recrutamento (`18-hr-recruitment.png`)

`app/(dashboard)/hr/recruitment/page.tsx`, `recruitment-board-sheet.tsx`,
`add-candidate-dialog.tsx`, `candidate-detail-sheet.tsx`

### What works
- The Wave 3 dead-end is gone: `AddCandidateDialog` adds candidates, `CandidateDetailSheet`
  shows the full schema (email, phone, LinkedIn, origem, pretensão salarial — formatted as
  BRL currency), and a stage `Select` moves candidates through the pipeline.
- Interview notes with a 1–5 rating, timestamped, are a genuine scorecard primitive.
- Good empty states for both "no openings" and "no candidates".

### Findings

**[High] The Vagas list still has no search, filter, or sort and no row actions.** The screen
is just "Nova Vaga" + a 7-column table (`recruitment/page.tsx:48–125`). A filled vaga
("Analista de Suporte Técnico Pleno", status Preenchida, 0 candidatos) cannot be edited,
reopened, or closed from the UI, and there is no status filter. Gupy and BambooHR treat the
openings list as a managed pipeline with status filters and per-row actions. *Fix:* add a
status filter (Aberta/Fechada/Preenchida/Cancelada) and a row menu (editar / mudar status).

**[Medium] Pipeline lives only inside a side sheet — no full kanban and no drag-and-drop.**
The board is a horizontally-scrolling set of columns inside an `sm:max-w-3xl` Sheet
(`recruitment-board-sheet.tsx:43,69`). Moving a candidate requires: open vaga → open candidate
sheet → change stage `Select` (3 clicks + a nested sheet). Gupy's kanban supports direct
drag-between-columns and a list/kanban toggle. *Fix:* promote the board to a full page route
and add drag-and-drop stage moves.

**[Medium] Candidate detail shows no scorecard summary and no resume.** Notes list raw 1–5
ratings but there is no average, no per-interviewer view, and `resume_url`/CV upload is absent
from `CandidateDetailSheet` even though candidates have a resume field elsewhere in the schema.
Every reference ATS surfaces an aggregate score and the CV. *Fix:* show an average rating
badge in the header and a "Currículo" link/upload.

**[Medium] "Candidatos 0" on a Preenchida vaga.** A position marked filled with zero tracked
candidates implies the hire bypassed the pipeline — the same data-integrity smell flagged in
Wave 3. Reinforces that closing a vaga should optionally link the hired candidate.

**[Low] No application capture / careers surface.** Candidates can only be entered manually by
HR. Gupy's core value is a public job page that feeds the pipeline. Note as a scope gap.

**[Low] Stage `Select` on the candidate sheet has no confirmation or undo.** Selecting a value
fires `moveMutation` immediately (`candidate-detail-sheet.tsx:165`); an accidental click on
"Reprovado" is irreversible from the UI.

---

## Screen 4 — Onboarding (`19-hr-onboarding.png`)

`app/(dashboard)/hr/onboarding/page.tsx`

### What works
- Active onboarding card is still the strongest component pattern in the module: progress bar,
  status + count badges, struck-through completed items with completion dates, red "Atrasado"
  highlighting.

### Findings

**[Medium] No "Iniciar Onboarding" entry point on this screen.** Offboarding got a prominent
"Iniciar Offboarding" button (`offboarding/page.tsx:142`) but the Onboarding "Ativos" tab still
has no equivalent — onboarding can only be started from the employee profile sheet. This is now
an *inconsistency between two sibling screens* as well as the Wave 3 detour. *Fix:* mirror the
offboarding pattern with a "Iniciar Onboarding" button + employee/template picker dialog.

**[Low] Card-as-click-target vs. checkbox is still a fragile touch interaction** (Wave 3).

**[Low] Overdue count not surfaced at card level.** Offboarding cards now show a destructive
"N atrasada(s)" badge (`offboarding/page.tsx:299–303`); the onboarding card does not, despite
having the same overdue logic. *Fix:* reuse the offboarding overdue badge on onboarding cards
for visual consistency.

---

## Screen 5 — Offboarding (`20-hr-offboarding.png`)

`app/(dashboard)/hr/offboarding/page.tsx`

### What works
- Clean Ativos/Templates segmented control matching onboarding.
- "Iniciar Offboarding" dialog: colaborador + template + data de desligamento + motivo
  (Pedido de demissão / Desligamento / Aposentadoria / Fim de contrato / Outro). Good
  use of `OFFBOARDING_REASONS` with proper pt-BR labels.
- Cards show overdue badge, reason label, progress bar; `ConfirmDialog` for cancel and
  template delete. Good empty state.

### Findings

**[High] No exit interview and no asset-recovery structure — the two things offboarding exists
for.** The flow is a generic checklist plus a free-text "responsible_role". Industry guidance
treats offboarding as: asset recovery, staged access revocation, knowledge transfer, exit
interview, and a final access audit ([Rippling](https://www.rippling.com/blog/offboarding-checklist)).
ONEmonday captures none of these as first-class data — no exit-interview form, no asset
register, no "access revoked" confirmation. *Fix:* add an exit-interview capture (reuse the
survey engine) and an asset-return sub-checklist on the offboarding instance.

**[Medium] `terminationDate` defaults to *today* and allows past dates with no validation.**
`StartOffboardingDialog` seeds the date to `new Date()` (`offboarding/page.tsx:535`) and the
`Input type=date` has no `min`. Offboarding is almost always scheduled for a future last day;
defaulting to today and silently accepting backdates is error-prone. *Fix:* leave the date
empty (force a choice) or default to a sensible notice period; warn on past dates.

**[Medium] Offboarding does not reconcile with employee status or time-off.** Completing the
checklist does not move the employee to `terminated`, and a departing employee can still hold
a future approved time-off request. There is no cross-link. *Fix:* on offboarding completion,
prompt to set the employee to terminated and flag any future approved leave.

**[Low] Empty Templates state has no inline create action.** The Ativos empty state and the
PDI/surveys empty states all surface a create button; `TemplatesList`'s `EmptyState`
(`offboarding/page.tsx:460–467`) does not. Minor inconsistency.

**[Low] No motivo shown when reason is omitted.** Reason is optional; cards then show only the
template name. Acceptable, but an "Motivo não informado" hint would aid auditing.

---

## Screen 6 — Organograma (`21-hr-org-chart.png`)

`app/(dashboard)/hr/org-chart/page.tsx`

### What works
- Wave 3's "looks empty/broken" defect is fixed: this is now a real top-down boxed chart with
  connector lines, person cards (avatar, nome, cargo, departamento badge, child count), search
  with path-expansion, expand-all/collapse-all, a department filter that keeps ancestors
  (dimming non-matches instead of fragmenting), and a colaborador count.

### Findings

**[High] The root node is clipped off-canvas on load.** In the screenshot the top of the tree
("LN / Diretoria" — Lucas Nobre, the CTO root) is cut off at the right edge, and the second
level overflows horizontally. The chart container is `overflow-x-auto` with
`justify-center` (`org-chart/page.tsx:343–344`); with a wide level-2 row the centered layout
pushes the single root out of the visible area. A first-time user sees a headless org chart.
*Fix:* on initial render scroll the root into view (or left-align the root); BambooHR's org
chart opens centered on the top node with the option to fit-to-screen.

**[High] No zoom and no export.** The chart cannot be zoomed out to see the whole company or
exported to PNG/PDF. For any org past ~15 people, horizontal scrolling alone is unworkable, and
"download the org chart" is a standard ask. BambooHR explicitly offers zoom + export. *Fix:*
add zoom in/out/fit controls and a PNG/PDF export.

**[Medium] The chart card has a fixed, smallish viewport with heavy dead space.** The bordered
`bg-muted/20` panel (`org-chart/page.tsx:343`) shows large empty margins above/below the cards
while the content overflows sideways. *Fix:* make the panel taller / responsive to viewport
height and enable both-axis panning.

**[Low] Search clears expansion state changes silently.** Typing in search re-seeds
`expandedSet` via the `defaultSignature` mechanism (`org-chart/page.tsx:242–256`); a manager
who manually expanded branches loses that state when they search. Acceptable but worth a note.

---

## Screen 7 — Férias e Ausências (`22-hr-time-off.png`)

`app/(dashboard)/hr/time-off/page.tsx`

### What works
- The Wave 3 high-priority items are fixed: the reject `prompt()` is now a proper `Dialog`
  with a `Textarea`; the filter shows "Todos"; the request dialog has a real política selector
  and a live balance preview; over-balance approval routes through a confirmation dialog with
  a `balanceShortfall` round-trip.

### Findings

**[High] Approved requests with a negative balance are still visible and unexplained.** The
screenshot shows Diego Nascimento approved at `0d`, and Gabriel Martins (`-15d`) / Camila
Ferreira (`-2d`) still Pendente. The guard now *blocks accidental* over-approval, but the
table gives no signal on the already-approved/over-drawn rows and no way to see who overrode
the balance or why. *Fix:* badge over-balance rows ("saldo negativo") and record the override
actor/justification, shown on hover or in a detail.

**[Medium] Still no calendar / team-absence view.** The page is a flat list; Pedro
(13–27/06), Gabriel (13–27/07) and Bruno (28/05–11/06) overlaps are invisible. BambooHR and
Factorial center time-off on a team calendar. Wave 3 finding, still open. *Fix:* add a month
calendar tab.

**[Medium] No filter by collaborator or date range.** Only a status `Select`. An HR manager
reviewing "quem está fora em junho" must scan the whole table. *Fix:* add collaborator and
date-range filters.

**[Low] "Ações" column is blank for non-pending rows** — leaves visible whitespace; show
approver/decision-date on hover or a "ver detalhe" affordance (Wave 3, still open).

**[Low] `BalanceCell` uses the *current* year, not the request year.** `BalanceCell`
hard-codes `new Date().getFullYear()` (`time-off/page.tsx:58`) while the request dialog
correctly derives the year from the start date. A 2027-dated request will show a misleading
2026 balance in the table.

---

## Screen 8 — Desempenho (`23-hr-performance.png`)

`app/(dashboard)/hr/performance/page.tsx`, `evaluation-dialog.tsx`, `nine-box-grid.tsx`,
`review-cycle-dialog.tsx`, `development-plan-card.tsx`

### What works
- Three coherent tabs (Avaliações / Matriz 9-Box / PDI). Cycles list with status badges and
  evaluation counts; evaluation dialog captures desempenho/potencial/nota geral plus
  strengths/improvements/comments with a rascunho-vs-concluir split. 9-box grid uses a shared,
  unit-tested `nineBoxCell` helper with sensible colour tones. PDI cards with action checklists
  and completion ratios.

### Findings

**[High] No self-assessment, no 360/peer feedback, no calibration.** ONEmonday's "avaliação"
is a single manager form. BambooHR's performance management explicitly bundles self-reflection,
360-degree anonymous peer feedback, goals, and 1-on-1s
([BambooHR](https://www.bamboohr.com/integrations/listings/bamboohr-performance-management)).
Sólides centers on behavioural-profile-based development. A pure top-down rating with no
employee voice is below market baseline and risks bias. *Fix:* add at least a self-assessment
step (employee fills the same axes) before the manager review; roadmap 360 feedback.

**[Medium] Empty state for the whole module is just grey text.** With no cycle, the
Avaliações tab shows a tiny card "Nenhum ciclo de avaliação." plus a right-pane sentence
"Crie ou selecione um ciclo…" (`performance/page.tsx:80,160–163`). The Matriz 9-Box and PDI
tabs are reachable but inert. Compared with the polished `EmptyState` component used on
surveys/offboarding, this first-run experience is weak and gives no explanation of what a
ciclo/9-box/PDI is. *Fix:* use the shared `EmptyState` with an icon, a one-line explainer, and
the create CTA.

**[Medium] 9-box positions are entered manually with no calibration safeguard.** Desempenho
and potencial are free `Select`s on the evaluation form; there is no link to the overall
rating, no calibration session, and nothing prevents every employee being placed in the
top-right box. BambooHR's 9-box is positioned as a structured, bias-reducing tool. *Fix:* at
minimum derive a suggested cell from `overall_rating`, and add a calibration/locked state per
cycle.

**[Medium] Review cycle has no questions/competencies and cannot be edited or closed.**
`ReviewCycleDialog` captures only name/dates/description. BambooHR cycles carry custom
questions per cycle and a frequency; ONEmonday cycles are inert containers. There is also no
UI to move a cycle draft→active→closed or to edit it. *Fix:* add per-cycle competencies/
questions and a status transition control.

**[Low] PDI "Cancelar" button has no confirmation.** `DevelopmentPlanCard` cancels the plan
immediately on click (`development-plan-card.tsx:181`) while sibling destructive actions
(offboarding cancel, template delete) use `ConfirmDialog`. Inconsistent and risky. *Fix:* wrap
in `ConfirmDialog`.

**[Low] Evaluation dialog never maps server validation errors to fields.** Like the other HR
dialogs it shows only a generic toast; the Zod `fieldErrors` from `upsertEvaluation` are
discarded. Carried cross-cutting Wave 3 finding.

---

## Screen 9 — Pesquisas (`24-hr-surveys.png`)

`app/(dashboard)/hr/surveys/page.tsx`, `survey-form-dialog.tsx`,
`survey-response-dialog.tsx`, `survey-results-sheet.tsx`

### What works
- Good `EmptyState` with icon, explainer and CTA.
- Survey builder supports climate vs. eNPS, multiple questions, three question types
  (Escala 1-5 / eNPS 0-10 / Comentário). Status lifecycle draft→open→closed via buttons.
- Results sheet aggregates response count, eNPS with colour-coded tone, and per-question
  averages — and the response dialog states responses are anonymous.

### Findings

**[High] The "Responder" button is on the admin management screen — anonymity is not
credible.** An open survey shows a "Responder" button right next to "Encerrar" and
"Resultados" (`surveys/page.tsx:127–157`). Employees answer surveys; an HR admin pressing
"Responder" on the management list, with no separate distribution link and no
already-responded guard, undermines the "sua resposta é anônima" promise and makes
participation tracking meaningless. Factorial and Workleap distribute surveys to employees and
keep the admin's results view separate from the respondent flow. *Fix:* surveys must be
answered through an employee-facing route / shareable link; remove "Responder" from the admin
list (or gate it clearly as a preview).

**[High] Surveys cannot be targeted, segmented, or scheduled.** A survey goes to "everyone in
the sector"; there is no audience selection, no recurrence/pulse cadence, and results cannot be
sliced by department or team. Factorial's Engagement Insight Dashboard segments eNPS and
climate results; pulse cadence is a core best practice (quarterly to avoid fatigue). *Fix:*
add audience targeting, a schedule/recurrence option, and department breakdown in results.

**[Medium] Results sheet is text-only — no distribution, no detractor/passive/promoter
breakdown.** `SurveyResultsSheet` shows count, a single eNPS number, and per-question averages
as plain lines (`survey-results-sheet.tsx:50–88`). Best-in-class eNPS reporting shows the
Promoter/Passive/Detractor split and a score distribution histogram. *Fix:* add the eNPS
breakdown and a simple bar distribution per scored question.

**[Medium] No participation rate.** Results show "N respostas" with no denominator. Without the
eligible-population count a manager cannot judge whether the result is representative —
participation rate is a headline metric in Factorial's dashboard. *Fix:* show "N de M
(X%)" using the targeted audience size.

**[Medium] Closing a survey is irreversible with no confirmation.** "Encerrar" is a `ghost`
button that fires `statusMutation` immediately (`surveys/page.tsx:136–148`); a closed survey
cannot reopen. *Fix:* wrap in `ConfirmDialog`; consider allowing reopen while no responses
exist.

**[Low] Survey builder validation is generic-toast only.** "Adicione ao menos uma pergunta" is
a toast; empty-prompt questions are silently dropped (`survey-form-dialog.tsx:61,94`). Inline
validation would be clearer.

**[Low] eNPS survey type vs. eNPS question type can conflict.** Survey type and per-question
type both have an "eNPS" value with no coupling; a climate survey can contain an eNPS 0-10
question and vice-versa. Worth documenting the intended relationship.

---

## Per-sector access — Gerente RH

No HR-scoped screenshots were captured this wave (`screenshots/audit-wave4/gerente-rh/`
contains only the generic dashboard/boards/projects/settings views). Two notes from code:

**[Medium] All HR pages hard-gate on `currentSector` and silently return a plain sentence when
absent** (e.g. `performance/page.tsx:46–52`, `surveys/page.tsx:56–62`,
`offboarding/page.tsx:96–102`). For a manager whose sector context fails to load, every new HR
screen degrades to one line of grey text with no retry. *Fix:* a shared, branded
empty/error state with a retry, instead of a bare `<p>`.

**[Medium] Wave 3's "Gerente RH lands on the generic board dashboard" finding could not be
re-verified** — no `gerente-rh` HR screenshot exists for Wave 4. Carry forward and capture
HR-scoped screenshots next wave.

---

## Cross-cutting findings

- **[Medium] Accessibility on custom interactive elements.** The org-chart node is a
  `div role="button"` (keyboard handled), but the score buttons in `SurveyResponseDialog`
  (`survey-response-dialog.tsx:102–114`) are unlabelled icon-less number buttons with no
  `aria-pressed`/radiogroup semantics, and the cycle/evaluation list items are bare `<button>`s
  with no selected-state announcement. Native checkboxes in PDI/onboarding have no associated
  `aria-label` beyond the visible text (acceptable) but the survey scale needs `role="radio"` /
  `aria-checked`. *Fix:* model the 1–10 scale as a radiogroup; add `aria-pressed` to toggle-like
  buttons.
- **[Medium] Destructive actions are inconsistently confirmed.** Offboarding cancel/template
  delete use `ConfirmDialog`; PDI "Cancelar", survey "Encerrar" and candidate stage-move do
  not. Standardise: every irreversible action gets a `ConfirmDialog`.
- **[Medium] Server Zod `fieldErrors` are never mapped to inputs** in any HR dialog (evaluation,
  review cycle, survey, add-candidate, start-offboarding). Carried from Wave 3; the new dialogs
  repeat the pattern.
- **[Low] Empty-state inconsistency.** `EmptyState` (icon + explainer + CTA) is used on
  surveys/PDI/onboarding/offboarding-ativos but not on the performance Avaliações tab or the
  offboarding Templates tab, which fall back to plain text.
- **[Low] Inline-styled segmented controls duplicate the layout tabs.** Offboarding and
  onboarding re-implement the muted-pill tab strip with hand-rolled `<button>`s
  (`offboarding/page.tsx:118–139`) while performance/surveys use the `Tabs` component. Pick one
  segmented-control primitive.
- **[Low] Date inputs accept any date.** Review cycle, offboarding termination date and
  time-off all use bare `Input type="date"` with no `min`/`max`; end-before-start is not
  validated client-side.

---

## Prioritized backlog (value / effort)

| # | Priority | Screen | Finding | Effort |
|---|----------|--------|---------|--------|
| 1 | **High** | Surveys | Move survey answering to an employee-facing route; remove "Responder" from the admin list — anonymity/participation are currently not credible | M |
| 2 | **High** | Performance | Add an employee self-assessment step before the manager review | M |
| 3 | **High** | Org chart | Scroll the root into view on load (root is clipped off-canvas) | S |
| 4 | **High** | Org chart | Add zoom (in/out/fit) and PNG/PDF export | M |
| 5 | **High** | Recruitment | Add status filter + per-row actions (edit / change status) to the Vagas list | S |
| 6 | **High** | Offboarding | Add exit-interview capture and an asset-return sub-checklist | M |
| 7 | **High** | Time-off | Badge over-balance approved rows and record override actor/justification | S |
| 8 | **Medium** | Surveys | Audience targeting + recurrence/pulse cadence + department breakdown in results | L |
| 9 | **Medium** | Surveys | Add eNPS Promoter/Passive/Detractor split, participation rate, and a distribution chart | M |
| 10 | **Medium** | Onboarding | Add an "Iniciar Onboarding" button to match the Offboarding screen | S |
| 11 | **Medium** | Performance | Use the shared `EmptyState` for the first-run experience; explain ciclo/9-box/PDI | S |
| 12 | **Medium** | Performance | Add per-cycle competencies/questions and a draft→active→closed transition | M |
| 13 | **Medium** | Recruitment | Promote the pipeline to a full page with drag-and-drop stage moves | M |
| 14 | **Medium** | Time-off | Add a team-absence month calendar and collaborator/date-range filters | M |
| 15 | **Medium** | Dashboard | Period toggle (3/6/12m) for headcount analytics; turnover formula tooltip | S |
| 16 | **Medium** | Cross-cutting | Confirm all destructive actions (PDI cancel, survey close, candidate stage) | S |
| 17 | **Medium** | Cross-cutting | Radiogroup semantics + `aria` on the survey rating scale | S |
| 18 | **Low** | Time-off | `BalanceCell` should use the request year, not the current year | S |
| 19 | **Low** | Dashboard | Promote "Documentos Vencendo" above the fold; deep-link widget rows | S |
| 20 | **Low** | Cross-cutting | Map server Zod `fieldErrors` to inline form errors in HR dialogs | M |

## Quick wins

1. **Scroll the org-chart root into view on load** — the chart currently opens headless
   (`org-chart/page.tsx:343–344`). One `scrollIntoView`.
2. **Remove "Responder" from the surveys admin list** — it directly breaks the anonymity
   promise (`surveys/page.tsx:127–157`).
3. **Add a status filter + row actions to the Vagas table** — small, unblocks vaga management
   (`recruitment/page.tsx:48–125`).
4. **Add an "Iniciar Onboarding" button** mirroring the offboarding screen — removes a 4-step
   detour and fixes a sibling-screen inconsistency.
5. **Wrap PDI "Cancelar" and survey "Encerrar" in `ConfirmDialog`** — the component already
   exists; both are currently one-click irreversible.
6. **Fix `BalanceCell` to use the request's year** — one-line change, removes a misleading
   balance figure (`time-off/page.tsx:58`).
7. **Swap the performance empty state to the shared `EmptyState`** — consistency + a real
   first-run explainer.

---

### Sources
- [Gupy — Software de Recrutamento e Seleção](https://www.gupy.io/software-de-recrutamento-e-selecao)
- [Gupy 2026 Pricing, Features, Reviews — GetApp](https://www.getapp.com/hr-employee-management-software/a/gupy/)
- [BambooHR — Is the 9-Box Model a Successful Performance Management Tool?](https://www.bamboohr.com/blog/9-box-grid)
- [BambooHR — Multiple Review Cycles in Performance Management](https://www.bamboohr.com/product-updates/multiple-review-cycles-in-performance)
- [BambooHR — Performance Management (Marketplace)](https://www.bamboohr.com/integrations/listings/bamboohr-performance-management)
- [Factorial — About the Engagement Insight Dashboard](https://help.factorialhr.com/en_US/surveys-enps/about-the-engagement-insight-dashboard)
- [Rippling — Offboarding Checklist: 6 Steps & Free Template](https://www.rippling.com/blog/offboarding-checklist)
- [Deel — IT Offboarding Checklist Template](https://www.deel.com/blog/it-offboarding-checklist-template/)
- [Workleap — Best Employee Engagement Tools for 2026](https://workleap.com/blog/best-employee-engagement-tools)
</content>
</invoke>
