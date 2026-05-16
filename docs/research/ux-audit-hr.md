# UX Audit — HR Module ("RH Portal")

**Module:** `apps/web/app/(dashboard)/hr` — RH (Recursos Humanos)
**Audited screens:** Dashboard, Colaboradores, Ferias e Ausencias, Recrutamento, Onboarding, Organograma + the `gerente-rh` scoped dashboard.
**Date:** 2026-05-15
**Method:** Screen-by-screen review of the six full-page screenshots (`screenshots/audit/admin/13-18`) plus `gerente-rh/00-dashboard.png`, cross-referenced with the source under `app/(dashboard)/hr`, `components/hr`, `hooks/hr`, `lib/actions/hr` and `lib/validations/hr.ts`. Market comparison against BambooHR, Gusto, Rippling and Personio.

---

## Module summary & overall rating

The HR module is the most feature-complete of the operational modules: it covers six distinct surfaces (people, leave, recruitment, onboarding, org chart, dashboard) and the data model behind it is reasonably deep — documents with expiry tracking, time-off balances, onboarding templates/instances, a recruitment kanban. The visual language is clean, consistent with the rest of ONEmonday, and the dashboard is genuinely informative.

However, the module has **one functional defect that corrupts data** (the time-off request dialog sends the employee ID as the policy ID), several **dead-end screens** (recruitment has no way to add a candidate; the org chart filter is the only control on a near-empty screen), and a recurring pattern of **browser-native `prompt()`/`confirm()` dialogs** that break the design system. The leading products in this space (BambooHR, Gusto, Personio, Rippling) treat employee self-service, leave-balance accuracy, and ATS pipelines as table stakes — ONEmonday currently has none of these working end-to-end.

**Overall rating: 6.0 / 10** — Strong information architecture and visual polish, undermined by a data-integrity bug, missing self-service, and incomplete recruitment/onboarding flows.

---

## Screen 1 — Dashboard (`13-hr-dashboard.png`)

`app/(dashboard)/hr/page.tsx`

### What works
- Four KPI cards (Colaboradores, Em Licenca, Solicitacoes Pendentes, Vagas Abertas) give an immediate operational read.
- Six well-chosen content cards: department distribution bar chart, birthdays/anniversaries, active onboardings with progress bars, upcoming time-off (7 days), expiring documents. This is a thoughtful "what needs my attention today" layout.
- Smart fallback: when there are no birthdays this month it transparently switches to hire anniversaries (`celebrationTitle` logic). Good empty-state behaviour.
- Proper skeleton loaders and per-card empty states ("Nenhum onboarding em andamento.", etc.).

### Findings

**[Medium] KPI cards are not actionable.** The four stat cards are static `Card` elements — clicking "Solicitacoes Pendentes (2)" or "Vagas Abertas (1)" does nothing. In BambooHR and Personio the home dashboard tiles are deep-links into a filtered list. *Recommendation:* make each KPI card a link — Solicitacoes Pendentes → `/hr/time-off?status=pending`, Vagas Abertas → `/hr/recruitment`.

**[Medium] Dashboard widgets do not deep-link to their detail.** "Onboardings Ativos" shows Ana Carolina Ribeiro at 3/5 but the row is not clickable, even though `/hr/onboarding` already opens a detail sheet by instance ID. Same for "Documentos Vencendo" and "Ferias nos Proximos 7 Dias". *Recommendation:* wire each list row to the existing detail sheet / page.

**[Low] "Documentos Vencendo" is cut off below the fold.** The screenshot shows the card header only. It is the sixth card in a 2-column grid; consider promoting expiring documents higher — an expired compliance document is higher priority than a birthday.

**[Low] No date/period context on the dashboard.** "Aniversarios do Mes" and "Ferias nos Proximos 7 Dias" rely on the reader knowing today's date. A small "Maio 2026" label on the celebration card would orient the user.

**[Low] Title says "RH" but sidebar says "RH Portal".** Minor inconsistency — pick one label for the module.

---

## Screen 2 — Colaboradores (`14-hr-employees.png`)

`app/(dashboard)/hr/employees/page.tsx`, `employee-form-dialog.tsx`, `employee-profile-sheet.tsx`

### What works
- Clean table with the right columns (Nome, Cargo, Departamento, Admissao, Tipo, Status); rows are clickable and open a rich profile sheet.
- Search across name/email/cargo + two filter selects (status, department) with dynamically-derived department options.
- CSV export respects the current filter and is disabled when the result set is empty — correct behaviour.
- The profile sheet is the strongest component in the module: four tabs (Perfil, Ferias, Documentos, Acoes), time-off balance cards with traffic-light colours, document upload with category + expiry, edit/terminate/start-onboarding actions.

