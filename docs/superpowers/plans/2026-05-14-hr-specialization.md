# HR (RH Portal) Specialization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add onboarding workflow, time-off balance calculation, employee documents, organizational chart, and enriched dashboard to the HR module.

**Architecture:** One new migration (00015) adds employee documents table, storage bucket, time-off balance RPC. New server actions, hooks, and components follow existing patterns. All UI in pt-BR.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase, shadcn/ui, React Query, Zod

**Spec:** `docs/superpowers/specs/2026-05-14-module-specialization-design.md` (Module 3)

**CRITICAL NOTES:**
- `hr_onboarding_templates.items` is `jsonb DEFAULT '[]'` — items stored as JSON array, NOT separate rows
- Template jsonb items expand into `hr_onboarding_items` rows when instance is created
- `hr_time_off_requests` uses `approved_by`/`approved_at` (NOT `reviewed_by`/`reviewed_at`), no `requested_by`
- `hr_employees.birth_date` column EXISTS
- RLS uses `user_sector_roles` (NOT `sector_members`)
- shadcn/ui uses `render` prop (NOT `asChild`)
- `Select.onValueChange`: `(value: string | null) => void`
- Existing `hooks/hr/use-onboarding.ts` has 99 lines with `useOnboardingInstances` and `useCompleteOnboardingItem`

---

### Task 1: Migration 00015

**Files:**
- Create: `supabase/migrations/00015_hr_documents.sql`

- [ ] **Step 1: Create migration file**

Copy exact SQL from spec sections 3.2 and 3.3:
- `hr_employee_documents` table with 4 RLS policies (SELECT, INSERT, UPDATE, DELETE)
- Storage bucket `hr-documents` (INSERT with ON CONFLICT DO NOTHING)
- Storage RLS policies for the bucket
- `get_employee_time_off_balance(p_employee_id, p_year)` RPC function (SECURITY DEFINER)

