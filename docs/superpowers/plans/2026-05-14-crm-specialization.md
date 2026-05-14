# CRM Specialization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add proposals UI, pipeline probability automation, enriched activity history, and dashboard enhancements to the CRM module.

**Architecture:** One new migration (00014) adds proposal items table, pipeline stage defaults table, and probability_locked column. New server actions, hooks, and components follow existing patterns. All UI in pt-BR.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase, shadcn/ui, React Query, Zod

**Spec:** `docs/superpowers/specs/2026-05-14-module-specialization-design.md` (Module 2)

**CRITICAL NOTES:**
- `crm_proposals` real columns: `content` (not description), `value` (not total_value), `expires_at` (not valid_until), `sent_at`, status includes `viewed`
- `crm_deals` has NO `owner_id` — use `cards.created_by` via `card_id` for deal creator
- `deal-detail-sheet.tsx` already has a "Propostas" tab stub (lines 449-501) — enhance, don't duplicate
- `lib/validations/crm.ts` already has `createProposalSchema` (lines 58-65) — extend if needed
- RLS uses `user_sector_roles` (NOT `sector_members`)
- shadcn/ui uses `render` prop (NOT `asChild`)
- `Select.onValueChange`: `(value: string | null) => void`
- Currency: `new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })`

---

### Task 1: Migration 00014

**Files:**
- Create: `supabase/migrations/00014_crm_proposals_pipeline.sql`

- [ ] **Step 1: Create migration file**

Copy exact SQL from spec section 2.1 and 2.2:
- `crm_proposal_items` table with 4 separate RLS policies (SELECT, INSERT, UPDATE, DELETE)
- `crm_pipeline_stage_defaults` table with 4 separate RLS policies
- `ALTER TABLE crm_deals ADD COLUMN probability_locked boolean NOT NULL DEFAULT false`

All policies use `user_sector_roles` subquery.

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/00014_crm_proposals_pipeline.sql
git commit -m "feat(crm): add migration for proposal items, pipeline defaults, probability lock"
```

---

### Task 2: Proposals — Server Actions & Hook

**Files:**
- Create: `apps/web/lib/actions/crm/proposals.ts`
- Create: `apps/web/hooks/crm/use-proposals.ts`

**Reference files to read first:**
- `apps/web/lib/actions/crm/companies.ts` (131 lines) — server action pattern
- `apps/web/hooks/crm/use-companies.ts` — hook pattern
- `apps/web/lib/validations/crm.ts` — has `createProposalSchema` (lines 58-65)

- [ ] **Step 1: Create proposal server actions**

Create `apps/web/lib/actions/crm/proposals.ts` with:

- `createProposal(formData)`:
  - Auth check, zod validate
  - Insert into `crm_proposals` (title, content, value, expires_at, deal_id, sector_id, created_by, status='draft')
  - Insert items into `crm_proposal_items` (description, quantity, unit_price, position)
  - Calculate `value` as sum of (quantity * unit_price) across items
  - Revalidate `/crm/proposals`

- `updateProposal(id, formData)`:
  - Validate, update proposal
  - Delete existing items, re-insert new ones
  - Recalculate `value`

- `updateProposalStatus(id, status)`:
  - Validate status transition
  - If status = 'sent', set `sent_at = now()`
  - Update status

- `deleteProposal(id)`:
  - Soft delete (`is_active = false`)
  - Only allow if status = 'draft'

Items are passed as JSON string in formData: `items: JSON.stringify([{description, quantity, unit_price}])`

- [ ] **Step 2: Create proposals hook**

Create `apps/web/hooks/crm/use-proposals.ts`:
- `useProposals(sectorId, statusFilter?)` — fetch proposals with optional status filter, join deal name
- `useProposalDetail(proposalId)` — fetch single proposal with items
- Mutation hooks for create/update/delete/status change
- Follow pattern from `hooks/crm/use-companies.ts`

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/actions/crm/proposals.ts apps/web/hooks/crm/use-proposals.ts
git commit -m "feat(crm): add proposal server actions and React Query hooks"
```

---

### Task 3: Proposals — UI Components & Page

**Files:**
- Create: `apps/web/components/crm/proposal-form-dialog.tsx`
- Create: `apps/web/components/crm/proposal-detail-sheet.tsx`
- Create: `apps/web/app/(dashboard)/crm/proposals/page.tsx`
- Modify: `apps/web/app/(dashboard)/crm/layout.tsx` (55 lines, nav at lines 7-13)