### Findings

**[High] Filter select triggers have no width and an unhelpful label.** Both filter `SelectTrigger`s render as a tiny "all" pill (visible in the screenshot — two small `all ▾` boxes). The `SelectValue placeholder="Status"` never shows because a value (`"all"`) is always set, so the trigger displays the raw item value. *Recommendation:* give the triggers a fixed width (`w-[160px]`) and render a friendly current label ("Todos os status" / "Ativo"…), as the time-off page does for its own select. Today a user cannot tell what either filter does without opening it.

**[Medium] Header count vs. filtered count is ambiguous.** The card title reads "Colaboradores (12)" while the dashboard KPI says 11 (it excludes terminated). The table count is `filtered.length`; with no filter applied it equals total including terminated. Align the two numbers or label the table count ("12 de 12").

**[Medium] No column sorting.** The table cannot be sorted by Admissao, Nome or Departamento. BambooHR's directory sorts and groups; for 12 rows it is tolerable, at 100+ it is a real friction point. *Recommendation:* add click-to-sort headers.

**[Medium] No employee self-service / no photos.** Every competitor (BambooHR, Gusto, Personio) gives employees a profile they own, with a photo. ONEmonday uses initials avatars and the directory is admin-only. In BambooHR an out-of-office employee even shows greyed-out with their return dates. *Recommendation:* roadmap item — profile photos and an employee-facing "my profile" view.

**[Medium] Employee form has no field-level validation feedback.** `employee-form-dialog.tsx` relies only on native `required`; the Zod schema (`createEmployeeSchema`) runs server-side and returns `fieldErrors`, but the dialog only surfaces a generic toast ("Erro ao criar colaborador") and never maps errors back to fields. Email format errors, etc., are invisible. *Recommendation:* display `result.error` field maps inline under each input.

**[Low] Manager select cannot be cleared intuitively and lists everyone.** The "Gestor" select offers every non-terminated coworker with no search; for a large org this becomes an unscannable list. Use a searchable combobox.

**[Low] "Admissao" date 18/05/2026 is in the future for an "Ativo" employee** (Ana Carolina Ribeiro). The form does not prevent future hire dates; acceptable for pre-boarding but worth a visual "Futuro" tag.

**[Low] Document upload accepts any file type and shows size as `KB` only.** No `accept` attribute on the file input, no MB formatting for large files. Minor.

---

## Screen 3 — Ferias e Ausencias (`18-hr-time-off.png`)

`app/(dashboard)/hr/time-off/page.tsx`, `time-off-request-dialog.tsx`, `lib/actions/hr/time-off.ts`

### What works
- Table is clear: collaborator + position, period, days, balance, status, inline approve/reject actions for pending rows.
- The "Saldo" column is colour-coded (green/yellow/red by % remaining) — a nice at-a-glance signal.
- Approve/reject mutations invalidate stats and balances; toasts confirm the outcome.

### Findings

**[High] Data-integrity bug: `policyId` is set to the employee ID.** In `time-off-request-dialog.tsx` line ~93 the mutation sends `policyId: employeeId`. The server (`requestTimeOff`) inserts that value straight into `hr_time_off_requests.policy_id`. Because `requestTimeOffSchema.policyId` is only `z.string().uuid()`, the wrong-but-valid UUID passes validation. Consequences: every request created through the UI stores a corrupt policy reference, and `BalanceCell` (which matches `balance.policy_id === req.policy_id`) will never find a balance — the "Saldo" column will silently show `--` for any UI-created request. *Recommendation:* add a real policy selector to the dialog (load policies for the sector) and send the chosen policy ID; never reuse `employeeId`.

**[High] Negative balances are shown but not prevented.** The screenshot shows Gabriel Martins with `-15d` and Camila Ferreira with `-2d`, both still "Pendente". Nothing blocks approving a request that exceeds the balance. BambooHR and Personio warn or block on insufficient balance at request time. *Recommendation:* validate `daysCount <= available_days` before submit, and show a confirmation warning on approval of an over-balance request.

**[High] Reject uses a browser `prompt()`.** `rejectMutation` calls `prompt("Motivo da rejeicao:")`. This is a native, unstyled, unlocalised modal that breaks the design system, is not keyboard/screen-reader friendly, and is blocked by some browsers. *Recommendation:* replace with a proper rejection `Dialog` containing a `Textarea` (the project already has both components).

