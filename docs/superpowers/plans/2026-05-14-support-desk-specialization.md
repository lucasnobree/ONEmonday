# Support Desk Specialization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add SLA Rules CRUD, Knowledge Base editor, ticket escalation, and SLA breach notifications to the Support Desk module.

**Architecture:** One new migration (00013) adds escalation columns, escalation log table, notifications table, and SLA status RPC. New server actions, hooks, and components follow existing patterns (zod -> auth -> supabase -> revalidate). All UI in pt-BR.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase, shadcn/ui, React Query, Zod

**Spec:** `docs/superpowers/specs/2026-05-14-module-specialization-design.md` (Module 1)

**CRITICAL NOTES:**
- `sla_rules` columns are `response_time_hours` / `resolve_time_hours` (HOURS, not minutes)
- Priority values: `critical/high/medium/low` (NOT `urgent`)
- `kb_articles` uses `is_published` (boolean), NOT `status` (string)
- `support_tickets` does NOT have `title`, `priority`, or `status` columns — these live on `cards` table via `card_id`
- SLA columns: `sla_response_due_at` / `sla_resolve_due_at` (NOT `sla_first_response_at`)
- RLS uses `user_sector_roles` (NOT `sector_members`)
- shadcn/ui uses `render` prop pattern (NOT `asChild`)
- `Select.onValueChange` signature: `(value: string | null) => void` — wrap with `(v) => setter(v ?? "fallback")`

---

### Task 1: Migration 00013

**Files:**
- Create: `supabase/migrations/00013_support_escalation.sql`

- [ ] **Step 1: Create migration file**

Copy the exact SQL from the spec (sections 1.3 and 1.4). The migration adds:
- 4 columns to `support_tickets` (escalation tracking)
- `ticket_escalation_log` table with RLS
- `support_notifications` table with RLS
- `check_sla_status()` RPC function (joins `cards` for title/priority)

Use `user_sector_roles` in all policies (NOT `sector_members`).

- [ ] **Step 2: Verify migration syntax**

Read the spec SQL carefully. Ensure:
- `check_sla_status()` JOINs `cards c ON c.id = st.card_id` for title/priority
- Uses `st.sla_response_due_at` and `st.sla_resolve_due_at`
- Filters by `st.resolved_at IS NULL` (not `st.status`)
- Function is `SECURITY DEFINER`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/00013_support_escalation.sql
git commit -m "feat(support): add migration for escalation and SLA notifications"
```

---

### Task 2: SLA Rules CRUD

**Files:**
- Create: `apps/web/lib/actions/support/sla-rules.ts`
- Create: `apps/web/hooks/support/use-sla-rules.ts`
- Create: `apps/web/components/support/sla-rule-form-dialog.tsx`
- Modify: `apps/web/app/(dashboard)/support/sla-rules/page.tsx`

**Reference files to read first:**
- `apps/web/lib/actions/crm/companies.ts` — server action pattern
- `apps/web/hooks/crm/use-companies.ts` — hook pattern
- `apps/web/components/crm/company-form-dialog.tsx` — form dialog pattern
- `apps/web/lib/validations/support.ts` — has `createSLARuleSchema` already
- `apps/web/app/(dashboard)/support/sla-rules/page.tsx` — existing page (161 lines, has inline `useSLARules` hook at lines 32-48)

- [ ] **Step 1: Create server actions**

Create `apps/web/lib/actions/support/sla-rules.ts` with:
- `createSlaRule(formData: FormData)` — zod validate, auth check, insert into `sla_rules`
- `updateSlaRule(id: string, formData: FormData)` — validate, update
- `deleteSlaRule(id: string)` — delete
- `toggleSlaRule(id: string, isActive: boolean)` — update `is_active`

Follow pattern from `lib/actions/crm/companies.ts`. Use `createSLARuleSchema` from `lib/validations/support.ts`. Columns: name, priority, category, `response_time_hours`, `resolve_time_hours`, `business_hours_only`, `is_active`. Revalidate `/support/sla-rules`.

- [ ] **Step 2: Extract hook from page**

Create `apps/web/hooks/support/use-sla-rules.ts`. The page already has an inline `useSLARules` hook (lines 32-48). Extract it to the hooks file following the pattern from `hooks/crm/use-companies.ts`. Add mutation hooks for create/update/delete/toggle.

- [ ] **Step 3: Create SlaRuleFormDialog**

Create `apps/web/components/support/sla-rule-form-dialog.tsx`. Follow pattern from `components/crm/company-form-dialog.tsx`.

Fields:
- `name`: Input text
- `priority`: Select with options critical/high/medium/low
- `category`: Input text (optional)
- `response_time_hours`: Input number (label: "Primeira resposta (horas)")
- `resolve_time_hours`: Input number (label: "Resolucao (horas)")
- `business_hours_only`: Checkbox
- `is_active`: Checkbox (default true)

Accept optional `rule` prop for edit mode. Use mutations from the hook.

- [ ] **Step 4: Update SLA Rules page**

Modify `apps/web/app/(dashboard)/support/sla-rules/page.tsx`:
- Replace inline hook with import from `hooks/support/use-sla-rules`
- Add "Nova Regra SLA" button in the header (line ~66)
- Add edit/delete buttons per row in the table
- Add toggle switch for is_active per row
- Import and render `SlaRuleFormDialog`

Do NOT rewrite the page — enhance incrementally. The existing table, loading skeleton, and empty state are fine.

- [ ] **Step 5: Build verification**

```bash
cd apps/web && npx next build 2>&1 | tail -20
```

Expected: Build succeeds with 0 TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/actions/support/sla-rules.ts apps/web/hooks/support/use-sla-rules.ts apps/web/components/support/sla-rule-form-dialog.tsx apps/web/app/\(dashboard\)/support/sla-rules/page.tsx
git commit -m "feat(support): add SLA rules CRUD with form dialog"
```