**Reference files to read first:**
- `apps/web/components/crm/company-form-dialog.tsx` — dialog pattern
- `apps/web/components/crm/company-detail-sheet.tsx` — detail sheet pattern
- `apps/web/app/(dashboard)/crm/companies/page.tsx` — page pattern
- `apps/web/app/(dashboard)/crm/layout.tsx` — nav links (lines 7-13)

- [ ] **Step 1: Create ProposalFormDialog**

Create `apps/web/components/crm/proposal-form-dialog.tsx`:
- Fields: `deal_id` (select from deals), `title`, `content` (textarea), `expires_at` (date input), `status` (select: draft/sent/viewed/accepted/rejected)
- Dynamic line items array: add/remove rows of {description, quantity, unit_price}
- Auto-calculate total (sum of qty * unit_price)
- Accept optional `proposal` prop for edit mode
- On submit, call create/update mutation

- [ ] **Step 2: Create ProposalDetailSheet**

Create `apps/web/components/crm/proposal-detail-sheet.tsx`:
- Show: title, deal link, content, expires_at, sent_at, status badge
- Line items table with columns: Description, Qty, Unit Price, Total. Footer with grand total.
- Action buttons based on status:
  - Draft: "Enviar" (-> sent)
  - Sent: "Aceitar" / "Rejeitar"
  - Use `updateProposalStatus` mutation

- [ ] **Step 3: Create proposals page**

Create `apps/web/app/(dashboard)/crm/proposals/page.tsx`:
- Follow pattern from `apps/web/app/(dashboard)/crm/companies/page.tsx`
- Table listing: Title, Deal name, Value (BRL formatted), Expires At, Status badge
- Status filter select (all/draft/sent/viewed/accepted/rejected)
- Empty state with CTA "Nova Proposta"
- CSV export button
- Click row opens ProposalDetailSheet

- [ ] **Step 4: Add nav link to CRM layout**

Modify `apps/web/app/(dashboard)/crm/layout.tsx`:
- Add `{ label: "Propostas", href: "/crm/proposals" }` to `crmNav` array between Pipeline and Atividades (around line 10)

- [ ] **Step 5: Build and commit**

```bash
cd apps/web && npx next build 2>&1 | tail -20
git add apps/web/components/crm/proposal-form-dialog.tsx apps/web/components/crm/proposal-detail-sheet.tsx apps/web/app/\(dashboard\)/crm/proposals/page.tsx apps/web/app/\(dashboard\)/crm/layout.tsx
git commit -m "feat(crm): add proposals page with form dialog and detail sheet"
```

---

### Task 4: Link Proposals to DealDetailSheet

**Files:**
- Modify: `apps/web/components/crm/deal-detail-sheet.tsx` (529 lines, proposals tab at 449-501)

**Reference:** Read `apps/web/components/crm/deal-detail-sheet.tsx` lines 449-501 — existing Proposals tab stub.

- [ ] **Step 1: Enhance proposals tab in DealDetailSheet**

The file already has a "Propostas" tab (lines 449-501). Enhance it:
- Use `useProposals` hook filtered by deal_id
- Show list of proposals with: title, value (BRL), status badge, expires_at
- "Nova Proposta" button that opens ProposalFormDialog with deal pre-selected
- Click proposal opens ProposalDetailSheet

- [ ] **Step 2: Build and commit**

```bash
cd apps/web && npx next build 2>&1 | tail -20
git add apps/web/components/crm/deal-detail-sheet.tsx
git commit -m "feat(crm): link proposals to deal detail sheet"
```

---

### Task 5: Pipeline Stage Defaults & Probability Automation

**Files:**
- Create: `apps/web/lib/actions/crm/stage-defaults.ts`
- Modify: `apps/web/lib/actions/crm/move-deal.ts` (76 lines)
- Modify: `apps/web/components/crm/deal-detail-sheet.tsx`

**Reference files to read first:**
- `apps/web/lib/actions/crm/move-deal.ts` — existing move deal action (76 lines)
- `apps/web/hooks/crm/use-deals.ts` — deal interface (lines 7-44)

- [ ] **Step 1: Create stage defaults action**

Create `apps/web/lib/actions/crm/stage-defaults.ts`:
- `updateStageDefaults(sectorId, stages: {stage_name, default_probability, position}[])`:
  - Auth check
  - Delete existing defaults for sector
  - Insert new defaults
  - Revalidate `/crm/pipeline`

- [ ] **Step 2: Update move-deal action**

Modify `apps/web/lib/actions/crm/move-deal.ts`:
- After moving card to new column, check if `probability_locked = false` on the deal
- If not locked, query `crm_pipeline_stage_defaults` for the new column name
- If default exists, update `crm_deals.probability` to the default value
- If no default or locked, leave unchanged