**[Medium] Single status filter, mislabelled.** The only filter trigger shows raw "all". Same label bug as the employees page — though the time-off page does give it a width. *Recommendation:* render "Todos" instead of "all". Also add filters by collaborator and by date range; an HR manager reviewing leave needs "show me June".

**[Medium] No calendar / team-absence view.** The page is a flat list only. BambooHR's time-off centres on a calendar so a manager can see overlapping absences. ONEmonday already computes "Ferias nos Proximos 7 Dias" on the dashboard — a month calendar here would be high value.

**[Medium] Approve has no confirmation and no undo.** A single click on the green check approves irreversibly (the action rejects re-processing). For a low-risk action this is fine, but pair it with a toast "Desfazer" or a confirm when balance is negative.

**[Low] "Acoes" column is empty for non-pending rows** — leaves visible whitespace. Consider showing who approved / when on hover, or a "ver detalhe" link.

**[Low] `calcDays` counts calendar days, not business days.** A Mon–Fri request returns 5, but a request spanning a weekend also counts Sat/Sun. Brazilian férias law counts corridos, so this may be intentional — but for "ausência" types (sick, etc.) business-day counting is usually expected. Document the intent.

---

## Screen 4 — Recrutamento (`15-hr-recruitment.png`)

`app/(dashboard)/hr/recruitment/page.tsx`, `job-opening-form-dialog.tsx`, `recruitment-board-sheet.tsx`

### What works
- Vagas table is clean: title, department, type, location, candidate count, date, status.
- Clicking a row opens a kanban board sheet (`recruitment-board-sheet.tsx`) with colour-dotted columns and candidate cards (name, email, phone, notes).
- Good empty states for "no openings" and "no board configured".

### Findings

**[High] There is no way to add a candidate anywhere in the UI.** `addCandidateSchema` exists in validations and `lib/actions/hr/candidates.ts` exists, but the recruitment board sheet is **read-only** — no "Adicionar candidato" button, no way to move a card between columns. The screenshot shows "Desenvolvedor Backend Senior" with 3 candidatos, but those can only have been seeded in the DB. This makes the entire recruitment feature a dead end for a real user. *Recommendation:* add a candidate dialog wired to `addCandidate`, and drag-and-drop (or a "mover" menu) to change stage.

**[High] The kanban board is not interactive.** Candidate cards cannot be opened, dragged, or edited. There is no candidate detail (resume URL, LinkedIn, expected salary, source all exist in the schema but are never displayed). Compared to Rippling/Personio ATS modules — which support stage moves, scorecards and interview scheduling — this is barely an ATS. *Recommendation:* at minimum, a candidate detail sheet showing the full schema fields and a stage-change control.

**[Medium] The Vagas page has no search, filter, or sort.** Just a "Nova Vaga" button and a table. With more than a handful of openings this won't scale. Add a status filter (Aberta/Fechada/Preenchida) at least.

**[Medium] `job-opening-form-dialog.tsx` omits fields the schema supports.** The schema allows `salaryRange`, `hiringManagerId`, `maxCandidates` and `requirements` — the dialog collects `requirements` but not `salaryRange`, `hiringManagerId` or `maxCandidates`. Salary range and hiring manager are standard ATS fields. *Recommendation:* add them, or trim the schema.

**[Low] "Candidatos" column shows `0` for a "Preenchida" vaga.** A filled position with zero candidates is odd — implies the hire wasn't tracked through the pipeline. Reinforces the "candidates can't be added" gap.

**[Low] No job-opening edit/close action.** Once created, an opening cannot be edited or its status changed from the UI.

---

## Screen 5 — Onboarding (`16-hr-onboarding.png`)

`app/(dashboard)/hr/onboarding/page.tsx`, `onboarding-detail-sheet.tsx`, `onboarding-template-form-dialog.tsx`

### What works
- Two-tab layout (Ativos / Templates) is clear; the segmented control matches the module nav style.
- Active onboarding cards are excellent: header with name/role/department/start date, status + count badges, a progress bar, and the first 5 checklist items inline with completion toggles.
- Overdue items are highlighted in red ("Atrasado: 14/05/2026") and completed items are struck through with a green check and completion date. This is genuinely good task UX.
- Detail sheet shows all items plus the responsible role.

### Findings