---

### Task 3: Knowledge Base Editor

**Files:**
- Create: `apps/web/lib/actions/support/kb-articles.ts`
- Create: `apps/web/components/support/kb-article-form-sheet.tsx`
- Modify: `apps/web/hooks/support/use-kb-articles.ts`
- Modify: `apps/web/app/(dashboard)/support/knowledge-base/page.tsx`

**Reference files to read first:**
- `apps/web/hooks/support/use-kb-articles.ts` — existing hook
- `apps/web/app/(dashboard)/support/knowledge-base/page.tsx` — existing page (134 lines)
- `apps/web/components/support/kb-article-sheet.tsx` — existing viewer (if any)
- `apps/web/lib/validations/support.ts` — has `createArticleSchema`

- [ ] **Step 1: Create KB article server actions**

Create `apps/web/lib/actions/support/kb-articles.ts` with:
- `createKBArticle(formData)` — set `author_id` to current user, validate with `createArticleSchema`
- `updateKBArticle(id, formData)` — validate, update
- `deleteKBArticle(id)` — soft delete (`is_active = false`)
- `toggleKBArticlePublished(id)` — toggle `is_published` boolean

Columns: title, content, category, `is_published` (boolean), author_id, sector_id.

- [ ] **Step 2: Extend use-kb-articles hook**

Modify `apps/web/hooks/support/use-kb-articles.ts`:
- Add optional `publishedFilter` parameter: `"all" | "published" | "draft"`
- Filter by `is_published` when not "all"
- Add mutation hooks for create/update/delete/toggle

- [ ] **Step 3: Create KBArticleFormSheet**

Create `apps/web/components/support/kb-article-form-sheet.tsx`. Use a Sheet (not Dialog) for more space.

Fields:
- `title`: Input text (required)
- `category`: Input text with datalist suggestions from existing categories
- `is_published`: Checkbox (label: "Publicado")
- `content`: Textarea (large) with a toggle button to switch between "Editar" and "Visualizar" modes. In preview mode, render content with whitespace preserved (`whitespace-pre-wrap`).

Accept optional `article` prop for edit mode.

- [ ] **Step 4: Enhance KB page**

Modify `apps/web/app/(dashboard)/support/knowledge-base/page.tsx`:
- Add filter tabs: Todos / Publicados / Rascunhos (using `is_published` filter)
- Add "Novo Artigo" button
- Add edit/delete buttons per card
- Import and render `KBArticleFormSheet`
- Add search by title (already partially exists at line 57)

- [ ] **Step 5: Build and commit**

```bash
cd apps/web && npx next build 2>&1 | tail -20
git add apps/web/lib/actions/support/kb-articles.ts apps/web/components/support/kb-article-form-sheet.tsx apps/web/hooks/support/use-kb-articles.ts apps/web/app/\(dashboard\)/support/knowledge-base/page.tsx
git commit -m "feat(support): add Knowledge Base editor with publish toggle"
```

---

### Task 4: Ticket Escalation

**Files:**
- Create: `apps/web/lib/actions/support/escalate.ts`
- Create: `apps/web/components/support/escalate-ticket-dialog.tsx`
- Modify: `apps/web/components/support/ticket-detail-sheet.tsx` (575 lines)
- Modify: `apps/web/app/(dashboard)/support/tickets/page.tsx`

**Reference files to read first:**
- `apps/web/components/support/ticket-detail-sheet.tsx` — main detail sheet (575 lines, DetailsTab at 150-275, actions at 553-568)
- `apps/web/app/(dashboard)/support/tickets/page.tsx` — tickets list
- `apps/web/hooks/use-current-sector.ts` — for getting current sector

