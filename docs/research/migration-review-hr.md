# Pre-merge review — HR people-management (migration Phase 3)

**Reviewer:** senior-reviewer
**Scope:** `apps/web/app/(dashboard)/hr` (incl. `performance`, `surveys`, `recruitment`), `components/hr`, `hooks/hr`, `lib/hr`, `lib/actions/hr`; migrations `00106`–`00109`.
**Commits:** `45ab916`, `4f2121c`, `b4a75d7`, `95d0e19` (already merged via `0c58434`).

## Verdict: APPROVE WITH NITS

The Phase 3 HR work is solid: `eslint`, `tsc --noEmit` and `vitest run lib/hr` (38 tests, 3 files) all pass clean. RLS is present on every new table, server actions validate with Zod and re-check permissions, migrations are idempotent and sequentially numbered (`00106`–`00109`, no edits to existing migrations). The recruitment RLS fix is correct and the survey schema is genuinely anonymous.

There are no blocking issues. The most important finding is that the headline claim of migration `00106` — "all genuinely sensitive data has been moved to `hr_employee_compensation`" — is **not actually true**: `birth_date` and `notes` remain on `hr_employees` and the new compensation table is unused dead schema. This is a "should fix" because it does not regress security but it also does not deliver the LGPD hardening the migration says it does.

---

## Blocking

None.

---

## Should fix

### S1. `00106` does not deliver the LGPD hardening it claims
`supabase/migrations/00106_hr_employee_rls_hardening.sql:76-89` and the header comment (`:13-15`, `:78-82`).

The migration states sensitive data "has been moved to `hr_employee_compensation`". In reality:
- `hr_employee_compensation` is created with the correct restrictive RLS (`employee`/`manage` or self), but **no application code reads or writes it** — `grep` for `hr_employee_compensation`/`compensation` across `apps/web` returns nothing. It is dead schema. The salary/CLT columns it holds were never on `hr_employees` to begin with, so nothing was "moved".
- `hr_employees` still carries `birth_date` (LGPD personal data), `notes` (free-text, the comment itself calls it "sensitive context"), `phone`, `status` and `termination_date`. The directory hook selects `*` (`hooks/hr/use-employee-detail.ts:47`).
- The new `hr_employees_select` policy narrows from "any `user_sector_roles` row" to "`employee` `read` permission OR self". But migration `00009` grants `employee read` to **admin, manager, analyst and intern** — every seeded role. So in practice an intern still reads every colleague's `birth_date` and `notes`. Net exposure is essentially unchanged.

Fix: either (a) actually move `birth_date`/`notes` (and ideally `termination_date`) into `hr_employee_compensation` or a similar restricted table and drop them from `hr_employees`, then update `use-employee-detail.ts`/`use-employees` to select an explicit non-sensitive column list; or (b) correct the migration comment so it does not overstate what was done, and split the directory read so `notes`/`birth_date` are only visible to `employee`/`manage` holders or self (e.g. a column-projection view, since Postgres RLS is row- not column-scoped).

### S2. Pre-existing `hr_employees` write policies still reference an unseeded resource — not fixed by `00106`
`supabase/migrations/00012_hr.sql:241,245` (`hr_employees_insert`/`hr_employees_update` use resource `'hr_employee'`).

`00107` correctly diagnoses and fixes exactly this class of bug for recruitment (`hr_recruitment` → `job_opening`/`candidate`), and the comment at `00107:93-98` explains it. But the **same defect exists for `hr_employees`, `hr_time_off_*` and `hr_onboarding_*`**: `00012` policies use `hr_employee`, `hr_time_off`, `hr_onboarding`, while `00009` seeds `employee`, `time_off`, `onboarding`. `user_has_permission` matches `p.resource` exactly, so today only global admins can write employees / time-off / onboarding. Since `00106` is the "HR employee RLS hardening" migration and touches `hr_employees`, it is the natural place to fix `hr_employees_insert`/`hr_employees_update` to use `'employee'`. The app actions (`lib/actions/hr/*`) already pass the correct resource names, so they are blocked by RLS.

Fix: add `DROP POLICY … CREATE POLICY` for `hr_employees_insert/update` (and ideally the time-off / onboarding policies) onto the seeded `employee`/`time_off`/`onboarding` resources, mirroring `00107`'s realignment block.