**[Medium] Template deletion uses a browser `confirm()`.** `handleDeleteTemplate` calls `confirm("Tem certeza...")`. Same design-system break as the time-off `prompt()`. *Recommendation:* use an AlertDialog.

**[Medium] No way to start an onboarding from this screen.** Onboardings can only be started from the employee profile sheet's "Acoes" tab. A user on the Onboarding page who wants to onboard someone has to leave, find the employee, open the sheet, switch tabs. *Recommendation:* add a "Iniciar Onboarding" button on the Ativos tab with an employee + template picker.

**[Medium] Card click vs. checkbox click is a fragile interaction.** The whole card is a click target opening the detail sheet; the item checkboxes call `e.stopPropagation()`. It works, but tapping near a checkbox edge is error-prone on touch. Consider making only the header/title open the sheet.

**[Low] Templates list shows no preview of steps.** A template card shows "5 etapas" but you must open the edit dialog to see what they are. A collapsible step list would help.

**[Low] No onboarding completion notification or handoff.** When all items are done the instance becomes "Concluido" but nothing prompts the manager. Personio/BambooHR send onboarding-complete notifications.

**[Low] "Em andamento" progress at 60% with one overdue item** — the card doesn't surface the overdue count at the card level (you must scan the items). A small "1 atrasada" badge in the header would help triage.

---

## Screen 6 — Organograma (`17-hr-org-chart.png`)

`app/(dashboard)/hr/org-chart/page.tsx`, `hooks/hr/use-org-chart.ts`

### What works
- A real recursive tree built from `manager_id`, with expand/collapse chevrons, initials avatars, department badges and a direct-report count.
- Department filter select.
- Rows open the same employee profile sheet — good reuse.

### Findings

**[High] The screen looks empty and broken on load.** The screenshot shows a single collapsed row — "Lucas Nobre / CTO / Diretoria / 9". All 11 employees are under one root and the tree starts fully collapsed (`expandedSet` initialised empty). A first-time user sees one line and an org chart that appears to contain one person. *Recommendation:* expand the first 1–2 levels by default, or auto-expand when there is a single root.

**[High] It is a tree, not an org chart.** BambooHR, Personio and every competitor render an org chart as a top-down boxed diagram with connector lines, zoom and export. ONEmonday renders an indented file-tree. For "Organograma" this fails the user's mental model. *Recommendation:* render a proper hierarchical chart (boxes + connectors), with zoom and PNG/PDF export — BambooHR explicitly offers download/export and zoom.

**[Medium] Department filter breaks the hierarchy.** `useOrgChart` filters employees by department *before* `buildTree`. Filtering to "Engenharia" drops the CTO, so every engineer whose manager is outside the department becomes a separate root — the chart fragments into orphans. *Recommendation:* either keep ancestors when filtering, or change the filter to "highlight" rather than "prune".

**[Medium] No search / "locate person" in the chart.** With the tree collapsed, finding one person means expanding nodes manually. A search box that expands the path to a match is standard.

**[Low] Employees with no `manager_id` silently become roots.** If data is incomplete the chart shows multiple top-level nodes with no explanation. Show a "Sem gestor" grouping.

**[Low] The only control is one select on an otherwise blank page** — lots of dead whitespace. Add expand-all / collapse-all buttons and a count ("11 colaboradores").

---

## Per-sector access — Gerente RH (`gerente-rh/00-dashboard.png`)

The HR manager's landing page is the **generic project Dashboard** (Total de Cards, Cards por Prioridade, Atividade Recente), scoped to the "RH" sector — not the HR module dashboard. The sidebar still shows "RH Portal" as a separate module entry.

**[High] The HR manager lands on a board/task dashboard, not the HR dashboard.** A "Gerente RH" most needs the people/leave/recruitment dashboard (`/hr`), yet the default route shows generic kanban-card metrics. The recent-activity feed is on-topic ("Onboarding Ana Costa", "Vaga: Desenvolvedor Frontend Senior", "Revisao do plano de cargos e salarios") which shows the sector is HR — but the KPIs are the wrong domain. *Recommendation:* for an HR-sector manager, default the home route to `/hr`, or surface the HR KPI cards on this dashboard.

**[Medium] Could not verify scoped views for the six HR screens** — only the dashboard screenshot exists for `gerente-rh`. The code scopes every HR query by `currentSector?.id`, so a manager should see only their sector's data; but no screenshot confirms whether destructive actions (terminate, approve/reject leave, delete template) are correctly gated. The server actions do check `hasPermission(... "manage")`, which is good — but the **UI still renders the approve/reject buttons and Desligar button regardless of permission**, so a manager without `manage` rights will click and get a "Sem permissao" toast. *Recommendation:* hide action controls the user cannot perform, rather than failing after the click.

