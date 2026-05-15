# HR Module — Feature Gap Analysis

**Date:** 2026-05-15
**Author:** HR module engineer
**Scope:** Prioritized gap analysis comparing the ONEmonday HR module against best-in-class HR products, to drive a focused first wave of improvements (`feat/hr-wave1`).

---

## 1. Method

The current HR module was audited file-by-file (migrations `00012` + `00015`, server actions in `lib/actions/hr/**`, hooks in `hooks/hr/**`, components in `components/hr/**`, pages under `app/(dashboard)/hr/**`). It was then compared against four widely-adopted HR platforms — BambooHR, Personio, Gusto, and Rippling — plus general HRIS best-practice guidance for document management and directory search.

## 2. Current state (what the module already does well)

- Employee CRUD, profile sheet (perfil / ferias / documentos / acoes tabs), termination.
- Time-off requests with approve/reject and a `get_employee_time_off_balance` RPC + balance cards.
- Onboarding templates (jsonb items) + instances with checklist, progress bars, overdue highlighting.
- Recruitment (job openings + candidates on a board), org chart tree, enriched dashboard
  (dept distribution, birthdays, active onboardings, upcoming time-off).
- Employee document upload/download/delete backed by a private Storage bucket.

## 3. Competitor benchmarks

- **BambooHR** — checklist-based onboarding that automates digital paperwork and IT handoff so
  "nothing gets dropped"; a centralized, secure hub for employee records and *signed documents*;
  employee self-service for PTO balances and the company directory.
  ([BambooHR onboarding](https://www.bamboohr.com/platform/onboarding/),
  [BambooHR review](https://thrivea.com/blog/bamboohr-review/))
- **Personio** — structured absence requests/approvals with transparent balances; dashboards that
  "surface headcount trends, upcoming absences, and leave balances"; self-service leave history.
  ([Personio review](https://thrivea.com/blog/personio-review/),
  [Personio absence management](https://www.personio.com/hr-lexicon/absence-management-software/))
- **Gusto** — onboarding *and* offboarding checklists with automated workflows and
  "time-sensitive task reminders"; centralized employee records and e-signature.
  ([Gusto offboarding](https://gusto.com/product/hr/employee-offboarding-software),
  [Gusto onboarding checklists](https://support.gusto.com/article/210728175340400/View-and-complete-onboarding-checklists))
- **Rippling** — unified onboarding/offboarding workflow automation across HR, IT and finance.
  ([Rippling vs Gusto](https://www.rippling.com/blog/rippling-vs-gusto-hr-payroll-comparison))
- **HRIS document-management best practice** — records should be searchable by indexed metadata
  (employee, department, document type, *effective/expiration date*), and the system should
  "track expiration dates and alert teams before work authorization expires" with overdue items
  escalating automatically rather than living in a spreadsheet.
  ([DynaFile buyer's guide](https://www.dynafile.com/resources/hr-guides/best-hr-document-management-software-buyers-guide/),
  [HR document management best practices](https://technicalwriterhq.com/documentation/document-management/hr-document-management-best-practices/))

## 4. Prioritized gap list

Priority key: **P0** = security/data-loss bug, **P1** = missing table-stakes feature, **P2** = UX polish, **P3** = future wave.

| # | Gap | Type | Priority | Wave 1? |
|---|-----|------|----------|---------|
| G1 | `uploadDocument` / `deleteDocument` server actions have **no auth/permission check** — any authenticated user can write/delete HR documents in any sector (RLS is the only guard, and the bucket SELECT policy is sector-blind). | Security bug | **P0** | Yes |
| G2 | `toggleOnboardingItem` / `completeOnboarding` server actions skip the permission check that every other HR action enforces. | Security bug | **P0** | Yes |
| G3 | `EmployeeFormDialog` never renders `phone`, `birthDate` or `managerId` inputs, yet edit mode receives those values and the submit handler omits them — **editing an employee silently wipes phone, birth date and manager**. Birthdays-this-month dashboard card depends on `birth_date`. | Data-loss bug | **P0** | Yes |
| G4 | No **document expiry tracking**. Industry standard is to track expiration dates for contracts/IDs/certificates and alert before they lapse. Documents table has no expiry column and nothing surfaces upcoming expirations. | Missing table-stakes | **P1** | Yes |
| G5 | Employee directory has status + department dropdowns but **no free-text search** by name / email / position — every benchmarked product offers indexed directory search. | Missing table-stakes | **P1** | Yes |
| G6 | HR-owned files carry **18 lint errors + 2 warnings** (`no-explicit-any`, `set-state-in-effect`, `react/no-unescaped-entities`, impure `Date.now()` in render, unused imports), risking regressions and blocking clean CI. | Code quality | **P1** | Yes |
| G7 | Time-off page `BalanceCell` issues **one RPC per table row** (N+1). Acceptable for a first wave but should batch. | Performance | **P2** | No (next wave) |
| G8 | Onboarding has no **offboarding** counterpart — Gusto/Rippling treat offboarding checklists as a peer feature to onboarding. | Missing feature | **P2** | No (next wave) |
| G9 | No document **e-signature / acknowledgement** workflow (BambooHR signed-documents hub). | Missing feature | **P3** | No |
| G10 | No **headcount-trend / turnover** analytics on the dashboard (Personio surfaces headcount trends). | Analytics | **P3** | No |
| G11 | Onboarding template items store `responsible_role` / `due_days_offset` in jsonb, but instance items drop the `responsible_role` (never written to `hr_onboarding_items`) so the detail sheet cannot show who owns a step. | Data-fidelity gap | **P2** | Partially (see Wave 1 scope) |

## 5. Wave 1 scope (this branch)

Delivered on `feat/hr-wave1`:

1. **G1/G2 security fixes** — add `getUserPermissions` + `hasPermission` checks (and ownership lookup) to `uploadDocument`, `deleteDocument`, `toggleOnboardingItem`, `completeOnboarding`.
2. **G3 data-loss fix** — add `phone`, `birthDate`, `managerId` inputs to `EmployeeFormDialog` and include them in the submit payload.
3. **G4 document expiry** — migration `00030` adds `expiry_date` to `hr_employee_documents`; upload form captures it; profile sheet shows an "expira"/"vencido" badge; dashboard gains a "Documentos vencendo" card.
4. **G11 onboarding responsible role** — migration `00030` adds `responsible_role` to `hr_onboarding_items`; `startOnboarding` persists it from the template; the onboarding detail sheet displays it.
5. **G5 directory search** — free-text search box on the employees page filtering by name / email / position.
6. **G6 lint** — all HR-owned files brought to zero errors and zero warnings with real fixes.
7. Focused Vitest unit tests + a Playwright E2E spec for the HR flows touched.

## 6. Deliberately deferred (next wave)

- G7 batched balance RPC (`get_sector_time_off_balances`).
- G8 offboarding checklists (mirror of onboarding).
- G9 document acknowledgement / e-signature.
- G10 headcount & turnover analytics.

## Sources

- BambooHR — onboarding: <https://www.bamboohr.com/platform/onboarding/>
- BambooHR — review: <https://thrivea.com/blog/bamboohr-review/>
- Personio — review: <https://thrivea.com/blog/personio-review/>
- Personio — absence management: <https://www.personio.com/hr-lexicon/absence-management-software/>
- Gusto — employee offboarding software: <https://gusto.com/product/hr/employee-offboarding-software>
- Gusto — onboarding checklists: <https://support.gusto.com/article/210728175340400/View-and-complete-onboarding-checklists>
- Rippling vs Gusto — 2025 comparison: <https://www.rippling.com/blog/rippling-vs-gusto-hr-payroll-comparison>
- DynaFile — HR document management buyer's guide: <https://www.dynafile.com/resources/hr-guides/best-hr-document-management-software-buyers-guide/>
- Technical Writer HQ — HR document management best practices: <https://technicalwriterhq.com/documentation/document-management/hr-document-management-best-practices/>