- [ ] **Step 3: Add probability lock toggle to DealDetailSheet**

Modify `apps/web/components/crm/deal-detail-sheet.tsx`:
- In the details tab, find the probability display
- Add a lock/unlock icon button next to it
- Clicking toggles `probability_locked` on the deal
- Show tooltip: "Probabilidade travada manualmente" when locked

- [ ] **Step 4: Build and commit**

```bash
cd apps/web && npx next build 2>&1 | tail -20
git add apps/web/lib/actions/crm/stage-defaults.ts apps/web/lib/actions/crm/move-deal.ts apps/web/components/crm/deal-detail-sheet.tsx
git commit -m "feat(crm): add pipeline stage defaults and probability automation"
```

---

### Task 6: Enriched Activity History

**Files:**
- Modify: `apps/web/components/crm/activity-create-dialog.tsx` (232 lines, form at 111-212)
- Modify: `apps/web/app/(dashboard)/crm/activities/page.tsx`

**Reference files to read first:**
- `apps/web/components/crm/activity-create-dialog.tsx` — existing form (232 lines)
- `apps/web/app/(dashboard)/crm/activities/page.tsx` — activities page

- [ ] **Step 1: Enhance ActivityCreateDialog**

Modify `apps/web/components/crm/activity-create-dialog.tsx`:
- When type = `email`: show `from_email` and `to_email` text inputs above description
- When type = `meeting`: show `location` text input above description
- Serialize extra fields into description: `"De: from@x.com | Para: to@y.com\n---\nActual notes"`
- Other types: no change

- [ ] **Step 2: Add type filter and date range to activities page**

Modify `apps/web/app/(dashboard)/crm/activities/page.tsx`:
- Add type filter buttons/select (call/email/meeting/note/task) — may already partially exist
- Add date range filter (from/to date inputs)
- Style activity icons per type with distinct colors:
  - call: Phone icon, blue
  - email: Mail icon, purple
  - meeting: Calendar icon, green
  - note: StickyNote icon, yellow
  - task: CheckSquare icon, gray

- [ ] **Step 3: Build and commit**

```bash
cd apps/web && npx next build 2>&1 | tail -20
git add apps/web/components/crm/activity-create-dialog.tsx apps/web/app/\(dashboard\)/crm/activities/page.tsx
git commit -m "feat(crm): enrich activity creation with email/meeting fields and type filters"
```

---

### Task 7: Enriched CRM Dashboard

**Files:**
- Create: `apps/web/components/crm/pipeline-funnel.tsx`
- Modify: `apps/web/app/(dashboard)/crm/page.tsx` (174 lines, stats at 69-90, table at 114-170)

**Reference files to read first:**
- `apps/web/app/(dashboard)/crm/page.tsx` — current dashboard (174 lines)
- `apps/web/hooks/crm/use-crm-stats.ts` — existing stats hook

- [ ] **Step 1: Create PipelineFunnel component**

Create `apps/web/components/crm/pipeline-funnel.tsx`:
- Accept array of `{stage: string, count: number, value: number}`
- Render horizontal bars proportional to deal count
- Show stage name, count, and total value per bar
- Use div-based bars with `bg-primary` at varying widths, no chart library
- Format values with BRL currency

- [ ] **Step 2: Enhance CRM dashboard**

Modify `apps/web/app/(dashboard)/crm/page.tsx`:
- After existing stats grid (line ~109), add 3 new sections:

**Pipeline Funnel**: Use `PipelineFunnel` component. Query deal counts grouped by board column name.

**Top Performers**: Card with ranked list. Query: join `crm_deals` -> `cards`, group by `cards.created_by` -> join `users` for name, filter stage = won, sum value, order desc limit 5. Show avatar initials + name + total BRL.

**Closing Soon**: Card with deal list. Query deals where `expected_close_date` is within 7 days from now. Show deal name, company name, value, days remaining badge.

Each section in a Card with CardHeader/CardContent.

- [ ] **Step 3: Build and commit**

```bash
cd apps/web && npx next build 2>&1 | tail -20
git add apps/web/components/crm/pipeline-funnel.tsx apps/web/app/\(dashboard\)/crm/page.tsx
git commit -m "feat(crm): add pipeline funnel, top performers, and closing soon to dashboard"
```

---

### Task 8: Final Build Verification

- [ ] **Step 1: Run full build**

```bash
cd apps/web && npx next build 2>&1 | tail -40
```

Expected: Build succeeds, new `/crm/proposals` route appears, 0 TypeScript errors.

- [ ] **Step 2: Final commit if any fixes needed**

```bash
git add -u && git commit -m "fix(crm): resolve build errors from specialization"
```