### S3. Survey free-text answers are stored but readable per-response by any `survey`-reader
`supabase/migrations/00109_hr_engagement_surveys.sql:216-225` (`hr_survey_answers_select`).

Responses are genuinely anonymous at the schema level — `hr_survey_responses` has no `user_id`/`created_by` (`:95-100`), and `submitSurveyResponse` inserts no identity (`lib/actions/hr/surveys.ts:118-127`). Good. However `hr_survey_answers` rows (including `text_value` free-text comments) are readable per-row by anyone with `survey` `read`. On a survey with one or two responses, a verbatim comment plus its `submitted_at` timestamp can deanonymize the author. The UI never surfaces individual comments (`survey-results-sheet.tsx` shows only aggregate counts/averages), so the practical risk is low, but the data is still queryable directly.

Fix: drop the `hr_survey_answers_select` / `hr_survey_responses_select` policies entirely and rely solely on the `SECURITY DEFINER` `get_survey_results` RPC for reads (it already does the `survey read` check). If raw reads must stay, gate them behind `survey` `manage` and suppress small-N text answers in any future UI.

---

## Nits

### N1. `upsertEvaluation` permission check is inverted relative to intuition
`lib/actions/hr/performance.ts:118` — `needed = parsed.data.submit ? "update" : "create"`. Creating a brand-new *submitted* evaluation requires the `update` permission, while saving a draft requires `create`. Harmless for the seeded roles (analyst has both, intern has neither), but the mapping reads backwards. Consider always requiring `create` for an insert and `update` only for editing an existing row.

### N2. `get_survey_results` eNPS double-counts when a survey has multiple eNPS questions
`00109:268-281` — eNPS is computed over *every* `enps`-type answer in the survey. A respondent who answers two eNPS questions is counted twice in the denominator. eNPS is conventionally a single question, so this is edge-case only; consider averaging per-question or constraining a survey to one eNPS question.

### N3. `submitSurveyResponse` allows unlimited resubmissions
`lib/actions/hr/surveys.ts:98-148` — no dedup (correct, since dedup needs identity which would break anonymity). Ballot-stuffing is therefore possible. Acceptable tradeoff; just be aware results are not protected against it.

### N4. `survey_type` and per-question `question_type` are independent
`components/hr/survey-form-dialog.tsx` — marking a survey as `enps` does not pre-set/force any question to `question_type='enps'`. Since `get_survey_results` keys the eNPS calc on `question_type`, an `enps` survey with no `enps` question yields a null eNPS. Minor UX gap; consider auto-seeding the standard 0-10 recommendation question for `enps` surveys.

### N5. `00106` "no data-access regression" claim is not strictly true for custom roles
`00106:91-95` — the backfill comment assumes every role that previously had implicit directory read has `employee read`. True for the four seeded roles, but a custom role with a sector assignment and no HR permissions loses directory access. Likely intended; worth a one-line caveat in the comment.

---

## Verified working

- `eslint` (HR scope), `tsc --noEmit`, `vitest run lib/hr` — all pass (38 tests).
- `00107` recruitment RLS realignment is correct: `job_opening`/`candidate` resources match the `00009` seed; app actions (`candidates.ts`) use the same names. `card_id`/`hiring_manager_id` `NOT NULL` relaxations and the `stage` CHECK are idempotent.
- `00108` performance/PDI RLS is sound: `hr_development_plans`/`hr_development_actions` correctly grant the subject employee read of their own PDI via `hr_employees.user_id = auth.uid()`; `get_nine_box_grid` enforces `performance read` before returning data; analysts/interns are scoped appropriately. Note: interns hold `performance read`, so they can read all evaluation `comments`/`overall_rating` in their sector — consistent with the existing intern-reads-everything pattern, flagged for awareness only.
- 9-box logic (`lib/hr/performance.ts`) and grid layout (`nine-box-grid.tsx`) are correct: top-right cell = `3-3` = "Estrela", potential rows 3→1; eNPS buckets (≥9 promoter, ≥7 passive, ≤6 detractor) match the SQL `get_survey_results` calculation.
- All new tables have RLS enabled; migrations use `IF NOT EXISTS` / `DROP … IF EXISTS` consistently and are safe to re-run.