---

## Cross-cutting findings

- **[High] Native `prompt()` / `confirm()` used in three places** (time-off reject, onboarding template delete, document delete). Inconsistent, inaccessible, unlocalised. Standardise on `Dialog` / `AlertDialog`.
- **[Medium] Server-side Zod errors are never mapped to form fields.** Every form (`employee`, `job-opening`, `time-off`) shows only a generic toast. Inline field errors are expected in all four competitor products.
- **[Medium] Filter `Select` triggers display raw values ("all").** Affects employees (x2) and time-off. Render localised labels.
- **[Medium] Permission-gated controls are shown then rejected** rather than hidden.
- **[Low] Accents are stripped throughout the UI copy** ("Ferias", "Solicitacoes", "Admissao", "Nascimento", "Organograma" headers). Date formatting (`pt-BR`, dd/mm/yyyy) is correct, but visible text is not properly accented. This reads as unfinished localisation.
- **[Low] No global "salary / compensation" surface.** None of the screens expose compensation, which Gusto/Rippling/Personio treat as core. May be intentional scoping, but note the gap.

---

## Prioritized backlog (value / effort)

| # | Priority | Finding | Why it matters | Effort |
|---|----------|---------|----------------|--------|
| 1 | **High** | Fix `policyId: employeeId` bug in time-off dialog; add a real policy selector | Corrupts every UI-created leave request; breaks the balance column | S |
| 2 | **High** | Add "Adicionar candidato" + stage-change to the recruitment board | Recruitment is a dead end without it | M |
| 3 | **High** | Replace `prompt()`/`confirm()` (reject, template delete, doc delete) with Dialog/AlertDialog | Accessibility + design consistency | S |
| 4 | **High** | Org chart: expand top levels by default; fix department filter fragmenting the tree | Screen currently looks empty/broken | S |
| 5 | **High** | Block / warn on negative time-off balance at request and approval | Prevents over-allocating leave | M |
| 6 | **High** | Route HR-sector managers to `/hr` (not the generic board dashboard) | Wrong landing page for the role | S |
| 7 | **Medium** | Fix filter `Select` triggers (width + localised label) on employees & time-off | Users can't tell what filters do | S |
| 8 | **Medium** | Map server Zod `fieldErrors` to inline form errors in all HR dialogs | Silent validation failures today | M |
| 9 | **Medium** | Make dashboard KPI cards + widget rows deep-link to filtered views | Faster navigation, fewer clicks | S |
| 10 | **Medium** | Hide (not just reject) action controls the user lacks permission for | Avoids click-then-error UX | S |
| 11 | **Medium** | Add a team-absence calendar view to Ferias e Ausencias | Matches BambooHR; reveals overlaps | M |
| 12 | **Medium** | Render Organograma as a true top-down chart with zoom + export | Meets the "org chart" mental model | L |
| 13 | **Medium** | Add "Iniciar Onboarding" entry point on the Onboarding page | Removes a 4-step detour | S |
| 14 | **Low** | Sortable columns on employees & vagas tables | Scales past ~50 rows | M |
| 15 | **Low** | Profile photos + employee self-service profile | Competitive parity | L |
| 16 | **Low** | Restore pt-BR accents across UI copy | Polish / professionalism | S |

---

### Sources
- [BambooHR — View the Company Directory and Org Chart](https://help.bamboohr.com/s/article/587751)
- [BambooHR — Org Chart Quick Link (Product Updates)](https://www.bamboohr.com/product-updates/org-chart-quick-link)
- [BambooHR 2026 Pricing, Features, Reviews & Alternatives — GetApp](https://www.getapp.com/hr-employee-management-software/a/bamboohr/)
- [Rippling vs. Gusto: HR & Payroll Comparison — Rippling](https://www.rippling.com/blog/rippling-vs-gusto-hr-payroll-comparison)
- [Rippling vs Personio — SelectHub](https://www.selecthub.com/hr-management-software/rippling-vs-personio/)
- [Gusto vs Rippling: 2026 Comparison Guide — Workology](https://workology.com/gusto-vs-rippling-pricing-features-key-differences/)
- [Best Rippling Alternatives in 2026 — Rework](https://resources.rework.com/tools/hr-people/best-rippling-alternatives)