All table policies use `user_sector_roles` subquery. RPC uses explicit `::numeric` casts.

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/00015_hr_documents.sql
git commit -m "feat(hr): add migration for employee documents, storage, and time-off balance RPC"
```

---

### Task 2: Onboarding Templates CRUD

**Files:**
- Create: `apps/web/lib/actions/hr/onboarding.ts`
- Create: `apps/web/components/hr/onboarding-template-form-dialog.tsx`
- Modify: `apps/web/hooks/hr/use-onboarding.ts` (99 lines)
- Modify: `apps/web/app/(dashboard)/hr/onboarding/page.tsx` (223 lines)

**Reference files to read first:**
- `apps/web/hooks/hr/use-onboarding.ts` — existing hook (99 lines, has `useOnboardingInstances` and `useCompleteOnboardingItem`)
- `apps/web/app/(dashboard)/hr/onboarding/page.tsx` — existing page (223 lines)
- `apps/web/lib/validations/hr.ts` — has `createOnboardingTemplateSchema` (lines 55-66)

- [ ] **Step 1: Create onboarding server actions**

Create `apps/web/lib/actions/hr/onboarding.ts`:

- `createOnboardingTemplate(formData)`:
  - Validate with `createOnboardingTemplateSchema`
  - Insert into `hr_onboarding_templates` — `items` column is jsonb, store as `JSON.stringify(items)`
  - Items format: `[{title, description, responsible_role, due_days_offset}]`

- `updateOnboardingTemplate(id, formData)`:
  - Validate, update template including jsonb items

- `deleteOnboardingTemplate(id)`:
  - Delete template

- `startOnboarding(employeeId, templateId)`:
  - Fetch template (with items jsonb)
  - Fetch employee (for hire_date)
  - Create `hr_onboarding_instances` row (status: 'in_progress', started_at: now())
  - Expand template items into `hr_onboarding_items` rows:
    - For each item: set `due_date = hire_date + due_days_offset days`
    - Set `completed = false`, `position` from array index

- `toggleOnboardingItem(itemId, completed)`:
  - Update `hr_onboarding_items`: set `completed`, `completed_at = completed ? now() : null`
  - Check if all items are completed — if so, auto-complete the instance

- `completeOnboarding(instanceId)`:
  - Update `hr_onboarding_instances`: set `status = 'completed'`, `completed_at = now()`

- [ ] **Step 2: Extend use-onboarding hook**

Modify `apps/web/hooks/hr/use-onboarding.ts`:
- Add `useOnboardingTemplates(sectorId)` — fetch templates
- Add `useOnboardingDetail(instanceId)` — fetch single instance with items
- Add mutation hooks for template CRUD and `startOnboarding`
- Keep existing `useOnboardingInstances` and `useCompleteOnboardingItem`

- [ ] **Step 3: Create OnboardingTemplateFormDialog**

Create `apps/web/components/hr/onboarding-template-form-dialog.tsx`:
- Fields: `name` (text), `target_position` (text)
- Dynamic items array: rows of {title, description, responsible_role (text), due_days_offset (number, label: "Dias apos admissao")}
- Add/remove item buttons
- Accept optional `template` prop for edit mode

- [ ] **Step 4: Enhance onboarding page with tabs**

Modify `apps/web/app/(dashboard)/hr/onboarding/page.tsx`:
- Add tab switcher: "Ativos" (instances) and "Templates"
- **Ativos tab**: Keep existing instances listing (lines 82-219). Add progress bar per instance (completed_items / total_items).
- **Templates tab**: List templates with name, target_position, item count. CRUD buttons. Empty state.
- Add "Novo Template" button on Templates tab
- Click instance opens OnboardingDetailSheet

- [ ] **Step 5: Build and commit**

```bash
cd apps/web && npx next build 2>&1 | tail -20
git add apps/web/lib/actions/hr/onboarding.ts apps/web/hooks/hr/use-onboarding.ts apps/web/components/hr/onboarding-template-form-dialog.tsx apps/web/app/\(dashboard\)/hr/onboarding/page.tsx
git commit -m "feat(hr): add onboarding template CRUD and workflow"
```

---

### Task 3: Onboarding Detail Sheet & Start from Employee

**Files:**
- Create: `apps/web/components/hr/onboarding-detail-sheet.tsx`
- Modify: `apps/web/components/hr/employee-profile-sheet.tsx` (378 lines, actions tab at 263-278)

**Reference files to read first:**
- `apps/web/components/hr/employee-profile-sheet.tsx` — profile sheet (378 lines)
- `apps/web/components/crm/deal-detail-sheet.tsx` — detail sheet pattern

- [ ] **Step 1: Create OnboardingDetailSheet**

Create `apps/web/components/hr/onboarding-detail-sheet.tsx`:
- Shows instance info: employee name, template name, started_at, status
- Progress bar at top (completed / total items)
- Checklist: each item shows title, description, responsible, due_date, completed checkbox
- Overdue items (due_date < now() && !completed): red background/text
- Toggle item completion calls `toggleOnboardingItem` mutation

- [ ] **Step 2: Add "Iniciar Onboarding" to EmployeeProfileSheet**

Modify `apps/web/components/hr/employee-profile-sheet.tsx`:
- In the "Acoes" tab (lines 263-278): Add "Iniciar Onboarding" button
- Clicking opens a small dialog: select template from list, confirm
- On confirm, call `startOnboarding(employeeId, templateId)` action
- Show active onboarding instance if exists (with link to detail)

- [ ] **Step 3: Build and commit**

```bash
cd apps/web && npx next build 2>&1 | tail -20
git add apps/web/components/hr/onboarding-detail-sheet.tsx apps/web/components/hr/employee-profile-sheet.tsx
git commit -m "feat(hr): add onboarding detail sheet and start from employee profile"
```

---

### Task 4: Time-Off Balance

**Files:**
- Create: `apps/web/hooks/hr/use-time-off-balance.ts`
- Modify: `apps/web/components/hr/employee-profile-sheet.tsx` (378 lines, ferias tab at 199-261)
- Modify: `apps/web/app/(dashboard)/hr/time-off/page.tsx` (207 lines, table at 117-200)

**Reference files to read first:**
- `apps/web/components/hr/employee-profile-sheet.tsx` — ferias tab (lines 199-261)
- `apps/web/app/(dashboard)/hr/time-off/page.tsx` — time-off page (207 lines)

- [ ] **Step 1: Create time-off balance hook**

Create `apps/web/hooks/hr/use-time-off-balance.ts`:
- `useTimeOffBalance(employeeId, year)` — calls RPC `get_employee_time_off_balance`
- Returns array of `{policy_id, policy_name, total_days, used_days, pending_days, available_days}`
- Enabled only when employeeId is provided

- [ ] **Step 2: Add balance to EmployeeProfileSheet ferias tab**

Modify `apps/web/components/hr/employee-profile-sheet.tsx`:
- In the "Ferias" tab (lines 199-261), add a balance section at the top:
- Card per policy showing: policy name, total days, used days, pending days, available days
- Color coding: green (>50% available), yellow (25-50%), red (<25%)
- Below balance cards, keep existing time-off requests list

- [ ] **Step 3: Add balance column to time-off page**

Modify `apps/web/app/(dashboard)/hr/time-off/page.tsx`:
- In the table (lines 117-200), add "Saldo" column after "Dias"
- For each request, show the requester's remaining available days
- Query balance for each unique employee in the list (batch or per-row)

- [ ] **Step 4: Build and commit**

```bash
cd apps/web && npx next build 2>&1 | tail -20
git add apps/web/hooks/hr/use-time-off-balance.ts apps/web/components/hr/employee-profile-sheet.tsx apps/web/app/\(dashboard\)/hr/time-off/page.tsx
git commit -m "feat(hr): add time-off balance calculation and display"
```

---

### Task 5: Employee Documents

**Files:**
- Create: `apps/web/lib/actions/hr/documents.ts`
- Create: `apps/web/hooks/hr/use-employee-documents.ts`
- Modify: `apps/web/components/hr/employee-profile-sheet.tsx`

**Reference files to read first:**
- `apps/web/components/hr/employee-profile-sheet.tsx` — for adding documents section

- [ ] **Step 1: Create document server actions**

Create `apps/web/lib/actions/hr/documents.ts`:

- `uploadDocument(formData)`:
  - Extract: employeeId, file (File), category, sectorId
  - Upload file to Supabase Storage bucket `hr-documents` at path `{sectorId}/{employeeId}/{filename}`
  - Get public URL
  - Insert metadata into `hr_employee_documents` (name, file_url, file_size, category, uploaded_by, employee_id, sector_id)
  - Revalidate path

- `deleteDocument(documentId)`:
  - Fetch document metadata for file_url
  - Delete from Supabase Storage
  - Delete metadata row
  - Revalidate path

Note: This uses FormData with File — server action receives the file directly.

- [ ] **Step 2: Create documents hook**

Create `apps/web/hooks/hr/use-employee-documents.ts`:
- `useEmployeeDocuments(employeeId)` — fetch documents from `hr_employee_documents` filtered by employee_id
- Returns grouped by category
- Mutation hooks for upload and delete

- [ ] **Step 3: Add documents section to EmployeeProfileSheet**

Modify `apps/web/components/hr/employee-profile-sheet.tsx`:
- Add a new tab "Documentos" (or section within Perfil tab)
- Upload button: file input (hidden) + styled button "Enviar Documento"
- Category select: Contrato, Documento, Certificado, Outro
- Document list grouped by category with:
  - File name, category badge, upload date
  - Download button (link to file_url)
  - Delete button (with confirmation)

- [ ] **Step 4: Build and commit**

```bash
cd apps/web && npx next build 2>&1 | tail -20
git add apps/web/lib/actions/hr/documents.ts apps/web/hooks/hr/use-employee-documents.ts apps/web/components/hr/employee-profile-sheet.tsx
git commit -m "feat(hr): add employee document upload and management"
```

---

### Task 6: Organizational Chart

**Files:**
- Create: `apps/web/hooks/hr/use-org-chart.ts`
- Create: `apps/web/app/(dashboard)/hr/org-chart/page.tsx`
- Modify: `apps/web/app/(dashboard)/hr/layout.tsx` (55 lines, nav at lines 7-13)

**Reference files to read first:**
- `apps/web/app/(dashboard)/hr/layout.tsx` — nav links (lines 7-13)
- `apps/web/hooks/hr/use-employees.ts` — employee query pattern
- `apps/web/components/hr/employee-profile-sheet.tsx` — for opening on click

- [ ] **Step 1: Create org chart hook**

Create `apps/web/hooks/hr/use-org-chart.ts`:
- `useOrgChart(sectorId)` — fetch all employees for sector
- Build tree structure client-side:
  ```typescript
  interface OrgNode {
    employee: Employee;
    children: OrgNode[];
  }
  ```
- Root nodes = employees where `manager_id IS NULL`
- Children = employees whose `manager_id` matches parent's id
- Return flat list of root nodes with nested children

- [ ] **Step 2: Create org chart page**

Create `apps/web/app/(dashboard)/hr/org-chart/page.tsx`:
- `"use client"` page
- Department filter select at top
- Recursive tree rendering:
  - Each node: Card with initials avatar (first letter of first+last name), full_name, position, department badge
  - Indented children with left border line (visual tree)
  - Expand/collapse toggle per node (useState per node or single expanded set)
  - Click card opens EmployeeProfileSheet
- Empty state: "Nenhum colaborador cadastrado" with link to /hr/employees
- Loading skeleton

- [ ] **Step 3: Add nav link to HR layout**

Modify `apps/web/app/(dashboard)/hr/layout.tsx`:
- Add `{ label: "Organograma", href: "/hr/org-chart" }` to `hrNav` array after Onboarding (around line 12)

- [ ] **Step 4: Build and commit**

```bash
cd apps/web && npx next build 2>&1 | tail -20
git add apps/web/hooks/hr/use-org-chart.ts apps/web/app/\(dashboard\)/hr/org-chart/page.tsx apps/web/app/\(dashboard\)/hr/layout.tsx
git commit -m "feat(hr): add organizational chart with tree view"
```

---

### Task 7: Enriched HR Dashboard

**Files:**
- Modify: `apps/web/app/(dashboard)/hr/page.tsx` (159 lines, stats at 50-71, table at 97-155)

**Reference files to read first:**
- `apps/web/app/(dashboard)/hr/page.tsx` — current dashboard (159 lines)
- `apps/web/hooks/hr/use-hr-stats.ts` — existing stats hook

- [ ] **Step 1: Add department distribution**

Modify `apps/web/app/(dashboard)/hr/page.tsx`:
- After existing stats grid (line ~95), add new section
- Query employees grouped by department, count per dept
- Render horizontal bars: dept name on left, bar width proportional to count, count on right
- Use simple divs with `bg-primary` at percentage widths

- [ ] **Step 2: Add birthdays this month**

Same file:
- Query employees where `EXTRACT(MONTH FROM birth_date) = current month`
- List: avatar initials, name, date (day/month format)
- If no birth_dates filled, fallback: show hire_date anniversaries ("Aniversarios de empresa")

- [ ] **Step 3: Add active onboardings**

Same file:
- Query `hr_onboarding_instances` where status = 'in_progress'
- Join with employee name and template name
- Show cards: employee name, template, progress bar (completed/total items), days since started

- [ ] **Step 4: Add upcoming time-off**

Same file:
- Query `hr_time_off_requests` where status = 'approved' and start_date within next 7 days
- Join with employee name and policy name
- List: employee name, period (start - end), policy type badge

- [ ] **Step 5: Build and commit**

```bash
cd apps/web && npx next build 2>&1 | tail -20
git add apps/web/app/\(dashboard\)/hr/page.tsx
git commit -m "feat(hr): enrich dashboard with dept distribution, birthdays, onboardings, time-off"
```

---

### Task 8: Final Build Verification

- [ ] **Step 1: Run full build**

```bash
cd apps/web && npx next build 2>&1 | tail -40
```

Expected: Build succeeds, new `/hr/org-chart` route appears, 0 TypeScript errors.

- [ ] **Step 2: Final commit if any fixes needed**

```bash
git add -u && git commit -m "fix(hr): resolve build errors from specialization"
```