- [ ] **Step 1: Create escalation server action**

Create `apps/web/lib/actions/support/escalate.ts`:
- `escalateTicket(ticketId, toSectorId, reason)` — auth check, update `support_tickets` (set `escalated_to_sector_id`, `escalated_at`, `escalated_by`, `escalation_reason`), insert into `ticket_escalation_log`, revalidate paths.

- [ ] **Step 2: Create EscalateTicketDialog**

Create `apps/web/components/support/escalate-ticket-dialog.tsx`:
- Triggered by button in TicketDetailSheet
- Fields: `to_sector_id` (select from available sectors excluding current), `reason` (textarea required)
- Query sectors the user has access to via `user_sector_roles`
- On submit, call `escalateTicket` action

- [ ] **Step 3: Update TicketDetailSheet**

Modify `apps/web/components/support/ticket-detail-sheet.tsx`:
- In `DetailsTab` (around line 150-275): Add escalation info section if `escalated_to_sector_id` exists — show badge "Escalado", target sector name, reason, timestamp
- Add escalation history section — query `ticket_escalation_log` for this ticket, show timeline
- In footer actions area (line 553-568): Add "Escalar" button that opens EscalateTicketDialog

- [ ] **Step 4: Update tickets list page**

Modify `apps/web/app/(dashboard)/support/tickets/page.tsx`:
- Add "Escalado" badge on escalated ticket cards
- The ticket query should already include `escalated_to_sector_id` after migration (may need to update type)

- [ ] **Step 5: Build and commit**

```bash
cd apps/web && npx next build 2>&1 | tail -20
git add apps/web/lib/actions/support/escalate.ts apps/web/components/support/escalate-ticket-dialog.tsx apps/web/components/support/ticket-detail-sheet.tsx apps/web/app/\(dashboard\)/support/tickets/page.tsx
git commit -m "feat(support): add ticket escalation between sectors"
```

---

### Task 5: SLA Breach Notifications

**Files:**
- Create: `apps/web/hooks/support/use-sla-status.ts`
- Create: `apps/web/components/support/sla-alert-banner.tsx`
- Modify: `apps/web/app/(dashboard)/support/page.tsx` (190 lines)
- Modify: `apps/web/app/(dashboard)/support/tickets/page.tsx`

**Reference files to read first:**
- `apps/web/app/(dashboard)/support/page.tsx` — dashboard (190 lines, stats at 54-75, grid at 88-109)
- `apps/web/hooks/support/use-support-stats.ts` — existing stats hook pattern

- [ ] **Step 1: Create SLA status hook**

Create `apps/web/hooks/support/use-sla-status.ts`:
- Call `check_sla_status()` RPC using Supabase client
- Return array of tickets with SLA info (ticket_id, ticket_title, priority, sla_type, deadline_at, remaining_pct)
- Use `refetchInterval: 60000` for 60s polling
- Only enabled when component is mounted

- [ ] **Step 2: Create SLA Alert Banner**

Create `apps/web/components/support/sla-alert-banner.tsx`:
- Uses `useSlaStatus` hook
- Shows banner when tickets at risk exist:
  - Count of tickets with `remaining_pct < 25` (at risk)
  - Count of tickets with `remaining_pct <= 0` (breached)
- Red background for breaches, yellow for warnings
- Click navigates to `/support/tickets` with filter

- [ ] **Step 3: Add banner to Support dashboard**

Modify `apps/web/app/(dashboard)/support/page.tsx`:
- Import and render `SlaAlertBanner` at top of page (before stats grid, around line 88)

- [ ] **Step 4: Add SLA badges to ticket list**

Modify `apps/web/app/(dashboard)/support/tickets/page.tsx`:
- For each ticket card, show SLA indicator badge:
  - Green badge: > 50% remaining
  - Yellow badge: 25-50% remaining
  - Red badge: < 25% remaining
  - Gray strikethrough: breached (0% or negative)
- Query `check_sla_status()` alongside tickets to get remaining_pct per ticket

- [ ] **Step 5: Build and commit**

```bash
cd apps/web && npx next build 2>&1 | tail -20
git add apps/web/hooks/support/use-sla-status.ts apps/web/components/support/sla-alert-banner.tsx apps/web/app/\(dashboard\)/support/page.tsx apps/web/app/\(dashboard\)/support/tickets/page.tsx
git commit -m "feat(support): add SLA breach notifications and alert banner"
```

---

### Task 6: Final Build Verification

- [ ] **Step 1: Run full build**

```bash
cd apps/web && npx next build 2>&1 | tail -40
```

Expected: Build succeeds, all routes compile, 0 TypeScript errors.

- [ ] **Step 2: Final commit if any fixes needed**

```bash
git add -u && git commit -m "fix(support): resolve build errors from specialization"
```
